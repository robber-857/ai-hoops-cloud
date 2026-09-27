from datetime import date, datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class PlanItem(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=120)
    sets: int | None = Field(default=None, ge=1, le=100)
    reps: int | None = Field(default=None, ge=1, le=10000)
    duration_minutes: float | None = Field(
        default=None, gt=0, le=1440, allow_inf_nan=False
    )
    instructions: str | None = Field(default=None, max_length=1000)
    template_code: str | None = Field(default=None, min_length=1, max_length=100)


class PlanContent(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=120)
    planned_on: date
    focus: Literal["fitness", "coordination", "basketball", "general"] = "general"
    notes: str | None = Field(default=None, max_length=2000)
    items: list[PlanItem] = Field(min_length=1, max_length=40)


class PlanCreate(PlanContent):
    request_id: UUID
    student_public_id: UUID | None = None
    supersedes_public_id: UUID | None = None


class PlanUpdate(PlanContent):
    expected_version: int = Field(ge=1)


class PlanPublish(BaseModel):
    expected_version: int = Field(ge=1)


class PlanItemRead(PlanItem):
    analysis_type: str | None = None
    template_version: str | None = None


class PlanRead(PlanContent):
    public_id: UUID
    class_public_id: UUID
    class_name: str
    student_public_id: UUID | None
    student_name: str | None
    status: str
    version: int
    published_at: datetime | None
    supersedes_public_id: UUID | None
    items: list[PlanItemRead]


class PlansRead(BaseModel):
    items: list[PlanRead]
    has_more: bool
