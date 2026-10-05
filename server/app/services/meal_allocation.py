from decimal import Decimal, ROUND_FLOOR
from app.schemas.energy_reference import MealShares


def allocate_meals(kcal: int, shares: MealShares | None):
    """Allocate a displayed 10-kcal total without introducing any default ratio."""
    if shares is None:
        return None
    if kcal < 0 or kcal % 10:
        raise ValueError('Meal allocation requires a nonnegative total in 10-kcal units.')
    values = shares.model_dump()
    raw = {name: Decimal(kcal // 10) * share / 100 for name, share in values.items()}
    units = {name: int(value.to_integral_value(rounding=ROUND_FLOOR)) for name, value in raw.items()}
    remaining = kcal // 10 - sum(units.values())
    order = sorted(raw, key=lambda name: raw[name]-units[name], reverse=True)
    for name in order[:remaining]:
        units[name] += 1
    return [dict(name=name, percent=str(values[name]), energy_kcal=units[name]*10) for name in values]
