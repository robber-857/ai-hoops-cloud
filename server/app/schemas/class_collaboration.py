from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ClassInvitationToken(BaseModel):
    token: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")


class ClassInvitationStatus(BaseModel):
    active: bool
    expires_at: datetime | None = None


class ClassInvitationIssued(BaseModel):
    token: str
    expires_at: datetime


class ClassInvitationPreview(BaseModel):
    class_name: str
    course_name: str


class ClassJoinStatus(ClassInvitationPreview):
    status: Literal["pending", "approved", "declined"]


class ClassJoinRequestRead(BaseModel):
    public_id: UUID
    student_name: str
    status: Literal["pending", "approved", "declined"]
    requested_at: datetime
    reviewed_at: datetime | None = None


class ClassJoinRequestDecision(BaseModel):
    decision: Literal["approved", "declined"]


class ClassVideoRead(BaseModel):
    public_id: UUID
    class_public_id: UUID
    class_name: str
    title: str
    uploader_name: str
    created_at: datetime


class ClassVideosPage(BaseModel):
    items: list[ClassVideoRead]
    has_more: bool


class ClassVideoPlayback(BaseModel):
    url: str
