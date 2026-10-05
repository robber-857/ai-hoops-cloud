"""Versioned gross course-energy estimates; never a daily intake target."""
from copy import deepcopy
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP, localcontext
import json
from pathlib import Path


RULE_VERSION = "course-gross-energy-2026-10-03-v1"
ROUNDING_VERSION = "decimal40-sum-half-up-integer-kcal-v1"
INTENSITY_FACTORS = {"low": Decimal("0.8"), "moderate": Decimal("1.0"), "high": Decimal("1.15")}
AGE_GROUPS = ("6-9", "10-12", "13-15", "16-18")
_CONFIG = json.loads((Path(__file__).resolve().parents[1] / "config" / "exercise_activities.json").read_text(encoding="utf-8"))
MAPPING_VERSION = _CONFIG["mapping_version"]
_ACTIVITIES = {entry["code"]: entry for entry in _CONFIG["activities"]}


def metadata():
    return dict(
        items=[dict(code=entry["code"], name=entry["name"], intensities=list(entry["intensities"])) for entry in _CONFIG["activities"]],
        mapping_version=MAPPING_VERSION, rule_version=RULE_VERSION, basis="gross",
    )


def _date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


def _number(value, *, minimum, maximum):
    if isinstance(value, bool):
        raise ValueError("Boolean is not a measurement.")
    number = Decimal(str(value))
    if not number.is_finite() or number < minimum or number > maximum:
        raise ValueError("Measurement is outside the supported range.")
    return number


def _age(born, on):
    return on.year - born.year - ((on.month, on.day) < (born.month, born.day))


def _round(value):
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _text(value):
    return format(value, "f")


def calculate_item(activity_code, intensity, minutes, profile, held_on, *, item_id=None):
    inputs = dict(
        activity_code=activity_code, intensity=intensity, minutes=None,
        weight_kg=None, profile_public_id=None, measured_on=None, held_on=None,
        age_years=None, sex=None, met_type=None, met_value=None,
        bmr_kcal_per_min=None, intensity_factor=None,
    )
    result = dict(
        item_id=str(item_id) if item_id is not None else None,
        status="missing_input", method=None, gross_kcal=None, unrounded_kcal=None,
        source=None, inputs=inputs, mapping_basis=None, mapping_reason=None,
        rule_version=RULE_VERSION, mapping_version=MAPPING_VERSION,
        rounding_version=ROUNDING_VERSION, basis="gross", reason=None,
    )

    def fail(status, reason):
        result.update(status=status, reason=reason)
        return result

    if minutes is None:
        return fail("missing_input", "Record this player's effective activity minutes before estimating energy.")
    try:
        duration = _number(minutes, minimum=Decimal(0), maximum=Decimal(1440))
    except (InvalidOperation, ValueError, TypeError):
        return fail("invalid_input", "Effective minutes must be a finite value between 0 and 1440.")
    inputs["minutes"] = _text(duration)
    if duration == 0:
        result.update(status="not_applicable", gross_kcal=0, unrounded_kcal="0", reason="No effective activity minutes were recorded for this item.")
        return result
    activity = _ACTIVITIES.get(activity_code) if isinstance(activity_code, str) else None
    if activity is None:
        return fail("unmapped_activity", "Choose a configured training activity; names are not used to infer a MET value.")
    if intensity not in activity["intensities"]:
        return fail("missing_input" if intensity is None else "invalid_input", "Choose low, moderate or high intensity explicitly.")
    if not profile:
        return fail("missing_profile", "No body profile is available on or before the lesson date.")
    try:
        on, born = _date(held_on), _date(profile["date_of_birth"])
    except (KeyError, TypeError, ValueError):
        return fail("missing_input", "A valid date of birth and lesson date are required, including for a generic approximation.")
    age = _age(born, on)
    inputs.update(held_on=on.isoformat(), age_years=age, sex=profile.get("sex"),
                  profile_public_id=str(profile["public_id"]) if profile.get("public_id") is not None else None)
    if not 4 <= age < 19:
        return fail("invalid_input", "The course estimate supports age 4 to under 19 at the lesson date.")
    try:
        measured = _date(profile["measured_on"])
    except (KeyError, TypeError, ValueError):
        return fail("missing_input", "Record the measurement date before estimating energy.")
    inputs["measured_on"] = measured.isoformat()
    if measured > on or measured < born:
        return fail("invalid_input", "The body measurements must be recorded between birth and the lesson date.")
    if profile.get("weight_kg") is None:
        return fail("missing_input", "Record body weight before estimating energy.")
    try:
        weight = _number(profile["weight_kg"], minimum=Decimal("0.01"), maximum=Decimal(500))
    except (InvalidOperation, ValueError, TypeError):
        return fail("invalid_input", "Body weight must be a finite positive value no greater than 500 kg.")
    inputs["weight_kg"] = _text(weight)
    inputs["measurement_age_days"] = (on - measured).days

    youth = activity["youth"].get(intensity, activity["youth"].get("*")) if age >= 6 else None
    with localcontext() as context:
        context.prec = 40
        if youth is not None:
            if profile.get("sex") not in ("male", "female"):
                return fail("missing_input", "The youth BMR formula requires the sex field; missing inputs do not trigger an adult fallback.")
            group = 0 if age < 10 else 1 if age < 13 else 2 if age < 16 else 3
            met_value = youth["mety"][group]
            if met_value is None:
                youth = None
            else:
                if profile["sex"] == "male":
                    a, b = (Decimal("22.706"), Decimal("504.3")) if age < 10 else (Decimal("17.686"), Decimal("658.2"))
                else:
                    a, b = (Decimal("20.315"), Decimal("485.9")) if age < 10 else (Decimal("13.384"), Decimal("692.6"))
                bmr = (a * weight + b) / Decimal(1440)
                energy = Decimal(met_value) * bmr * duration
                inputs.update(met_type="METy", met_value=met_value, bmr_kcal_per_min=_text(bmr))
                source = deepcopy(_CONFIG["youth_source"])
                source.update(activity_code=youth["code"].replace("X", str(group + 2)), activity_code_template=youth["code"],
                              description=youth["description"], age_group=AGE_GROUPS[group], checked_on=_CONFIG["checked_on"])
                result.update(method="youth_analogy" if youth["mapping_basis"] == "similar_activity" else "youth_mety",
                              source=source, mapping_basis=youth["mapping_basis"], mapping_reason=youth["reason"])
        if youth is None:
            generic = activity.get("generic")
            if generic is None:
                return fail("unmapped_activity", "No suitable youth reference or sourced generic baseline is configured.")
            factor = INTENSITY_FACTORS[intensity]
            energy = Decimal(generic["base_met"]) * Decimal("3.5") * weight / Decimal(200) * duration * factor
            inputs.update(met_type="MET", met_value=generic["base_met"], intensity_factor=_text(factor))
            source = deepcopy(_CONFIG["generic_source"])
            source.update(url=generic["url"], activity_code=generic["code"], description=generic["description"],
                          age_group=None, checked_on=_CONFIG["checked_on"], reference_scope="adult_source_used_as_generic_approximation")
            result.update(method="generic_met_approximation", source=source,
                          mapping_basis=generic["mapping_basis"], mapping_reason=generic["reason"])
        result.update(status="estimated", gross_kcal=_round(energy), unrounded_kcal=_text(energy),
                      reason="Approximate total energy during the activity, including the resting component; not measured active calories or an intake target.")
    return result


def calculate_lesson(items, profile, held_on):
    estimates = [calculate_item(item.get("activity_code"), item.get("intensity"), item.get("minutes"), profile, held_on,
                                item_id=item.get("item_id")) for item in items]
    known = [entry for entry in estimates if entry["status"] in ("estimated", "not_applicable")]
    missing = len(estimates) - len(known)
    with localcontext() as context:
        context.prec = 40
        subtotal = sum((Decimal(entry["unrounded_kcal"]) for entry in known), Decimal(0)) if known else None
        rounded = _round(subtotal) if subtotal is not None else None
    status = "unavailable" if not known else "partial" if missing else "not_applicable" if all(entry["status"] == "not_applicable" for entry in estimates) else "complete"
    return dict(
        status=status, total_kcal=rounded if estimates and not missing else None,
        known_subtotal_kcal=rounded, unrounded_subtotal_kcal=_text(subtotal) if subtotal is not None else None,
        missing_items=missing, methods=sorted({entry["method"] for entry in estimates if entry["method"] is not None}),
        items=estimates, basis="gross", rule_version=RULE_VERSION, mapping_version=MAPPING_VERSION,
        rounding_version=ROUNDING_VERSION,
    )
