from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import AnalysisType


class CoachClassRead(BaseModel):
    public_id: UUID
    camp_public_id: UUID | None = None
    name: str
    code: str
    description: str | None = None
    status: str
    age_group: str | None = None
    max_students: int | None = None
    start_date: date | None = None
    end_date: date | None = None
    student_count: int
    created_at: datetime


class CoachClassesResponse(BaseModel):
    items: list[CoachClassRead]


class CoachStudentRead(BaseModel):
    public_id: UUID
    username: str
    nickname: str | None = None
    email: str | None = None
    phone_number: str
    status: str
    joined_at: datetime | None = None
    report_count: int
    last_report_at: datetime | None = None
    best_score: float | None = None


class CoachStudentsResponse(BaseModel):
    items: list[CoachStudentRead]


class CoachClassReportRead(BaseModel):
    public_id: UUID
    session_public_id: UUID
    video_public_id: UUID
    student_public_id: UUID
    student_name: str
    analysis_type: AnalysisType
    template_code: str
    template_version: str | None = None
    overall_score: float | None = None
    grade: str | None = None
    status: str
    video_url: str | None = None
    created_at: datetime
    analysis_finished_at: datetime | None = None


class CoachClassReportsResponse(BaseModel):
    items: list[CoachClassReportRead]


class CoachCreateTaskRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str | None = None
    analysis_type: AnalysisType | None = None
    template_code: str | None = Field(default=None, max_length=100)
    target_config: dict | None = None
    status: str = Field(default="published", max_length=20)
    publish_at: datetime | None = None
    start_at: datetime | None = None
    due_at: datetime | None = None


class CoachTaskRead(BaseModel):
    public_id: UUID
    class_public_id: UUID
    title: str
    description: str | None = None
    analysis_type: AnalysisType | None = None
    template_code: str | None = None
    target_config: dict | None = None
    status: str
    publish_at: datetime | None = None
    start_at: datetime | None = None
    due_at: datetime | None = None
    assignment_count: int
    created_at: datetime


class CoachCreateAnnouncementRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1)
    status: str = Field(default="published", max_length=20)
    is_pinned: bool = False
    publish_at: datetime | None = None
    expire_at: datetime | None = None


class CoachAnnouncementRead(BaseModel):
    public_id: UUID
    class_public_id: UUID
    title: str
    content: str
    status: str
    is_pinned: bool
    publish_at: datetime | None = None
    expire_at: datetime | None = None
    created_at: datetime
