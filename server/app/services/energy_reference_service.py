"""NRV Table 2 reference lookup, not an individual energy prediction.

Rows are source facts: age 4..18; reference kg, reference metres,
then published MJ/day at PAL 1.2, 1.4, 1.6, 1.8, 2.0, 2.2.
Do not derive new figures from rounded source BMR or add growth/exercise again.
"""
from decimal import Decimal, ROUND_HALF_UP
from app.services.meal_allocation import allocate_meals
from app.schemas.energy_reference import EnergyReferenceRequest

SOURCE_URL = 'https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/dietary-energy'
RULE_VERSION = 'au-nz-nrv-table2-review-2026-09-30-v1'
PALS = ('1.2', '1.4', '1.6', '1.8', '2.0', '2.2')
LABELS = ('Bed rest', 'Very sedentary', 'Light activity', 'Moderate activity', 'Heavy activity', 'Vigorous activity')
ROWS = {
    'male': [
        '16.2 1.02 4.4 5.2 5.9 6.6 7.3 8.1',
        '18.4 1.09 4.7 5.5 6.2 7.0 7.8 8.5',
        '20.7 1.15 5.0 5.8 6.6 7.4 8.2 9.0',
        '23.1 1.22 5.2 6.1 7.0 7.8 8.7 9.5',
        '25.6 1.28 5.5 6.4 7.3 8.2 9.2 10.1',
        '28.6 1.34 5.9 6.8 7.8 8.8 9.7 10.7',
        '31.9 1.39 6.3 7.3 8.3 9.3 10.4 11.4',
        '35.9 1.44 6.6 7.7 8.8 9.9 11.0 12.0',
        '40.5 1.49 7.0 8.2 9.3 10.5 11.6 12.8',
        '45.6 1.56 7.5 8.7 10.0 11.2 12.4 13.6',
        '51.0 1.64 8.0 9.3 10.6 11.9 13.2 14.6',
        '56.3 1.70 8.5 9.9 11.2 12.6 14.0 15.4',
        '60.9 1.74 8.9 10.3 11.8 13.2 14.7 16.2',
        '64.6 1.75 9.2 10.7 12.2 13.7 15.2 16.7',
        '67.2 1.76 9.4 10.9 12.5 14.0 15.6 17.1',
    ],
    'female': [
        '15.8 1.01 4.1 4.8 5.5 6.1 6.8 7.5',
        '17.9 1.08 4.4 5.1 5.7 6.5 7.2 7.9',
        '20.2 1.15 4.6 5.4 6.1 6.9 7.6 8.4',
        '22.8 1.21 4.9 5.7 6.5 7.3 8.1 8.9',
        '25.6 1.28 5.2 6.0 6.9 7.7 8.6 9.4',
        '29.0 1.33 5.5 6.4 7.3 8.2 9.1 10.0',
        '32.9 1.38 5.7 6.7 7.6 8.5 9.5 10.4',
        '37.2 1.44 6.0 7.0 8.0 9.0 10.0 11.0',
        '41.6 1.51 6.4 7.4 8.5 9.5 10.6 11.6',
        '45.8 1.57 6.7 7.8 8.9 10.0 11.1 12.2',
        '49.4 1.60 6.9 8.1 9.2 10.3 11.5 12.6',
        '52.0 1.62 7.1 8.2 9.4 10.6 11.7 12.9',
        '53.9 1.63 7.2 8.4 9.5 10.7 11.9 13.1',
        '55.1 1.63 7.2 8.4 9.6 10.8 12.0 13.2',
        '56.2 1.63 7.3 8.5 9.7 10.9 12.1 13.3',
    ],
}


def metadata():
    return dict(rule_version=RULE_VERSION, status='reference_only', source_url=SOURCE_URL,
                source_title='Australia / New Zealand NRV — Dietary energy, Table 2',
                checked_on='2026-09-30', min_age=4, max_age=18,
                pal_options=[dict(value=p, label=label) for p, label in zip(PALS, LABELS)])


def preview(payload: EnergyReferenceRequest):
    values = ROWS[payload.sex][payload.age_years-4].split()
    mj = Decimal(values[PALS.index(payload.pal)+2])
    # Thermochemical kcal conversion, shared with recipe convention; round for display.
    kcal = int((mj * 1000 / Decimal('4.184')).quantize(Decimal('1E1'), rounding=ROUND_HALF_UP))
    meals = allocate_meals(kcal, payload.meal_shares)
    return dict(**metadata(), inputs=payload.model_dump(mode='json'),
                reference_weight_kg=values[0], reference_height_cm=str(Decimal(values[1])*100),
                energy_mj=str(mj), energy_kj=str(mj*1000), energy_kcal=kcal,
                meals=meals, meal_rule_status='user_entered_scenario' if meals else 'not_configured',
                exercise_energy_kcal=None, macronutrients=None,
                calculation='Published MJ/day × 1000 ÷ 4.184, rounded to nearest 10 kcal.',
                rounding='Meal rounding uses largest remainders in 10 kcal units; ties use breakfast, lunch, dinner order.')
