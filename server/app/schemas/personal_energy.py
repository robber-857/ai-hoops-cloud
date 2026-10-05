from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.energy_reference import MealShares

ActivityCategory = Literal['inactive', 'low_active', 'active', 'very_active']


class PersonalEnergyPreviewRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    expected_version: int = Field(ge=1)
    activity_category: ActivityCategory
    meal_shares: MealShares | None = None
    activity_overrides: dict[UUID, ActivityCategory] = Field(default_factory=dict, max_length=500)


class EnergyDraftSave(PersonalEnergyPreviewRequest):
    request_id: UUID
    expected_revision: int = Field(ge=0)
    preview_token: str = Field(pattern=r'^[a-f0-9]{64}$')
