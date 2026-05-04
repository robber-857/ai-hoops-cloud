from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.analysis_report import AnalysisReport
from app.models.notification import Notification
from app.models.student_achievement import StudentAchievement
from app.models.student_growth_snapshot import StudentGrowthSnapshot
from app.models.training_session import TrainingSession
from app.models.training_task import TrainingTask
from app.models.training_task_assignment import TrainingTaskAssignment
from app.models.user import User
from app.schemas.me import (
    AchievementSummaryRead,
    DashboardStatsRead,
    MeAchievementsResponse,
    MeDashboardResponse,
    MeReportsResponse,
    MeSessionsResponse,
    MeTasksResponse,
    MeTrendsResponse,
    TaskSummaryRead,
    TrendPointRead,
)
from app.schemas.report import ReportListItem
from app.schemas.training import TrainingSessionRead
from app.schemas.user import UserRead
from app.services.report_service import _report_list_item
from app.services.training_service import _session_read


def _numeric_to_float(value: Decimal | float | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _task_summary(item: TrainingTaskAssignment) -> TaskSummaryRead:
    return TaskSummaryRead(
        public_id=item.public_id,
        task_public_id=item.task.public_id,
        class_public_id=item.camp_class.public_id,
        title=item.task.title,
        status=item.status,
        progress_percent=_numeric_to_float(item.progress_percent),
        completed_sessions=int(item.completed_sessions),
        best_score=_numeric_to_float(item.best_score),
        due_at=item.task.due_at,
    )


def _achievement_summary(item: StudentAchievement) -> AchievementSummaryRead:
    return AchievementSummaryRead(
        public_id=item.public_id,
        achievement_public_id=item.achievement.public_id,
        code=item.achievement.code,
        name=item.achievement.name,
        description=item.achievement.description,
        icon_url=item.achievement.icon_url,
        unlocked_at=item.unlocked_at,
    )


class MeService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_dashboard(self, current_user: User) -> MeDashboardResponse:
        recent_reports = self._get_recent_reports(current_user.id, limit=6)
        recent_sessions = self._get_recent_sessions(current_user.id, limit=6)
        active_tasks = self._get_active_tasks(current_user.id, limit=5)
        recent_achievements = self._get_recent_achievements(current_user.id, limit=5)
        stats = self._build_stats(current_user.id)

        return MeDashboardResponse(
            user=UserRead.model_validate(current_user),
            stats=stats,
            recent_reports=recent_reports,
            recent_sessions=recent_sessions,
            active_tasks=active_tasks,
            recent_achievements=recent_achievements,
        )

    def get_reports(self, current_user: User, limit: int = 20) -> MeReportsResponse:
        return MeReportsResponse(items=self._get_recent_reports(current_user.id, limit=limit))

    def get_sessions(self, current_user: User, limit: int = 20) -> MeSessionsResponse:
        return MeSessionsResponse(items=self._get_recent_sessions(current_user.id, limit=limit))

    def get_tasks(self, current_user: User, limit: int = 20) -> MeTasksResponse:
        return MeTasksResponse(items=self._get_active_tasks(current_user.id, limit=limit, include_completed=True))

    def get_achievements(self, current_user: User, limit: int = 20) -> MeAchievementsResponse:
        return MeAchievementsResponse(items=self._get_recent_achievements(current_user.id, limit=limit))

    def get_trends(
        self,
        current_user: User,
        range_value: str,
        analysis_type,
    ) -> MeTrendsResponse:
        days = self._parse_range_days(range_value)
        start_date = datetime.now(timezone.utc).date() - timedelta(days=days - 1)

        snapshots = self.db.scalars(
            select(StudentGrowthSnapshot)
            .where(
                StudentGrowthSnapshot.student_id == current_user.id,
                StudentGrowthSnapshot.period_type == "day",
                StudentGrowthSnapshot.snapshot_date >= start_date,
                StudentGrowthSnapshot.analysis_type == analysis_type if analysis_type else True,
            )
            .order_by(StudentGrowthSnapshot.snapshot_date.asc())
        ).all()

        if snapshots:
            points = [
                TrendPointRead(
                    date=item.snapshot_date,
                    average_score=_numeric_to_float(item.average_score),
                    best_score=_numeric_to_float(item.best_score),
                    session_count=int(item.session_count),
                )
                for item in snapshots
            ]
            return MeTrendsResponse(range=range_value, analysis_type=analysis_type, points=points)

        reports = self.db.scalars(
            select(AnalysisReport)
            .where(
                AnalysisReport.user_id == current_user.id,
                AnalysisReport.created_at >= datetime.now(timezone.utc) - timedelta(days=days),
                AnalysisReport.analysis_type == analysis_type if analysis_type else True,
            )
            .order_by(AnalysisReport.created_at.asc())
        ).all()
        grouped: dict[date, list[float]] = {}
        for report in reports:
            report_day = report.created_at.date()
            grouped.setdefault(report_day, [])
            if report.overall_score is not None:
                grouped[report_day].append(float(report.overall_score))

        points = []
        for day in sorted(grouped.keys()):
            scores = grouped[day]
            points.append(
                TrendPointRead(
                    date=day,
                    average_score=round(sum(scores) / len(scores), 2) if scores else None,
                    best_score=max(scores) if scores else None,
                    session_count=len(scores),
                )
            )
        return MeTrendsResponse(range=range_value, analysis_type=analysis_type, points=points)

    def _build_stats(self, user_id: int) -> DashboardStatsRead:
        now = datetime.now(timezone.utc)
        weekly_since = now - timedelta(days=7)

        total_reports = self.db.scalar(select(func.count(AnalysisReport.id)).where(AnalysisReport.user_id == user_id)) or 0
        total_sessions = self.db.scalar(select(func.count(TrainingSession.id)).where(TrainingSession.student_id == user_id)) or 0
        completed_sessions = self.db.scalar(
            select(func.count(TrainingSession.id)).where(
                TrainingSession.student_id == user_id,
                TrainingSession.status == "completed",
            )
        ) or 0
        weekly_sessions = self.db.scalar(
            select(func.count(TrainingSession.id)).where(
                TrainingSession.student_id == user_id,
                TrainingSession.created_at >= weekly_since,
            )
        ) or 0
        best_score = self.db.scalar(select(func.max(AnalysisReport.overall_score)).where(AnalysisReport.user_id == user_id))
        average_score = self.db.scalar(select(func.avg(AnalysisReport.overall_score)).where(AnalysisReport.user_id == user_id))
        active_tasks = self.db.scalar(
            select(func.count(TrainingTaskAssignment.id))
            .join(TrainingTask, TrainingTaskAssignment.task_id == TrainingTask.id)
            .where(
                TrainingTaskAssignment.student_id == user_id,
                TrainingTaskAssignment.status.in_(["pending", "in_progress", "overdue"]),
                TrainingTask.status == "published",
            )
        ) or 0
        unread_notifications = self.db.scalar(
            select(func.count(Notification.id)).where(Notification.user_id == user_id, Notification.is_read.is_(False))
        ) or 0

        return DashboardStatsRead(
            total_reports=int(total_reports),
            total_sessions=int(total_sessions),
            completed_sessions=int(completed_sessions),
            weekly_sessions=int(weekly_sessions),
            best_score=_numeric_to_float(best_score),
            average_score=round(float(average_score), 2) if average_score is not None else None,
            active_tasks=int(active_tasks),
            unread_notifications=int(unread_notifications),
        )

    def _get_recent_reports(self, user_id: int, limit: int) -> list[ReportListItem]:
        reports = self.db.scalars(
            select(AnalysisReport)
            .options(selectinload(AnalysisReport.session), selectinload(AnalysisReport.video))
            .where(AnalysisReport.user_id == user_id)
            .order_by(AnalysisReport.created_at.desc())
            .limit(limit)
        ).all()
        return [_report_list_item(report) for report in reports]

    def _get_recent_sessions(self, user_id: int, limit: int) -> list[TrainingSessionRead]:
        sessions = self.db.scalars(
            select(TrainingSession)
            .options(
                selectinload(TrainingSession.student),
                selectinload(TrainingSession.camp_class),
                selectinload(TrainingSession.task_assignment),
                selectinload(TrainingSession.video),
            )
            .where(TrainingSession.student_id == user_id)
            .order_by(TrainingSession.created_at.desc())
            .limit(limit)
        ).all()
        return [_session_read(session) for session in sessions]

    def _get_active_tasks(self, user_id: int, limit: int, include_completed: bool = False) -> list[TaskSummaryRead]:
        statuses = ["pending", "in_progress", "overdue"]
        if include_completed:
            statuses.append("completed")
        tasks = self.db.scalars(
            select(TrainingTaskAssignment)
            .join(TrainingTask, TrainingTaskAssignment.task_id == TrainingTask.id)
            .options(
                selectinload(TrainingTaskAssignment.task),
                selectinload(TrainingTaskAssignment.camp_class),
            )
            .where(
                TrainingTaskAssignment.student_id == user_id,
                TrainingTaskAssignment.status.in_(statuses),
                TrainingTask.status == "published",
            )
            .order_by(TrainingTaskAssignment.created_at.desc())
            .limit(limit)
        ).all()
        return [_task_summary(item) for item in tasks]

    def _get_recent_achievements(self, user_id: int, limit: int) -> list[AchievementSummaryRead]:
        achievements = self.db.scalars(
            select(StudentAchievement)
            .options(selectinload(StudentAchievement.achievement))
            .where(StudentAchievement.student_id == user_id)
            .order_by(StudentAchievement.unlocked_at.desc())
            .limit(limit)
        ).all()
        return [_achievement_summary(item) for item in achievements]

    def _parse_range_days(self, range_value: str) -> int:
        mapping = {"7d": 7, "30d": 30, "90d": 90}
        return mapping.get(range_value, 30)
