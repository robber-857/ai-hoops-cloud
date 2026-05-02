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
    completed_assignment_count: int = 0
    assignment_status_counts: dict[str, int] = Field(default_factory=dict)
    created_at: datetime


class CoachTaskAssignmentRead(BaseModel):
    public_id: UUID
    student_public_id: UUID
    student_name: str
    status: str
    progress_percent: float | None = None
    completed_sessions: int
    best_score: float | None = None
    latest_report_public_id: UUID | None = None
    completed_at: datetime | None = None
    last_submission_at: datetime | None = None
    created_at: datetime


class CoachTaskDetailRead(CoachTaskRead):
    assignments: list[CoachTaskAssignmentRead] = Field(default_factory=list)


class CoachTasksResponse(BaseModel):
    items: list[CoachTaskRead]


class CoachBulkUpdateTasksRequest(BaseModel):
    task_public_ids: list[UUID] = Field(min_length=1)
    status: str = Field(min_length=1, max_length=20)


class CoachUpdateTaskRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    analysis_type: AnalysisType | None = None
    template_code: str | None = Field(default=None, max_length=100)
    target_config: dict | None = None
    status: str | None = Field(default=None, max_length=20)
    publish_at: datetime | None = None
    start_at: datetime | None = None
    due_at: datetime | None = None


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


class CoachAnnouncementsResponse(BaseModel):
    items: list[CoachAnnouncementRead]


class CoachBulkUpdateAnnouncementsRequest(BaseModel):
    announcement_public_ids: list[UUID] = Field(min_length=1)
    status: str | None = Field(default=None, max_length=20)
    is_pinned: bool | None = None


class CoachUpdateAnnouncementRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    content: str | None = Field(default=None, min_length=1)
    status: str | None = Field(default=None, max_length=20)
    is_pinned: bool | None = None
    publish_at: datetime | None = None
    expire_at: datetime | None = None


class CoachDashboardClassSnapshot(BaseModel):
    public_id: UUID
    name: str
    code: str
    student_count: int
    open_task_count: int
    recent_report_count: int
    latest_report_at: datetime | None = None


class CoachDashboardResponse(BaseModel):
    class_count: int
    active_class_count: int
    student_count: int
    report_count: int
    recent_report_count: int
    task_count: int
    open_task_count: int
    announcement_count: int
    class_snapshots: list[CoachDashboardClassSnapshot]


class CoachStudentClassMembershipRead(BaseModel):
    class_public_id: UUID
    class_name: str
    class_code: str
    member_public_id: UUID
    member_role: str
    status: str
    joined_at: datetime | None = None


class CoachStudentTaskSummary(BaseModel):
    assigned_count: int
    completed_count: int
    in_progress_count: int
    pending_count: int
    latest_submission_at: datetime | None = None


class CoachStudentProfileRead(BaseModel):
    public_id: UUID
    username: str
    nickname: str | None = None
    email: str | None = None
    phone_number: str
    status: str
    role: str
    report_count: int
    best_score: float | None = None
    last_report_at: datetime | None = None
    memberships: list[CoachStudentClassMembershipRead]
    task_summary: CoachStudentTaskSummary


class CoachStudentReportsResponse(BaseModel):
    items: list[CoachClassReportRead]
