from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.analysis_report import AnalysisReport
from app.models.announcement import Announcement
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.enums import ReportStatus, UserRole
from app.models.notification import Notification
from app.models.training_session import TrainingSession
from app.models.training_task import TrainingTask
from app.models.training_task_assignment import TrainingTaskAssignment
from app.models.user import User
from app.schemas.coach import (
    CoachAnnouncementRead,
    CoachBulkUpdateAnnouncementsRequest,
    CoachBulkUpdateTasksRequest,
    CoachDashboardClassSnapshot,
    CoachDashboardResponse,
    CoachClassRead,
    CoachClassReportRead,
    CoachCreateAnnouncementRequest,
    CoachCreateTaskRequest,
    CoachStudentClassMembershipRead,
    CoachStudentProfileRead,
    CoachStudentRead,
    CoachStudentTaskSummary,
    CoachTaskAssignmentRead,
    CoachTaskDetailRead,
    CoachTaskRead,
    CoachUpdateAnnouncementRequest,
    CoachUpdateTaskRequest,
)


COACH_ACCESS_ROLES = {UserRole.coach, UserRole.admin}


def _numeric_to_float(value: Decimal | float | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _display_name(user: User) -> str:
    return user.nickname or user.username


def _class_read(class_row: CampClass, student_count: int) -> CoachClassRead:
    return CoachClassRead(
        public_id=class_row.public_id,
        camp_public_id=class_row.camp.public_id if class_row.camp else None,
        name=class_row.name,
        code=class_row.code,
        description=class_row.description,
        status=class_row.status,
        age_group=class_row.age_group,
        max_students=class_row.max_students,
        start_date=class_row.start_date,
        end_date=class_row.end_date,
        student_count=student_count,
        created_at=class_row.created_at,
    )


def _task_read(
    task: TrainingTask,
    class_public_id: UUID,
    assignment_status_counts: dict[str, int] | None = None,
) -> CoachTaskRead:
    status_counts = assignment_status_counts or {}
    assignment_count = sum(status_counts.values())

    return CoachTaskRead(
        public_id=task.public_id,
        class_public_id=class_public_id,
        title=task.title,
        description=task.description,
        analysis_type=task.analysis_type,
        template_code=task.template_code,
        target_config=task.target_config,
        status=task.status,
        publish_at=task.publish_at,
        start_at=task.start_at,
        due_at=task.due_at,
        assignment_count=assignment_count,
        completed_assignment_count=status_counts.get("completed", 0),
        assignment_status_counts=status_counts,
        created_at=task.created_at,
    )


def _task_assignment_read(assignment: TrainingTaskAssignment) -> CoachTaskAssignmentRead:
    return CoachTaskAssignmentRead(
        public_id=assignment.public_id,
        student_public_id=assignment.student.public_id,
        student_name=_display_name(assignment.student),
        status=assignment.status,
        progress_percent=_numeric_to_float(assignment.progress_percent),
        completed_sessions=int(assignment.completed_sessions or 0),
        best_score=_numeric_to_float(assignment.best_score),
        latest_report_public_id=assignment.latest_report.public_id if assignment.latest_report else None,
        completed_at=assignment.completed_at,
        last_submission_at=assignment.last_submission_at,
        created_at=assignment.created_at,
    )


def _task_detail_read(
    task: TrainingTask,
    class_public_id: UUID,
    assignments: list[TrainingTaskAssignment],
) -> CoachTaskDetailRead:
    status_counts: dict[str, int] = {}
    for assignment in assignments:
        status_counts[assignment.status] = status_counts.get(assignment.status, 0) + 1

    return CoachTaskDetailRead(
        **_task_read(task, class_public_id, status_counts).model_dump(),
        assignments=[_task_assignment_read(assignment) for assignment in assignments],
    )


def _announcement_read(announcement: Announcement, class_public_id: UUID) -> CoachAnnouncementRead:
    return CoachAnnouncementRead(
        public_id=announcement.public_id,
        class_public_id=class_public_id,
        title=announcement.title,
        content=announcement.content,
        status=announcement.status,
        is_pinned=announcement.is_pinned,
        publish_at=announcement.publish_at,
        expire_at=announcement.expire_at,
        created_at=announcement.created_at,
    )


class CoachService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_classes(self, current_user: User) -> list[CoachClassRead]:
        classes = self._list_accessible_class_rows(current_user)
        student_counts = self._student_counts([class_row.id for class_row in classes])
        return [_class_read(class_row, student_counts.get(class_row.id, 0)) for class_row in classes]

    def list_class_students(self, current_user: User, class_public_id: UUID) -> list[CoachStudentRead]:
        class_row = self._get_accessible_class(current_user, class_public_id)
        members = self.db.scalars(
            select(ClassMember)
            .options(selectinload(ClassMember.user))
            .where(
                ClassMember.class_id == class_row.id,
                ClassMember.member_role == "student",
                ClassMember.status == "active",
            )
            .order_by(ClassMember.joined_at.desc(), ClassMember.created_at.desc())
        ).all()

        student_ids = [member.user_id for member in members]
        report_stats = self._student_report_stats(class_row.id, student_ids)

        return [
            CoachStudentRead(
                public_id=member.user.public_id,
                username=member.user.username,
                nickname=member.user.nickname,
                email=member.user.email,
                phone_number=member.user.phone_number,
                status=member.user.status.value,
                joined_at=member.joined_at,
                report_count=report_stats.get(member.user_id, {}).get("report_count", 0),
                last_report_at=report_stats.get(member.user_id, {}).get("last_report_at"),
                best_score=report_stats.get(member.user_id, {}).get("best_score"),
            )
            for member in members
        ]

    def list_class_reports(
        self,
        current_user: User,
        class_public_id: UUID,
        limit: int = 50,
    ) -> list[CoachClassReportRead]:
        class_row = self._get_accessible_class(current_user, class_public_id)
        reports = self.db.scalars(
            select(AnalysisReport)
            .join(TrainingSession, AnalysisReport.session_id == TrainingSession.id)
            .options(
                selectinload(AnalysisReport.session).selectinload(TrainingSession.student),
                selectinload(AnalysisReport.video),
            )
            .where(TrainingSession.class_id == class_row.id)
            .order_by(AnalysisReport.created_at.desc())
            .limit(limit)
        ).all()

        return [self._class_report_read(report) for report in reports]

    def create_class_task(
        self,
        current_user: User,
        class_public_id: UUID,
        payload: CoachCreateTaskRequest,
    ) -> CoachTaskRead:
        class_row = self._get_accessible_class(current_user, class_public_id)
        now = datetime.now(timezone.utc)

        task = TrainingTask(
            camp_id=class_row.camp_id,
            class_id=class_row.id,
            created_by_user_id=current_user.id,
            title=payload.title,
            description=payload.description,
            analysis_type=payload.analysis_type,
            template_code=payload.template_code,
            target_config=payload.target_config,
            status=payload.status,
            publish_at=payload.publish_at or now,
            start_at=payload.start_at,
            due_at=payload.due_at,
        )
        self.db.add(task)
        self.db.flush()

        student_members = self.db.scalars(
            select(ClassMember).where(
                ClassMember.class_id == class_row.id,
                ClassMember.member_role == "student",
                ClassMember.status == "active",
            )
        ).all()

        for member in student_members:
            self.db.add(
                TrainingTaskAssignment(
                    task_id=task.id,
                    student_id=member.user_id,
                    class_id=class_row.id,
                    status="pending",
                    progress_percent=0,
                    completed_sessions=0,
                )
            )

        self._create_notifications(
            [member.user_id for member in student_members],
            notification_type="task",
            title=f"New training task: {task.title}",
            content=task.description,
            business_type="training_task",
            business_id=task.id,
        )

        self.db.commit()
        self.db.refresh(task)
        return _task_read(task, class_row.public_id, {"pending": len(student_members)})

    def create_class_announcement(
        self,
        current_user: User,
        class_public_id: UUID,
        payload: CoachCreateAnnouncementRequest,
    ) -> CoachAnnouncementRead:
        class_row = self._get_accessible_class(current_user, class_public_id)
        now = datetime.now(timezone.utc)

        announcement = Announcement(
            publisher_user_id=current_user.id,
            scope_type="class",
            camp_id=class_row.camp_id,
            class_id=class_row.id,
            title=payload.title,
            content=payload.content,
            status=payload.status,
            is_pinned=payload.is_pinned,
            publish_at=payload.publish_at or now,
            expire_at=payload.expire_at,
        )
        self.db.add(announcement)
        self.db.flush()

        class_members = self.db.scalars(
            select(ClassMember).where(
                ClassMember.class_id == class_row.id,
                ClassMember.status == "active",
            )
        ).all()
        self._create_notifications(
            [member.user_id for member in class_members if member.user_id != current_user.id],
            notification_type="announcement",
            title=announcement.title,
            content=announcement.content,
            business_type="announcement",
            business_id=announcement.id,
        )

        self.db.commit()
        self.db.refresh(announcement)
        return _announcement_read(announcement, class_row.public_id)

    def list_class_tasks(
        self,
        current_user: User,
        class_public_id: UUID,
        limit: int = 50,
        task_status: str | None = None,
        analysis_type: str | None = None,
        keyword: str | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
    ) -> list[CoachTaskRead]:
        class_row = self._get_accessible_class(current_user, class_public_id)
        stmt = select(TrainingTask).where(TrainingTask.class_id == class_row.id)

        if task_status:
            stmt = stmt.where(TrainingTask.status == task_status)
        if analysis_type:
            stmt = stmt.where(TrainingTask.analysis_type == analysis_type)
        if keyword:
            pattern = f"%{keyword.strip()}%"
            stmt = stmt.where(
                or_(
                    TrainingTask.title.ilike(pattern),
                    TrainingTask.description.ilike(pattern),
                    TrainingTask.template_code.ilike(pattern),
                )
            )
        if from_date:
            stmt = stmt.where(TrainingTask.due_at >= from_date)
        if to_date:
            stmt = stmt.where(TrainingTask.due_at <= to_date)

        tasks = self.db.scalars(stmt.order_by(TrainingTask.created_at.desc()).limit(limit)).all()
        status_counts_by_task = self._assignment_status_counts([task.id for task in tasks])
        return [
            _task_read(task, class_row.public_id, status_counts_by_task.get(task.id, {}))
            for task in tasks
        ]

    def bulk_update_class_tasks(
        self,
        current_user: User,
        class_public_id: UUID,
        payload: CoachBulkUpdateTasksRequest,
    ) -> list[CoachTaskRead]:
        class_row = self._get_accessible_class(current_user, class_public_id)
        tasks = self.db.scalars(
            select(TrainingTask).where(
                TrainingTask.class_id == class_row.id,
                TrainingTask.public_id.in_(payload.task_public_ids),
            )
        ).all()

        if len(tasks) != len(set(payload.task_public_ids)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Some tasks were not found.")

        for task in tasks:
            task.status = payload.status
            self.db.add(task)

        self.db.commit()
        for task in tasks:
            self.db.refresh(task)

        status_counts_by_task = self._assignment_status_counts([task.id for task in tasks])
        return [
            _task_read(task, class_row.public_id, status_counts_by_task.get(task.id, {}))
            for task in tasks
        ]

    def get_class_task(
        self,
        current_user: User,
        class_public_id: UUID,
        task_public_id: UUID,
    ) -> CoachTaskDetailRead:
        class_row = self._get_accessible_class(current_user, class_public_id)
        task = self._get_class_task(class_row.id, task_public_id)
        assignments = self._list_task_assignments(task.id)
        return _task_detail_read(task, class_row.public_id, assignments)

    def update_class_task(
        self,
        current_user: User,
        class_public_id: UUID,
        task_public_id: UUID,
        payload: CoachUpdateTaskRequest,
    ) -> CoachTaskDetailRead:
        class_row = self._get_accessible_class(current_user, class_public_id)
        task = self._get_class_task(class_row.id, task_public_id)
        fields_set = payload.model_fields_set

        if "title" in fields_set and payload.title is not None:
            task.title = payload.title
        if "description" in fields_set:
            task.description = payload.description
        if "analysis_type" in fields_set:
            task.analysis_type = payload.analysis_type
        if "template_code" in fields_set:
            task.template_code = payload.template_code
        if "target_config" in fields_set:
            task.target_config = payload.target_config
        if "status" in fields_set and payload.status is not None:
            task.status = payload.status
        if "publish_at" in fields_set:
            task.publish_at = payload.publish_at
        if "start_at" in fields_set:
            task.start_at = payload.start_at
        if "due_at" in fields_set:
            task.due_at = payload.due_at

        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        assignments = self._list_task_assignments(task.id)
        return _task_detail_read(task, class_row.public_id, assignments)

    def list_class_announcements(
        self,
        current_user: User,
        class_public_id: UUID,
        limit: int = 50,
        announcement_status: str | None = None,
        is_pinned: bool | None = None,
        keyword: str | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
    ) -> list[CoachAnnouncementRead]:
        class_row = self._get_accessible_class(current_user, class_public_id)
        stmt = select(Announcement).where(Announcement.class_id == class_row.id)

        if announcement_status:
            stmt = stmt.where(Announcement.status == announcement_status)
        if is_pinned is not None:
            stmt = stmt.where(Announcement.is_pinned == is_pinned)
        if keyword:
            pattern = f"%{keyword.strip()}%"
            stmt = stmt.where(
                or_(
                    Announcement.title.ilike(pattern),
                    Announcement.content.ilike(pattern),
                )
            )
        if from_date:
            stmt = stmt.where(Announcement.publish_at >= from_date)
        if to_date:
            stmt = stmt.where(Announcement.publish_at <= to_date)

        announcements = self.db.scalars(
            stmt.order_by(
                Announcement.is_pinned.desc(),
                Announcement.publish_at.desc(),
                Announcement.created_at.desc(),
            ).limit(limit)
        ).all()
        return [_announcement_read(announcement, class_row.public_id) for announcement in announcements]

    def bulk_update_class_announcements(
        self,
        current_user: User,
        class_public_id: UUID,
        payload: CoachBulkUpdateAnnouncementsRequest,
    ) -> list[CoachAnnouncementRead]:
        class_row = self._get_accessible_class(current_user, class_public_id)
        if payload.status is None and payload.is_pinned is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one update field is required.",
            )

        announcements = self.db.scalars(
            select(Announcement).where(
                Announcement.class_id == class_row.id,
                Announcement.public_id.in_(payload.announcement_public_ids),
            )
        ).all()

        if len(announcements) != len(set(payload.announcement_public_ids)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Some announcements were not found.")

        for announcement in announcements:
            if payload.status is not None:
                announcement.status = payload.status
            if payload.is_pinned is not None:
                announcement.is_pinned = payload.is_pinned
            self.db.add(announcement)

        self.db.commit()
        for announcement in announcements:
            self.db.refresh(announcement)

        return [_announcement_read(announcement, class_row.public_id) for announcement in announcements]

    def update_class_announcement(
        self,
        current_user: User,
        class_public_id: UUID,
        announcement_public_id: UUID,
        payload: CoachUpdateAnnouncementRequest,
    ) -> CoachAnnouncementRead:
        class_row = self._get_accessible_class(current_user, class_public_id)
        announcement = self.db.scalar(
            select(Announcement).where(
                Announcement.class_id == class_row.id,
                Announcement.public_id == announcement_public_id,
            )
        )
        if not announcement:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found.")

        fields_set = payload.model_fields_set
        if "title" in fields_set and payload.title is not None:
            announcement.title = payload.title
        if "content" in fields_set and payload.content is not None:
            announcement.content = payload.content
        if "status" in fields_set and payload.status is not None:
            announcement.status = payload.status
        if "is_pinned" in fields_set and payload.is_pinned is not None:
            announcement.is_pinned = payload.is_pinned
        if "publish_at" in fields_set:
            announcement.publish_at = payload.publish_at
        if "expire_at" in fields_set:
            announcement.expire_at = payload.expire_at

        self.db.add(announcement)
        self.db.commit()
        self.db.refresh(announcement)
        return _announcement_read(announcement, class_row.public_id)

    def get_student_profile(
        self,
        current_user: User,
        student_public_id: UUID,
    ) -> CoachStudentProfileRead:
        student, memberships = self._get_accessible_student_memberships(current_user, student_public_id)
        class_ids = [membership.class_id for membership in memberships]
        report_stats = self._student_report_stats_for_classes(student.id, class_ids)
        task_summary = self._student_task_summary(student.id, class_ids)

        return CoachStudentProfileRead(
            public_id=student.public_id,
            username=student.username,
            nickname=student.nickname,
            email=student.email,
            phone_number=student.phone_number,
            status=student.status.value,
            role=student.role.value,
            report_count=report_stats["report_count"],
            best_score=report_stats["best_score"],
            last_report_at=report_stats["last_report_at"],
            memberships=[
                CoachStudentClassMembershipRead(
                    class_public_id=membership.camp_class.public_id,
                    class_name=membership.camp_class.name,
                    class_code=membership.camp_class.code,
                    member_public_id=membership.public_id,
                    member_role=membership.member_role,
                    status=membership.status,
                    joined_at=membership.joined_at,
                )
                for membership in memberships
            ],
            task_summary=task_summary,
        )

    def list_student_reports(
        self,
        current_user: User,
        student_public_id: UUID,
        limit: int = 50,
    ) -> list[CoachClassReportRead]:
        student, memberships = self._get_accessible_student_memberships(current_user, student_public_id)
        class_ids = [membership.class_id for membership in memberships]
        if not class_ids:
            return []

        reports = self.db.scalars(
            select(AnalysisReport)
            .join(TrainingSession, AnalysisReport.session_id == TrainingSession.id)
            .options(
                selectinload(AnalysisReport.session).selectinload(TrainingSession.student),
                selectinload(AnalysisReport.video),
            )
            .where(
                AnalysisReport.user_id == student.id,
                TrainingSession.class_id.in_(class_ids),
            )
            .order_by(AnalysisReport.created_at.desc())
            .limit(limit)
        ).all()
        return [self._class_report_read(report) for report in reports]

    def get_dashboard(self, current_user: User) -> CoachDashboardResponse:
        classes = self._list_accessible_class_rows(current_user)
        class_ids = [class_row.id for class_row in classes]
        student_counts = self._student_counts(class_ids)

        if not class_ids:
            return CoachDashboardResponse(
                class_count=0,
                active_class_count=0,
                student_count=0,
                report_count=0,
                recent_report_count=0,
                task_count=0,
                open_task_count=0,
                announcement_count=0,
                class_snapshots=[],
            )

        recent_cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        report_count = int(
            self.db.scalar(
                select(func.count(AnalysisReport.id))
                .join(TrainingSession, AnalysisReport.session_id == TrainingSession.id)
                .where(TrainingSession.class_id.in_(class_ids))
            )
            or 0
        )
        recent_report_count = int(
            self.db.scalar(
                select(func.count(AnalysisReport.id))
                .join(TrainingSession, AnalysisReport.session_id == TrainingSession.id)
                .where(
                    TrainingSession.class_id.in_(class_ids),
                    AnalysisReport.created_at >= recent_cutoff,
                )
            )
            or 0
        )
        task_count = int(
            self.db.scalar(select(func.count(TrainingTask.id)).where(TrainingTask.class_id.in_(class_ids)))
            or 0
        )
        open_task_count = int(
            self.db.scalar(
                select(func.count(TrainingTask.id)).where(
                    TrainingTask.class_id.in_(class_ids),
                    TrainingTask.status.notin_(["closed", "archived"]),
                )
            )
            or 0
        )
        announcement_count = int(
            self.db.scalar(select(func.count(Announcement.id)).where(Announcement.class_id.in_(class_ids)))
            or 0
        )

        open_tasks_by_class = self._task_counts_by_class(class_ids, open_only=True)
        report_stats_by_class = self._recent_report_stats_by_class(class_ids, recent_cutoff)

        return CoachDashboardResponse(
            class_count=len(classes),
            active_class_count=sum(1 for class_row in classes if class_row.status == "active"),
            student_count=sum(student_counts.values()),
            report_count=report_count,
            recent_report_count=recent_report_count,
            task_count=task_count,
            open_task_count=open_task_count,
            announcement_count=announcement_count,
            class_snapshots=[
                CoachDashboardClassSnapshot(
                    public_id=class_row.public_id,
                    name=class_row.name,
                    code=class_row.code,
                    student_count=student_counts.get(class_row.id, 0),
                    open_task_count=open_tasks_by_class.get(class_row.id, 0),
                    recent_report_count=report_stats_by_class.get(class_row.id, {}).get("recent_report_count", 0),
                    latest_report_at=report_stats_by_class.get(class_row.id, {}).get("latest_report_at"),
                )
                for class_row in classes
            ],
        )

    def _ensure_coach_access(self, current_user: User) -> None:
        if current_user.role not in COACH_ACCESS_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Coach access is required.",
            )

    def _create_notifications(
        self,
        user_ids: list[int],
        *,
        notification_type: str,
        title: str,
        content: str | None,
        business_type: str,
        business_id: int,
    ) -> int:
        unique_user_ids = list(dict.fromkeys(user_ids))
        for user_id in unique_user_ids:
            self.db.add(
                Notification(
                    user_id=user_id,
                    type=notification_type,
                    title=title,
                    content=content,
                    business_type=business_type,
                    business_id=business_id,
                    is_read=False,
                )
            )
        return len(unique_user_ids)

    def _list_accessible_class_rows(self, current_user: User) -> list[CampClass]:
        self._ensure_coach_access(current_user)

        stmt = (
            select(CampClass)
            .options(selectinload(CampClass.camp))
            .order_by(CampClass.created_at.desc())
        )
        if current_user.role != UserRole.admin:
            stmt = stmt.join(ClassMember, ClassMember.class_id == CampClass.id).where(
                ClassMember.user_id == current_user.id,
                ClassMember.member_role == "coach",
                ClassMember.status == "active",
            )

        return self.db.scalars(stmt).unique().all()

    def _get_accessible_class(self, current_user: User, class_public_id: UUID) -> CampClass:
        self._ensure_coach_access(current_user)

        stmt = (
            select(CampClass)
            .options(selectinload(CampClass.camp))
            .where(CampClass.public_id == class_public_id)
        )
        if current_user.role != UserRole.admin:
            stmt = stmt.join(ClassMember, ClassMember.class_id == CampClass.id).where(
                ClassMember.user_id == current_user.id,
                ClassMember.member_role == "coach",
                ClassMember.status == "active",
            )

        class_row = self.db.scalar(stmt)
        if not class_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found.")
        return class_row

    def _get_class_task(self, class_id: int, task_public_id: UUID) -> TrainingTask:
        task = self.db.scalar(
            select(TrainingTask).where(
                TrainingTask.class_id == class_id,
                TrainingTask.public_id == task_public_id,
            )
        )
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
        return task

    def _list_task_assignments(self, task_id: int) -> list[TrainingTaskAssignment]:
        return self.db.scalars(
            select(TrainingTaskAssignment)
            .options(
                selectinload(TrainingTaskAssignment.student),
                selectinload(TrainingTaskAssignment.latest_report),
            )
            .where(TrainingTaskAssignment.task_id == task_id)
            .order_by(TrainingTaskAssignment.created_at.desc())
        ).all()

    def _student_counts(self, class_ids: list[int]) -> dict[int, int]:
        if not class_ids:
            return {}

        rows = self.db.execute(
            select(ClassMember.class_id, func.count(ClassMember.id))
            .where(
                ClassMember.class_id.in_(class_ids),
                ClassMember.member_role == "student",
                ClassMember.status == "active",
            )
            .group_by(ClassMember.class_id)
        ).all()
        return {class_id: int(count) for class_id, count in rows}

    def _student_report_stats(self, class_id: int, student_ids: list[int]) -> dict[int, dict]:
        if not student_ids:
            return {}

        rows = self.db.execute(
            select(
                AnalysisReport.user_id,
                func.count(AnalysisReport.id),
                func.max(func.coalesce(AnalysisReport.analysis_finished_at, AnalysisReport.created_at)),
                func.max(AnalysisReport.overall_score),
            )
            .join(TrainingSession, AnalysisReport.session_id == TrainingSession.id)
            .where(
                TrainingSession.class_id == class_id,
                AnalysisReport.user_id.in_(student_ids),
                AnalysisReport.status == ReportStatus.completed,
            )
            .group_by(AnalysisReport.user_id)
        ).all()

        return {
            user_id: {
                "report_count": int(report_count),
                "last_report_at": last_report_at,
                "best_score": _numeric_to_float(best_score),
            }
            for user_id, report_count, last_report_at, best_score in rows
        }

    def _assignment_status_counts(self, task_ids: list[int]) -> dict[int, dict[str, int]]:
        if not task_ids:
            return {}

        rows = self.db.execute(
            select(
                TrainingTaskAssignment.task_id,
                TrainingTaskAssignment.status,
                func.count(TrainingTaskAssignment.id),
            )
            .where(TrainingTaskAssignment.task_id.in_(task_ids))
            .group_by(TrainingTaskAssignment.task_id, TrainingTaskAssignment.status)
        ).all()

        counts: dict[int, dict[str, int]] = {}
        for task_id, assignment_status, count in rows:
            counts.setdefault(task_id, {})[assignment_status] = int(count)
        return counts

    def _get_accessible_student_memberships(
        self,
        current_user: User,
        student_public_id: UUID,
    ) -> tuple[User, list[ClassMember]]:
        self._ensure_coach_access(current_user)

        student = self.db.scalar(select(User).where(User.public_id == student_public_id))
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

        stmt = (
            select(ClassMember)
            .options(selectinload(ClassMember.camp_class))
            .where(
                ClassMember.user_id == student.id,
                ClassMember.member_role == "student",
                ClassMember.status == "active",
            )
            .order_by(ClassMember.joined_at.desc(), ClassMember.created_at.desc())
        )

        if current_user.role != UserRole.admin:
            coach_class_ids = (
                select(ClassMember.class_id)
                .where(
                    ClassMember.user_id == current_user.id,
                    ClassMember.member_role == "coach",
                    ClassMember.status == "active",
                )
            )
            stmt = stmt.where(ClassMember.class_id.in_(coach_class_ids))

        memberships = self.db.scalars(stmt).all()
        if current_user.role != UserRole.admin and not memberships:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")
        return student, memberships

    def _student_report_stats_for_classes(self, student_id: int, class_ids: list[int]) -> dict:
        if not class_ids:
            return {
                "report_count": 0,
                "last_report_at": None,
                "best_score": None,
            }

        row = self.db.execute(
            select(
                func.count(AnalysisReport.id),
                func.max(func.coalesce(AnalysisReport.analysis_finished_at, AnalysisReport.created_at)),
                func.max(AnalysisReport.overall_score),
            )
            .join(TrainingSession, AnalysisReport.session_id == TrainingSession.id)
            .where(
                AnalysisReport.user_id == student_id,
                TrainingSession.class_id.in_(class_ids),
                AnalysisReport.status == ReportStatus.completed,
            )
        ).one()

        report_count, last_report_at, best_score = row
        return {
            "report_count": int(report_count or 0),
            "last_report_at": last_report_at,
            "best_score": _numeric_to_float(best_score),
        }

    def _student_task_summary(self, student_id: int, class_ids: list[int]) -> CoachStudentTaskSummary:
        if not class_ids:
            return CoachStudentTaskSummary(
                assigned_count=0,
                completed_count=0,
                in_progress_count=0,
                pending_count=0,
            )

        rows = self.db.execute(
            select(
                TrainingTaskAssignment.status,
                func.count(TrainingTaskAssignment.id),
                func.max(TrainingTaskAssignment.last_submission_at),
            )
            .where(
                TrainingTaskAssignment.student_id == student_id,
                TrainingTaskAssignment.class_id.in_(class_ids),
            )
            .group_by(TrainingTaskAssignment.status)
        ).all()

        status_counts = {assignment_status: int(count) for assignment_status, count, _ in rows}
        latest_submission_at = None
        for _, _, last_submission_at in rows:
            if last_submission_at and (not latest_submission_at or last_submission_at > latest_submission_at):
                latest_submission_at = last_submission_at

        return CoachStudentTaskSummary(
            assigned_count=sum(status_counts.values()),
            completed_count=status_counts.get("completed", 0),
            in_progress_count=status_counts.get("in_progress", 0),
            pending_count=status_counts.get("pending", 0),
            latest_submission_at=latest_submission_at,
        )

    def _task_counts_by_class(self, class_ids: list[int], open_only: bool = False) -> dict[int, int]:
        if not class_ids:
            return {}

        stmt = select(TrainingTask.class_id, func.count(TrainingTask.id)).where(
            TrainingTask.class_id.in_(class_ids)
        )
        if open_only:
            stmt = stmt.where(TrainingTask.status.notin_(["closed", "archived"]))

        rows = self.db.execute(stmt.group_by(TrainingTask.class_id)).all()
        return {class_id: int(count) for class_id, count in rows}

    def _recent_report_stats_by_class(
        self,
        class_ids: list[int],
        recent_cutoff: datetime,
    ) -> dict[int, dict]:
        if not class_ids:
            return {}

        rows = self.db.execute(
            select(
                TrainingSession.class_id,
                func.count(AnalysisReport.id),
                func.max(func.coalesce(AnalysisReport.analysis_finished_at, AnalysisReport.created_at)),
            )
            .join(TrainingSession, AnalysisReport.session_id == TrainingSession.id)
            .where(
                TrainingSession.class_id.in_(class_ids),
                AnalysisReport.created_at >= recent_cutoff,
            )
            .group_by(TrainingSession.class_id)
        ).all()

        return {
            class_id: {
                "recent_report_count": int(recent_report_count),
                "latest_report_at": latest_report_at,
            }
            for class_id, recent_report_count, latest_report_at in rows
        }

    def _class_report_read(self, report: AnalysisReport) -> CoachClassReportRead:
        video_url = report.video.cdn_url or report.video.url if report.video else None
        student = report.session.student

        return CoachClassReportRead(
            public_id=report.public_id,
            session_public_id=report.session.public_id,
            video_public_id=report.video.public_id,
            student_public_id=student.public_id,
            student_name=_display_name(student),
            analysis_type=report.analysis_type,
            template_code=report.template_id,
            template_version=report.template_version,
            overall_score=_numeric_to_float(report.overall_score),
            grade=report.grade,
            status=report.status.value,
            video_url=video_url,
            created_at=report.created_at,
            analysis_finished_at=report.analysis_finished_at,
        )
