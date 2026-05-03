from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import AnalysisType, StorageProvider, UserRole, UserStatus


class AdminCampRead(BaseModel):
    public_id: UUID
    name: str
    code: str
    description: str | None = None
    season_name: str | None = None
    status: str
    start_date: date | None = None
    end_date: date | None = None
    class_count: int
    created_at: datetime


class AdminCampsResponse(BaseModel):
    items: list[AdminCampRead]


class AdminCreateCampRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=50)
    description: str | None = None
    season_name: str | None = Field(default=None, max_length=100)
    status: str = Field(default="active", max_length=20)
    start_date: date | None = None
    end_date: date | None = None


class AdminUpdateCampRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = None
    season_name: str | None = Field(default=None, max_length=100)
    status: str | None = Field(default=None, max_length=20)
    start_date: date | None = None
    end_date: date | None = None


class AdminClassRead(BaseModel):
    public_id: UUID
    camp_public_id: UUID
    camp_name: str
    name: str
    code: str
    description: str | None = None
    status: str
    age_group: str | None = None
    max_students: int | None = None
    start_date: date | None = None
    end_date: date | None = None
    coach_count: int
    student_count: int
    created_at: datetime


class AdminClassesResponse(BaseModel):
    items: list[AdminClassRead]


class AdminCreateClassRequest(BaseModel):
    camp_public_id: UUID
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=50)
    description: str | None = None
    status: str = Field(default="active", max_length=20)
    age_group: str | None = Field(default=None, max_length=50)
    max_students: int | None = Field(default=None, ge=1)
    start_date: date | None = None
    end_date: date | None = None


class AdminUpdateClassRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = None
    status: str | None = Field(default=None, max_length=20)
    age_group: str | None = Field(default=None, max_length=50)
    max_students: int | None = Field(default=None, ge=1)
    start_date: date | None = None
    end_date: date | None = None


class AdminClassMemberRead(BaseModel):
    public_id: UUID
    class_public_id: UUID
    user_public_id: UUID
    username: str
    nickname: str | None = None
    email: str | None = None
    phone_number: str
    user_role: str
    member_role: str
    status: str
    joined_at: datetime | None = None
    left_at: datetime | None = None
    remarks: str | None = None
    created_at: datetime


class AdminClassMembersResponse(BaseModel):
    items: list[AdminClassMemberRead]


class AdminCreateClassMemberRequest(BaseModel):
    user_public_id: UUID
    member_role: str = Field(min_length=1, max_length=20)
    status: str = Field(default="active", max_length=20)
    joined_at: datetime | None = None
    remarks: str | None = None


class AdminUserClassMembershipRead(BaseModel):
    public_id: UUID
    class_public_id: UUID
    class_name: str
    class_code: str
    camp_public_id: UUID
    camp_name: str
    member_role: str
    status: str
    joined_at: datetime | None = None
    left_at: datetime | None = None


class AdminUserRead(BaseModel):
    public_id: UUID
    username: str
    nickname: str | None = None
    email: EmailStr | None = None
    phone_number: str
    role: UserRole
    status: UserStatus
    is_active: bool
    class_names: list[str]
    camp_names: list[str]
    active_class_count: int
    report_count: int
    task_assignment_count: int
    last_training_at: datetime | None = None
    last_login_at: datetime | None = None
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AdminUserDetailRead(AdminUserRead):
    memberships: list[AdminUserClassMembershipRead]


class AdminUsersResponse(BaseModel):
    items: list[AdminUserRead]
    total: int
    page: int
    page_size: int


class AdminCreateUserRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    phone_number: str = Field(min_length=1, max_length=32)
    email: EmailStr | None = None
    nickname: str | None = Field(default=None, max_length=100)
    role: UserRole = UserRole.student
    status: UserStatus = UserStatus.active
    class_public_ids: list[UUID] | None = None


class AdminUpdateUserRequest(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    phone_number: str | None = Field(default=None, min_length=1, max_length=32)
    email: EmailStr | None = None
    nickname: str | None = Field(default=None, max_length=100)
    role: UserRole | None = None
    status: UserStatus | None = None
    class_public_ids: list[UUID] | None = None


class AdminAnnouncementRead(BaseModel):
    public_id: UUID
    publisher_public_id: UUID
    publisher_name: str
    scope_type: str
    target_role: UserRole | None = None
    camp_public_id: UUID | None = None
    camp_name: str | None = None
    class_public_id: UUID | None = None
    class_name: str | None = None
    title: str
    content: str
    status: str
    is_pinned: bool
    publish_at: datetime | None = None
    expire_at: datetime | None = None
    notification_count: int
    read_count: int
    created_at: datetime
    updated_at: datetime


class AdminAnnouncementsResponse(BaseModel):
    items: list[AdminAnnouncementRead]


class AdminCreateAnnouncementRequest(BaseModel):
    scope_type: str = Field(default="global", min_length=1, max_length=20)
    target_role: UserRole | None = None
    camp_public_id: UUID | None = None
    class_public_id: UUID | None = None
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1)
    status: str = Field(default="published", max_length=20)
    is_pinned: bool = False
    publish_at: datetime | None = None
    expire_at: datetime | None = None
    notify_recipients: bool = True


class AdminUpdateAnnouncementRequest(BaseModel):
    scope_type: str | None = Field(default=None, min_length=1, max_length=20)
    target_role: UserRole | None = None
    camp_public_id: UUID | None = None
    class_public_id: UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=120)
    content: str | None = Field(default=None, min_length=1)
    status: str | None = Field(default=None, max_length=20)
    is_pinned: bool | None = None
    publish_at: datetime | None = None
    expire_at: datetime | None = None
    notify_recipients: bool = True


class AdminTaskAssignmentRead(BaseModel):
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


class AdminTaskRead(BaseModel):
    public_id: UUID
    camp_public_id: UUID | None = None
    camp_name: str | None = None
    class_public_id: UUID
    class_name: str
    coach_public_id: UUID
    coach_name: str
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
    completed_assignment_count: int
    assignment_status_counts: dict[str, int] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class AdminTaskDetailRead(AdminTaskRead):
    assignments: list[AdminTaskAssignmentRead] = Field(default_factory=list)


class AdminTasksResponse(BaseModel):
    items: list[AdminTaskRead]


class AdminUpdateTaskRequest(BaseModel):
    status: str | None = Field(default=None, max_length=20)
    publish_at: datetime | None = None
    start_at: datetime | None = None
    due_at: datetime | None = None


class AdminNotificationRead(BaseModel):
    public_id: UUID
    user_public_id: UUID
    user_name: str
    user_role: UserRole
    type: str
    title: str
    content: str | None = None
    business_type: str | None = None
    business_id: int | None = None
    business_public_id: UUID | None = None
    is_read: bool
    read_at: datetime | None = None
    created_at: datetime


class AdminNotificationsResponse(BaseModel):
    items: list[AdminNotificationRead]


class AdminTrainingTemplateVersionRead(BaseModel):
    public_id: UUID
    version: str
    scoring_rules: dict
    metric_definitions: dict | None = None
    mediapipe_config: dict | None = None
    summary_template: dict | None = None
    status: str
    is_default: bool
    published_at: datetime | None = None
    created_at: datetime


class AdminTrainingTemplateRead(BaseModel):
    public_id: UUID
    template_code: str
    name: str
    analysis_type: AnalysisType
    description: str | None = None
    difficulty_level: str | None = None
    status: str
    current_version: str | None = None
    version_count: int
    published_at: datetime | None = None
    created_at: datetime


class AdminTrainingTemplatesResponse(BaseModel):
    items: list[AdminTrainingTemplateRead]


class AdminLocalTemplateSyncItem(BaseModel):
    template_code: str
    name: str
    analysis_type: AnalysisType
    source_path: str
    version: str
    action: str
    reason: str | None = None


class AdminLocalTemplateSyncResponse(BaseModel):
    dry_run: bool
    created: int
    updated: int
    skipped: int
    items: list[AdminLocalTemplateSyncItem]


class AdminCreateTrainingTemplateRequest(BaseModel):
    template_code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=100)
    analysis_type: AnalysisType
    description: str | None = None
    difficulty_level: str | None = Field(default=None, max_length=20)
    status: str = Field(default="draft", max_length=20)
    current_version: str | None = Field(default=None, max_length=50)


class AdminUpdateTrainingTemplateRequest(BaseModel):
    template_code: str | None = Field(default=None, min_length=1, max_length=100)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    analysis_type: AnalysisType | None = None
    description: str | None = None
    difficulty_level: str | None = Field(default=None, max_length=20)
    status: str | None = Field(default=None, max_length=20)
    current_version: str | None = Field(default=None, max_length=50)


class AdminCreateTrainingTemplateVersionRequest(BaseModel):
    version: str = Field(min_length=1, max_length=50)
    scoring_rules: dict
    metric_definitions: dict | None = None
    mediapipe_config: dict | None = None
    summary_template: dict | None = None
    status: str = Field(default="draft", max_length=20)
    is_default: bool = False


class AdminUpdateTrainingTemplateVersionRequest(BaseModel):
    version: str | None = Field(default=None, min_length=1, max_length=50)
    scoring_rules: dict | None = None
    metric_definitions: dict | None = None
    mediapipe_config: dict | None = None
    summary_template: dict | None = None
    status: str | None = Field(default=None, max_length=20)
    is_default: bool | None = None


class AdminTrainingTemplateVersionsResponse(BaseModel):
    items: list[AdminTrainingTemplateVersionRead]


class AdminTemplateExampleVideoRead(BaseModel):
    public_id: UUID
    template_public_id: UUID
    template_version: str | None = None
    title: str
    description: str | None = None
    storage_provider: StorageProvider
    bucket_name: str
    object_key: str
    file_name: str
    content_type: str
    duration_seconds: float | None = None
    cover_url: str | None = None
    sort_order: int
    status: str
    created_at: datetime


class AdminTemplateExampleVideosResponse(BaseModel):
    items: list[AdminTemplateExampleVideoRead]


class AdminCreateTemplateExampleVideoRequest(BaseModel):
    template_version: str | None = Field(default=None, max_length=50)
    title: str = Field(min_length=1, max_length=100)
    description: str | None = None
    storage_provider: StorageProvider = StorageProvider.supabase
    bucket_name: str = Field(min_length=1, max_length=100)
    object_key: str = Field(min_length=1, max_length=500)
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str = Field(default="video/mp4", min_length=1, max_length=100)
    duration_seconds: float | None = Field(default=None, ge=0)
    cover_url: str | None = Field(default=None, max_length=1000)
    sort_order: int = 0
    status: str = Field(default="active", max_length=20)


class AdminUpdateTemplateExampleVideoRequest(BaseModel):
    template_version: str | None = Field(default=None, max_length=50)
    title: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    storage_provider: StorageProvider | None = None
    bucket_name: str | None = Field(default=None, min_length=1, max_length=100)
    object_key: str | None = Field(default=None, min_length=1, max_length=500)
    file_name: str | None = Field(default=None, min_length=1, max_length=255)
    content_type: str | None = Field(default=None, min_length=1, max_length=100)
    duration_seconds: float | None = Field(default=None, ge=0)
    cover_url: str | None = Field(default=None, max_length=1000)
    sort_order: int | None = None
    status: str | None = Field(default=None, max_length=20)
