from datetime import date, datetime
from typing import Literal, Annotated
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator

Minutes = Annotated[Decimal, Field(ge=0, le=1440, max_digits=6, decimal_places=2)]


class LessonItem(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    item_id: UUID
    name: str = Field(min_length=1, max_length=120)
    actual_minutes: Minutes | None = None
    notes: str | None = Field(default=None, max_length=1000)


class ItemParticipation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    item_id: UUID
    minutes: Minutes | None = None


class LessonParticipant(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    student_public_id: UUID
    status: Literal["unconfirmed", "present", "absent", "left_early", "partial"] = (
        "unconfirmed"
    )
    items: list[ItemParticipation] = Field(min_length=1, max_length=40)
    notes: str | None = Field(default=None, max_length=1000)


class LessonContent(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=120)
    held_on: date
    notes: str | None = Field(default=None, max_length=2000)
    items: list[LessonItem] = Field(min_length=1, max_length=40)
    participants: list[LessonParticipant] = Field(max_length=300)

    @model_validator(mode="after")
    def participation_consistent(self):
        item_ids = [i.item_id for i in self.items]
        if len(set(item_ids)) != len(item_ids):
            raise ValueError("Activity IDs must be unique.")
        people = [p.student_public_id for p in self.participants]
        if len(set(people)) != len(people):
            raise ValueError("Players must be unique.")
        actual = {i.item_id: i.actual_minutes for i in self.items}
        if sum(v or 0 for v in actual.values()) > 1440:
            raise ValueError("Total actual minutes cannot exceed 1440.")
        for person in self.participants:
            values = {i.item_id: i.minutes for i in person.items}
            if len(values) != len(person.items) or set(values) != set(item_ids):
                raise ValueError(
                    "Each player must have exactly one entry per activity."
                )
            if person.status == "unconfirmed":
                if any(v is not None for v in values.values()):
                    raise ValueError(
                        "Unconfirmed participation must have unknown minutes."
                    )
                continue
            if person.status == "absent":
                if any(v != 0 for v in values.values()):
                    raise ValueError("Absent players must have zero minutes.")
                continue
            if any(v is None for v in actual.values()) or any(
                v is None for v in values.values()
            ):
                raise ValueError(
                    "Record all actual and player minutes before confirming participation."
                )
            if any(values[k] > actual[k] for k in item_ids):
                raise ValueError("Player minutes cannot exceed activity minutes.")
            total = sum(values.values())
            full = sum(actual.values())
            if person.status == "present" and any(
                values[k] != actual[k] for k in item_ids
            ):
                raise ValueError("Full attendance must match every activity duration.")
            if person.status in ("partial", "left_early") and not 0 < total < full:
                raise ValueError(
                    "Partial participation must be greater than zero and less than full attendance."
                )
            if person.status == "left_early":
                left = False
                for key in item_ids:
                    if left and values[key] > 0:
                        raise ValueError(
                            "Early departure cannot include later activities after leaving."
                        )
                    if values[key] < actual[key]:
                        left = True
        return self


class LessonCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    plan_public_id: UUID
    held_on: date


class LessonUpdate(LessonContent):
    request_id: UUID
    expected_version: int = Field(ge=1)


class LessonRead(LessonContent):
    public_id: UUID
    class_public_id: UUID
    class_name: str
    version: int
    source_plan: dict
    roster: list[dict]
    timezone: Literal["Australia/Sydney"] = "Australia/Sydney"
    updated_at: datetime


class LessonSummary(BaseModel):
    public_id: UUID
    title: str
    held_on: date
    version: int
    unconfirmed_count: int
    missing_minutes_count: int


class LessonsRead(BaseModel):
    items: list[LessonSummary]
    has_more: bool


class LessonHistoryEntry(BaseModel):
    version: int
    saved_at: datetime


class LessonHistory(BaseModel):
    items: list[LessonHistoryEntry]
    has_more: bool
