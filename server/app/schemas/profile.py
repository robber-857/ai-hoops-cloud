from datetime import date, datetime
from zoneinfo import ZoneInfo

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator


class ProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nickname: str | None
    training_started_on: date | None
    updated_at: datetime


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nickname: str | None = Field(default=None, max_length=100)
    training_started_on: date | None = None
    expected_updated_at: AwareDatetime | None = None

    @field_validator("nickname")
    @classmethod
    def normalize_nickname(cls, value: str | None) -> str | None:
        return value or None

    @field_validator("training_started_on")
    @classmethod
    def validate_training_date(cls, value: date | None) -> date | None:
        if value is not None and value > datetime.now(ZoneInfo("Australia/Sydney")).date():
            raise ValueError("Training start date cannot be in the future.")
        return value
