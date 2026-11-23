from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.schemas.training_assistant import AssistantRecommendation


class ConversationQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: UUID
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2400)]


class ConversationFollowup(ConversationQuestion):
    expected_turn_count: int = Field(ge=1)


class ConversationArchive(BaseModel):
    model_config = ConfigDict(extra="forbid")

    archived: bool


class ConversationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: UUID
    title: str
    archived: bool
    turn_count: int
    created_at: datetime
    updated_at: datetime


class ConversationMessage(BaseModel):
    turn: int
    role: Literal["user", "assistant"]
    content: str
    recommendations: list[AssistantRecommendation] = Field(default_factory=list)
    created_at: datetime


class ConversationDetail(ConversationSummary):
    messages: list[ConversationMessage]
    has_more: bool


class ConversationHistory(BaseModel):
    items: list[ConversationSummary]
    total: int
