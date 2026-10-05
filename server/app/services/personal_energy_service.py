"""Versioned candidate DRI energy equations; coach review only, no publication."""
from calendar import monthrange
from hashlib import sha256
import json
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from fastapi import HTTPException
from app.schemas.personal_energy import PersonalEnergyPreviewRequest
from app.services.class_report_service import ClassReportService
from app.services.meal_allocation import allocate_meals

SOURCE_URL = 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html'
RULE_VERSION = 'dri-2023-personal-energy-review-2026-10-01-v2'
# Intercept, age (years), height (cm), weight (kg); growth is added exactly once.
COEFFICIENTS = {
    'male': {
        'inactive': ('-447.51','3.68','13.01','13.15'),
        'low_active': ('19.12','3.68','8.62','20.28'),
        'active': ('-388.19','3.68','12.66','20.46'),
        'very_active': ('-671.75','3.68','15.38','23.25'),
    },
    'female': {
        'inactive': ('55.59','-22.25','8.43','17.07'),
        'low_active': ('-297.54','-22.25','12.77','14.73'),
        'active': ('-189.55','-22.25','11.74','18.34'),
        'very_active': ('-709.59','-22.25','18.22','14.25'),
    },
}


def age_at(born, on):
    def anniversary(year):
        return date(year, born.month, min(born.day, monthrange(year, born.month)[1]))
    years = on.year-born.year-(on < anniversary(on.year))
    start, end = anniversary(born.year+years), anniversary(born.year+years+1)
    return years, Decimal(years)+Decimal((on-start).days)/Decimal((end-start).days)


def calculate(report, activity, meal_shares=None):
    base = dict(student_name=report['student_name'], attendance=report['attendance'],
                energy_kcal=None, inputs=None, formula=None, growth_kcal=None, meals=None)
    if report['attendance']=='absent':
        return dict(**base, status='not_applicable', reason='Absent: no energy preview is generated from this lesson.')
    profile = report.get('profile')
    if not profile:
        return dict(**base, status='missing_profile', reason='No measurements available on or before the lesson date.')
    if profile.get('sex') not in COEFFICIENTS:
        return dict(**base, status='missing_sex', reason='The formula requires the sex field in the body profile.')
    on, born = date.fromisoformat(report['held_on']), date.fromisoformat(profile['date_of_birth'])
    years, age = age_at(born, on)
    if not 4 <= years < 19:
        return dict(**base, status='unsupported_age', reason='This candidate supports age 4 to under 19 at the lesson date.')
    measured = date.fromisoformat(profile['measured_on'])
    try:
        height, weight = Decimal(profile['height_cm']), Decimal(profile['weight_kg'])
        valid = height.is_finite() and weight.is_finite() and 0 < height <= 300 and 0 < weight <= 500
    except (InvalidOperation, TypeError):
        valid = False
    if not valid or measured > on:
        return dict(**base, status='invalid_profile', reason='Check the recorded measurements and measurement date.')
    a,b,c,d = map(Decimal, COEFFICIENTS[profile['sex']][activity])
    growth = 15 if years < 9 else (25 if profile['sex']=='male' else 30) if years < 14 else 20
    energy = a+b*age+c*height+d*weight+growth
    if energy <= 0:
        return dict(**base, status='invalid_result', reason='The recorded inputs do not produce a positive estimate. Review the measurements.')
    base.update(energy_kcal=int(energy.quantize(Decimal('1E1'), rounding=ROUND_HALF_UP)),
                growth_kcal=growth,
                inputs=dict(profile_public_id=profile.get('public_id'), measured_on=str(measured),
                            measurement_age_days=(on-measured).days, held_on=str(on), age_years=str(age.quantize(Decimal('.0001'))),
                            sex=profile['sex'], height_cm=str(height), weight_kg=str(weight), activity_category=activity),
                formula=f'{a} + ({b} × age years) + ({c} × height cm) + ({d} × weight kg) + {growth}')
    base['meals'] = allocate_meals(base['energy_kcal'], meal_shares)
    return dict(**base, status='candidate', reason='Candidate whole-day estimate for review, rounded to 10 kcal. Not a measured expenditure or a published diet target.')


def lesson_preview(db, user, class_id, lesson_id, payload: PersonalEnergyPreviewRequest):
    # Uses existing active-class authorization and immutable publication inputs when available.
    source = ClassReportService(db).energy_preview_source(user, class_id, lesson_id)
    if source['lesson_version'] != payload.expected_version:
        raise HTTPException(409, 'Lesson changed. Reload the saved lesson before previewing energy.')
    overrides = {str(key): value for key, value in payload.activity_overrides.items()}
    eligible = {r['student_public_id'] for r in source['reports'] if r['attendance'] != 'absent'}
    if not source['blockers'] and not set(overrides).issubset(eligible):
        raise HTTPException(422, 'Activity overrides must refer to participating players in this lesson. Reload the lesson and review the selections.')
    result = dict(rule_version=RULE_VERSION, source_url=SOURCE_URL, source_title='Health Canada — DRI energy equations (2023 framework)',
                checked_on='2026-10-01', status='candidate_review_only', lesson_version=source['lesson_version'],
                input_basis='published_snapshot' if source['already_published'] else 'saved_lesson',
                activity_category=payload.activity_category, activity_overrides=overrides, blockers=source['blockers'],
                meal_shares=payload.meal_shares.model_dump(mode='json') if payload.meal_shares else None,
                players=[] if source['blockers'] else [dict(calculate(r,overrides.get(r['student_public_id'],payload.activity_category),payload.meal_shares),
                    student_public_id=r['student_public_id'], activity_category=overrides.get(r['student_public_id'],payload.activity_category),
                    activity_basis='individual_review' if r['student_public_id'] in overrides else 'class_scenario') for r in source['reports']])
    result['preview_token'] = sha256(json.dumps(result,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return result
