from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.analysis_report import AnalysisReport
from app.models.announcement import Announcement
from app.models.announcement_read import AnnouncementRead
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.enums import ReportStatus, UserRole
from app.models.notification import Notification
from app.models.student_achievement import StudentAchievement
from app.models.student_growth_snapshot import StudentGrowthSnapshot
from app.models.training_session import TrainingSession
from app.models.training_task import TrainingTask
from app.models.training_task_assignment import TrainingTaskAssignment
from app.models.user import User
from app.schemas.me import (
    AchievementSummaryRead,
    AnnouncementSummaryRead,
    DashboardStatsRead,
    MeAnnouncementsResponse,
    MeAchievementsResponse,
    MeDashboardResponse,
    MeReportsResponse,
    MeSessionsResponse,
    MeTasksResponse,
    MeTrendsResponse,
    MeNotificationsResponse,
    NotificationSummaryRead,
    SubmitTaskReportRequest,
    TaskDetailRead,
    TaskSubmissionReportRead,
    TaskSummaryRead,
    TrendPointRead,
)
from app.schemas.report import ReportListItem
from app.schemas.training import TrainingSessionRead
from app.schemas.user import UserRead
from app.services.report_service import ReportService, _report_list_item
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
        class_name=item.camp_class.name,
        title=item.task.title,
        description=item.task.description,
        analysis_type=item.task.analysis_type,
        template_code=item.task.template_code,
        target_config=item.task.target_config,
        status=item.status,
        progress_percent=_numeric_to_float(item.progress_percent),
        completed_sessions=int(item.completed_sessions),
        best_score=_numeric_to_float(item.best_score),
        latest_report_public_id=item.latest_report.public_id if item.latest_report else None,
        completed_at=item.completed_at,
        last_submission_at=item.last_submission_at,
        due_at=item.task.due_at,
    )


def _task_submission_report(report: AnalysisReport) -> TaskSubmissionReportRead:
    return TaskSubmissionReportRead(
        report_public_id=report.public_id,
        session_public_id=report.session.public_id,
        video_public_id=report.video.public_id,
        analysis_type=report.analysis_type,
        template_code=report.template_id,
        template_version=report.template_version,
        overall_score=_numeric_to_float(report.overall_score),
        grade=report.grade,
        submitted_at=report.analysis_finished_at or report.created_at,
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


def _role_from_value(value: str | None) -> UserRole | None:
    if value is None:
        return None
    try:
        return UserRole(value)
    except ValueError:
        return None


def _announcement_summary(item: Announcement, is_read: bool) -> AnnouncementSummaryRead:
    return AnnouncementSummaryRead(
        public_id=item.public_id,
        scope_type=item.scope_type,
        target_role=_role_from_value(item.target_role),
        camp_public_id=item.camp.public_id if item.camp else None,
        camp_name=item.camp.name if item.camp else None,
        class_public_id=item.camp_class.public_id if item.camp_class else None,
        class_name=item.camp_class.name if item.camp_class else None,
        title=item.title,
        content=item.content,
        is_pinned=item.is_pinned,
        publish_at=item.publish_at,
        expire_at=item.expire_at,
        is_read=is_read,
        created_at=item.created_at,
    )


def _notification_summary(item: Notification) -> NotificationSummaryRead:
    return NotificationSummaryRead(
        public_id=item.public_id,
        type=item.type,
        title=item.title,
        content=item.content,
        business_type=item.business_type,
        business_id=item.business_id,
        is_read=item.is_read,
        read_at=item.read_at,
        created_at=item.created_at,
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

    def get_task(self, current_user: User, assignment_public_id: UUID) -> TaskDetailRead:
        assignment = self._get_visible_task_assignment(current_user, assignment_public_id)
        return self._task_detail(assignment)

    def submit_task_report(
        self,
        current_user: User,
        assignment_public_id: UUID,
        payload: SubmitTaskReportRequest,
    ) -> TaskDetailRead:
        assignment = self._get_visible_task_assignment(current_user, assignment_public_id)
        report = self.db.scalar(
            select(AnalysisReport)
            .options(selectinload(AnalysisReport.session))
            .where(
                AnalysisReport.public_id == payload.report_public_id,
                AnalysisReport.user_id == current_user.id,
                AnalysisReport.status == ReportStatus.completed,
            )
        )
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Completed report not found.",
            )

        if assignment.task.analysis_type and report.analysis_type != assignment.task.analysis_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Report analysis type does not match this task.",
            )

        if assignment.task.template_code and report.template_id != assignment.task.template_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Report template does not match this task.",
            )

        session = report.session
        if session.task_assignment_id not in (None, assignment.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Report is already linked to another task.",
            )

        session.task_assignment_id = assignment.id
        session.class_id = assignment.class_id
        session.camp_id = assignment.task.camp_id
        session.source_type = "coach_task"
        self.db.add(session)

        ReportService(self.db)._update_task_assignment(assignment)  # noqa: SLF001
        self.db.commit()

        refreshed_assignment = self._get_visible_task_assignment(current_user, assignment_public_id)
        return self._task_detail(refreshed_assignment)

    def get_achievements(self, current_user: User, limit: int = 20) -> MeAchievementsResponse:
        return MeAchievementsResponse(items=self._get_recent_achievements(current_user.id, limit=limit))

    def get_announcements(self, current_user: User, limit: int = 20) -> MeAnnouncementsResponse:
        filters = self._announcement_visibility_filters(current_user)
        read_exists = (
            select(AnnouncementRead.id)
            .where(
                AnnouncementRead.announcement_id == Announcement.id,
                AnnouncementRead.user_id == current_user.id,
            )
            .exists()
        )

        announcements = self.db.scalars(
            select(Announcement)
            .options(
                selectinload(Announcement.camp),
                selectinload(Announcement.camp_class),
            )
            .where(*filters)
            .order_by(
                Announcement.is_pinned.desc(),
                Announcement.publish_at.desc(),
                Announcement.created_at.desc(),
            )
            .limit(min(max(limit, 1), 100))
        ).all()
        read_ids = set(
            self.db.scalars(
                select(AnnouncementRead.announcement_id).where(
                    AnnouncementRead.user_id == current_user.id,
                    AnnouncementRead.announcement_id.in_([item.id for item in announcements]),
                )
            ).all()
        )
        unread_count = self.db.scalar(
            select(func.count(Announcement.id)).where(*filters, ~read_exists)
        ) or 0

        return MeAnnouncementsResponse(
            items=[
                _announcement_summary(announcement, announcement.id in read_ids)
                for announcement in announcements
            ],
            unread_count=int(unread_count),
        )

    def get_notifications(self, current_user: User, limit: int = 20) -> MeNotificationsResponse:
        notifications = self.db.scalars(
            select(Notification)
            .where(Notification.user_id == current_user.id)
            .order_by(Notification.is_read.asc(), Notification.created_at.desc())
            .limit(min(max(limit, 1), 100))
        ).all()
        unread_count = self.db.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == current_user.id,
                Notification.is_read.is_(False),
            )
        ) or 0

        return MeNotificationsResponse(
            items=[_notification_summary(notification) for notification in notifications],
            unread_count=int(unread_count),
        )

    def mark_announcement_read(
        self,
        current_user: User,
        announcement_public_id: UUID,
    ) -> AnnouncementSummaryRead:
        announcement = self._get_visible_announcement(current_user, announcement_public_id)
        now = datetime.now(timezone.utc)
        read = self.db.scalar(
            select(AnnouncementRead).where(
                AnnouncementRead.announcement_id == announcement.id,
                AnnouncementRead.user_id == current_user.id,
            )
        )
        if not read:
            self.db.add(
                AnnouncementRead(
                    announcement_id=announcement.id,
                    user_id=current_user.id,
                    read_at=now,
                )
            )

        notifications = self.db.scalars(
            select(Notification).where(
                Notification.user_id == current_user.id,
                Notification.business_type == "announcement",
                Notification.business_id == announcement.id,
                Notification.is_read.is_(False),
            )
        ).all()
        for notification in notifications:
            notification.is_read = True
            notification.read_at = now
            self.db.add(notification)

        self.db.commit()
        return _announcement_summary(announcement, True)

    def mark_notification_read(
        self,
        current_user: User,
        notification_public_id: UUID,
    ) -> NotificationSummaryRead:
        notification = self.db.scalar(
            select(Notification).where(
                Notification.public_id == notification_public_id,
                Notification.user_id == current_user.id,
            )
        )
        if not notification:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found.",
            )

        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.now(timezone.utc)
            self.db.add(notification)
            self.db.commit()
            self.db.refresh(notification)

        return _notification_summary(notification)

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
                selectinload(TrainingTaskAssignment.latest_report),
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

    def _task_detail(self, assignment: TrainingTaskAssignment) -> TaskDetailRead:
        summary = _task_summary(assignment)
        return TaskDetailRead(
            **summary.model_dump(),
            submission_reports=self._get_task_submission_reports(assignment.id),
        )

    def _get_task_submission_reports(
        self,
        assignment_id: int,
        limit: int = 20,
    ) -> list[TaskSubmissionReportRead]:
        reports = self.db.scalars(
            select(AnalysisReport)
            .join(TrainingSession, AnalysisReport.session_id == TrainingSession.id)
            .options(
                selectinload(AnalysisReport.session),
                selectinload(AnalysisReport.video),
            )
            .where(
                TrainingSession.task_assignment_id == assignment_id,
                AnalysisReport.status == ReportStatus.completed,
            )
            .order_by(
                func.coalesce(AnalysisReport.analysis_finished_at, AnalysisReport.created_at).desc(),
                AnalysisReport.created_at.desc(),
            )
            .limit(limit)
        ).all()
        return [_task_submission_report(report) for report in reports]

    def _get_visible_task_assignment(
        self,
        current_user: User,
        assignment_public_id: UUID,
    ) -> TrainingTaskAssignment:
        assignment = self.db.scalar(
            select(TrainingTaskAssignment)
            .join(TrainingTask, TrainingTaskAssignment.task_id == TrainingTask.id)
            .options(
                selectinload(TrainingTaskAssignment.task),
                selectinload(TrainingTaskAssignment.camp_class),
                selectinload(TrainingTaskAssignment.latest_report),
            )
            .where(
                TrainingTaskAssignment.public_id == assignment_public_id,
                TrainingTaskAssignment.student_id == current_user.id,
                TrainingTask.status == "published",
            )
        )
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Training task assignment not found.",
            )
        return assignment

    def _get_recent_achievements(self, user_id: int, limit: int) -> list[AchievementSummaryRead]:
        achievements = self.db.scalars(
            select(StudentAchievement)
            .options(selectinload(StudentAchievement.achievement))
            .where(StudentAchievement.student_id == user_id)
            .order_by(StudentAchievement.unlocked_at.desc())
            .limit(limit)
        ).all()
        return [_achievement_summary(item) for item in achievements]

    def _announcement_visibility_filters(self, current_user: User):
        now = datetime.now(timezone.utc)
        memberships = self.db.execute(
            select(ClassMember.class_id, CampClass.camp_id)
            .join(CampClass, ClassMember.class_id == CampClass.id)
            .where(
                ClassMember.user_id == current_user.id,
                ClassMember.status == "active",
            )
        ).all()
        class_ids = [class_id for class_id, _camp_id in memberships]
        camp_ids = list({camp_id for _class_id, camp_id in memberships if camp_id is not None})

        visibility_conditions = [
            Announcement.scope_type == "global",
            and_(
                Announcement.scope_type == "role",
                Announcement.target_role == current_user.role.value,
            ),
        ]
        if class_ids:
            visibility_conditions.append(
                and_(Announcement.scope_type == "class", Announcement.class_id.in_(class_ids))
            )
        if camp_ids:
            visibility_conditions.append(
                and_(Announcement.scope_type == "camp", Announcement.camp_id.in_(camp_ids))
            )

        return (
            Announcement.status == "published",
            or_(Announcement.publish_at.is_(None), Announcement.publish_at <= now),
            or_(Announcement.expire_at.is_(None), Announcement.expire_at > now),
            or_(*visibility_conditions),
        )

    def _get_visible_announcement(self, current_user: User, announcement_public_id: UUID) -> Announcement:
        announcement = self.db.scalar(
            select(Announcement)
            .options(
                selectinload(Announcement.camp),
                selectinload(Announcement.camp_class),
            )
            .where(
                Announcement.public_id == announcement_public_id,
                *self._announcement_visibility_filters(current_user),
            )
        )
        if not announcement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Announcement not found.",
            )
        return announcement

    def _parse_range_days(self, range_value: str) -> int:
        mapping = {"7d": 7, "30d": 30, "90d": 90}
        return mapping.get(range_value, 30)
