from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator


class PlayerProfileCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    date_of_birth: date
    measured_on: date
    height_cm: Decimal = Field(gt=0, le=300, max_digits=5, decimal_places=2)
    weight_kg: Decimal = Field(gt=0, le=500, max_digits=5, decimal_places=2)
    sex: Literal["female", "male"] | None = None

    @model_validator(mode="after")
    def validate_dates(self):
        today = datetime.now(ZoneInfo("Australia/Sydney")).date()
        if self.measured_on > today:
            raise ValueError("Measurement date cannot be in the future.")
        if self.date_of_birth > self.measured_on:
            raise ValueError("Date of birth cannot be after the measurement date.")
        return self


class PlayerProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    public_id: UUID
    date_of_birth: date
    measured_on: date
    height_cm: Decimal
    weight_kg: Decimal
    sex: Literal["female", "male"] | None
    created_at: datetime

    @computed_field
    @property
    def bmi(self) -> Decimal:
        height_m = self.height_cm / Decimal(100)
        return (self.weight_kg / height_m**2).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class PlayerProfileHistory(BaseModel):
    items: list[PlayerProfileRead]
    has_more: bool
