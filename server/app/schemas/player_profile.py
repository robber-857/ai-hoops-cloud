from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
        age = self.measured_on.year - self.date_of_birth.year - (
            (self.measured_on.month, self.measured_on.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )
        if not 4 <= age <= 18:
            raise ValueError("Player age must be 4–18 on the measurement date.")
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


class PlayerProfileHistory(BaseModel):
    items: list[PlayerProfileRead]
    has_more: bool
