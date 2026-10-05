"""Explicit inputs for admin-only reference scenarios; no player prescription."""
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class MealShares(BaseModel):
    model_config = ConfigDict(extra='forbid')
    breakfast: Decimal = Field(gt=0, lt=100, max_digits=5, decimal_places=2)
    lunch: Decimal = Field(gt=0, lt=100, max_digits=5, decimal_places=2)
    dinner: Decimal = Field(gt=0, lt=100, max_digits=5, decimal_places=2)

    @model_validator(mode='after')
    def total(self):
        if self.breakfast + self.lunch + self.dinner != Decimal(100):
            raise ValueError('Breakfast, lunch and dinner percentages must total 100.')
        return self


class EnergyReferenceRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    age_years: int = Field(ge=4, le=18, strict=True)
    sex: Literal['male', 'female']
    pal: Literal['1.2', '1.4', '1.6', '1.8', '2.0', '2.2']
    meal_shares: MealShares | None = None
