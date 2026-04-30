from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import AnalysisType
from app.schemas.report import ReportListItem
from app.schemas.training import TrainingSessionRead
from app.schemas.user import UserRead


class TrendPointRead(BaseModel):
    date: date
    average_score: float | None = None
    best_score: float | None = None
    session_count: int


class TaskSummaryRead(BaseModel):
    public_id: UUID
    task_public_id: UUID
    class_public_id: UUID
    title: str
    status: str
    progress_percent: float | None = None
    completed_sessions: int
    best_score: float | None = None
    due_at: datetime | None = None


class AchievementSummaryRead(BaseModel):
    public_id: UUID
    achievement_public_id: UUID
    code: str
    name: str
    description: str | None = None
    icon_url: str | None = None
    unlocked_at: datetime


class DashboardStatsRead(BaseModel):
    total_reports: int
    total_sessions: int
    completed_sessions: int
    weekly_sessions: int
    best_score: float | None = None
    average_score: float | None = None
    active_tasks: int
    unread_notifications: int


class MeDashboardResponse(BaseModel):
    user: UserRead
    stats: DashboardStatsRead
    recent_reports: list[ReportListItem]
    recent_sessions: list[TrainingSessionRead]
    active_tasks: list[TaskSummaryRead]
    recent_achievements: list[AchievementSummaryRead]


class MeReportsResponse(BaseModel):
    items: list[ReportListItem]


class MeSessionsResponse(BaseModel):
    items: list[TrainingSessionRead]


class MeTasksResponse(BaseModel):
    items: list[TaskSummaryRead]


class MeAchievementsResponse(BaseModel):
    items: list[AchievementSummaryRead]


class MeTrendsResponse(BaseModel):
    range: str
    analysis_type: AnalysisType | None = None
    points: list[TrendPointRead]
