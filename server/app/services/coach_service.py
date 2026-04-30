from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.analysis_report import AnalysisReport
from app.models.announcement import Announcement
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.enums import ReportStatus, UserRole
from app.models.training_session import TrainingSession
from app.models.training_task import TrainingTask
from app.models.training_task_assignment import TrainingTaskAssignment
from app.models.user import User
from app.schemas.coach import (
    CoachAnnouncementRead,
    CoachClassRead,
    CoachClassReportRead,
    CoachCreateAnnouncementRequest,
    CoachCreateTaskRequest,
    CoachStudentRead,
    CoachTaskRead,
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


def _task_read(task: TrainingTask, class_public_id: UUID, assignment_count: int) -> CoachTaskRead:
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
        created_at=task.created_at,
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

        classes = self.db.scalars(stmt).unique().all()
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

        self.db.commit()
        self.db.refresh(task)
        return _task_read(task, class_row.public_id, len(student_members))

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
        self.db.commit()
        self.db.refresh(announcement)
        return _announcement_read(announcement, class_row.public_id)

    def _ensure_coach_access(self, current_user: User) -> None:
        if current_user.role not in COACH_ACCESS_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Coach access is required.",
            )

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
