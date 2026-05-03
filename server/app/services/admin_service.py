from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.security import hash_password
from app.models.analysis_report import AnalysisReport
from app.models.announcement import Announcement
from app.models.announcement_read import AnnouncementRead
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.enums import AnalysisType, UserRole, UserStatus
from app.models.notification import Notification
from app.models.template_example_video import TemplateExampleVideo
from app.models.training_camp import TrainingCamp
from app.models.training_session import TrainingSession
from app.models.training_task import TrainingTask
from app.models.training_task_assignment import TrainingTaskAssignment
from app.models.training_template import TrainingTemplate
from app.models.training_template_version import TrainingTemplateVersion
from app.models.user import User
from app.schemas.admin import (
    AdminCampRead,
    AdminAnnouncementRead,
    AdminCreateAnnouncementRequest,
    AdminClassMemberRead,
    AdminClassRead,
    AdminCreateCampRequest,
    AdminCreateClassMemberRequest,
    AdminCreateClassRequest,
    AdminCreateTemplateExampleVideoRequest,
    AdminCreateTrainingTemplateRequest,
    AdminCreateTrainingTemplateVersionRequest,
    AdminCreateUserRequest,
    AdminNotificationRead,
    AdminLocalTemplateSyncItem,
    AdminLocalTemplateSyncResponse,
    AdminTaskAssignmentRead,
    AdminTaskDetailRead,
    AdminTaskRead,
    AdminTrainingTemplateRead,
    AdminTrainingTemplateVersionRead,
    AdminUpdateAnnouncementRequest,
    AdminUpdateClassRequest,
    AdminTemplateExampleVideoRead,
    AdminUpdateCampRequest,
    AdminUpdateTaskRequest,
    AdminUpdateTemplateExampleVideoRequest,
    AdminUpdateTrainingTemplateRequest,
    AdminUpdateTrainingTemplateVersionRequest,
    AdminUpdateUserRequest,
    AdminUserClassMembershipRead,
    AdminUserDetailRead,
    AdminUserRead,
)


def _ensure_admin_access(current_user: User) -> None:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required.",
        )


def _camp_read(camp: TrainingCamp, class_count: int) -> AdminCampRead:
    return AdminCampRead(
        public_id=camp.public_id,
        name=camp.name,
        code=camp.code,
        description=camp.description,
        season_name=camp.season_name,
        status=camp.status,
        start_date=camp.start_date,
        end_date=camp.end_date,
        class_count=class_count,
        created_at=camp.created_at,
    )


def _class_read(
    class_row: CampClass,
    coach_count: int = 0,
    student_count: int = 0,
) -> AdminClassRead:
    return AdminClassRead(
        public_id=class_row.public_id,
        camp_public_id=class_row.camp.public_id,
        camp_name=class_row.camp.name,
        name=class_row.name,
        code=class_row.code,
        description=class_row.description,
        status=class_row.status,
        age_group=class_row.age_group,
        max_students=class_row.max_students,
        start_date=class_row.start_date,
        end_date=class_row.end_date,
        coach_count=coach_count,
        student_count=student_count,
        created_at=class_row.created_at,
    )


def _member_read(member: ClassMember) -> AdminClassMemberRead:
    return AdminClassMemberRead(
        public_id=member.public_id,
        class_public_id=member.camp_class.public_id,
        user_public_id=member.user.public_id,
        username=member.user.username,
        nickname=member.user.nickname,
        email=member.user.email,
        phone_number=member.user.phone_number,
        user_role=member.user.role.value,
        member_role=member.member_role,
        status=member.status,
        joined_at=member.joined_at,
        left_at=member.left_at,
        remarks=member.remarks,
        created_at=member.created_at,
    )


def _membership_read(member: ClassMember) -> AdminUserClassMembershipRead:
    return AdminUserClassMembershipRead(
        public_id=member.public_id,
        class_public_id=member.camp_class.public_id,
        class_name=member.camp_class.name,
        class_code=member.camp_class.code,
        camp_public_id=member.camp_class.camp.public_id,
        camp_name=member.camp_class.camp.name,
        member_role=member.member_role,
        status=member.status,
        joined_at=member.joined_at,
        left_at=member.left_at,
    )


def _active_memberships(user: User) -> list[ClassMember]:
    return [
        member
        for member in user.class_members
        if member.status == "active" and member.camp_class is not None
    ]


def _user_read(
    user: User,
    *,
    report_count: int = 0,
    task_assignment_count: int = 0,
    last_training_at: datetime | None = None,
) -> AdminUserRead:
    active_memberships = _active_memberships(user)
    class_names = sorted({member.camp_class.name for member in active_memberships})
    camp_names = sorted(
        {
            member.camp_class.camp.name
            for member in active_memberships
            if member.camp_class.camp is not None
        }
    )

    return AdminUserRead(
        public_id=user.public_id,
        username=user.username,
        nickname=user.nickname,
        email=user.email,
        phone_number=user.phone_number,
        role=user.role,
        status=user.status,
        is_active=user.is_active,
        class_names=class_names,
        camp_names=camp_names,
        active_class_count=len(class_names),
        report_count=report_count,
        task_assignment_count=task_assignment_count,
        last_training_at=last_training_at,
        last_login_at=user.last_login_at,
        deleted_at=user.deleted_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _template_read(template: TrainingTemplate, version_count: int) -> AdminTrainingTemplateRead:
    return AdminTrainingTemplateRead(
        public_id=template.public_id,
        template_code=template.template_code,
        name=template.name,
        analysis_type=template.analysis_type,
        description=template.description,
        difficulty_level=template.difficulty_level,
        status=template.status,
        current_version=template.current_version,
        version_count=version_count,
        published_at=template.published_at,
        created_at=template.created_at,
    )


def _template_version_read(version: TrainingTemplateVersion) -> AdminTrainingTemplateVersionRead:
    return AdminTrainingTemplateVersionRead(
        public_id=version.public_id,
        version=version.version,
        scoring_rules=version.scoring_rules,
        metric_definitions=version.metric_definitions,
        mediapipe_config=version.mediapipe_config,
        summary_template=version.summary_template,
        status=version.status,
        is_default=version.is_default,
        published_at=version.published_at,
        created_at=version.created_at,
    )


def _example_video_read(video: TemplateExampleVideo) -> AdminTemplateExampleVideoRead:
    return AdminTemplateExampleVideoRead(
        public_id=video.public_id,
        template_public_id=video.template.public_id,
        template_version=video.template_version,
        title=video.title,
        description=video.description,
        storage_provider=video.storage_provider,
        bucket_name=video.bucket_name,
        object_key=video.object_key,
        file_name=video.file_name,
        content_type=video.content_type,
        duration_seconds=_numeric_to_float(video.duration_seconds),
        cover_url=video.cover_url,
        sort_order=video.sort_order,
        status=video.status,
        created_at=video.created_at,
    )


def _numeric_to_float(value) -> float | None:
    if value is None:
        return None
    return float(value)


def _display_name(user: User) -> str:
    return user.nickname or user.username


def _user_role_from_value(value: str | None) -> UserRole | None:
    if value is None:
        return None
    try:
        return UserRole(value)
    except ValueError:
        return None


def _announcement_read(
    announcement: Announcement,
    *,
    notification_count: int = 0,
    read_count: int = 0,
) -> AdminAnnouncementRead:
    return AdminAnnouncementRead(
        public_id=announcement.public_id,
        publisher_public_id=announcement.publisher.public_id,
        publisher_name=_display_name(announcement.publisher),
        scope_type=announcement.scope_type,
        target_role=_user_role_from_value(announcement.target_role),
        camp_public_id=announcement.camp.public_id if announcement.camp else None,
        camp_name=announcement.camp.name if announcement.camp else None,
        class_public_id=announcement.camp_class.public_id if announcement.camp_class else None,
        class_name=announcement.camp_class.name if announcement.camp_class else None,
        title=announcement.title,
        content=announcement.content,
        status=announcement.status,
        is_pinned=announcement.is_pinned,
        publish_at=announcement.publish_at,
        expire_at=announcement.expire_at,
        notification_count=notification_count,
        read_count=read_count,
        created_at=announcement.created_at,
        updated_at=announcement.updated_at,
    )


def _task_read(
    task: TrainingTask,
    *,
    assignment_status_counts: dict[str, int] | None = None,
) -> AdminTaskRead:
    status_counts = assignment_status_counts or {}
    assignment_count = sum(status_counts.values())
    return AdminTaskRead(
        public_id=task.public_id,
        camp_public_id=task.camp.public_id if task.camp else None,
        camp_name=task.camp.name if task.camp else None,
        class_public_id=task.camp_class.public_id,
        class_name=task.camp_class.name,
        coach_public_id=task.created_by.public_id,
        coach_name=_display_name(task.created_by),
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
        updated_at=task.updated_at,
    )


def _task_assignment_read(assignment: TrainingTaskAssignment) -> AdminTaskAssignmentRead:
    return AdminTaskAssignmentRead(
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


def _notification_read(
    notification: Notification,
    *,
    business_public_id: UUID | None = None,
) -> AdminNotificationRead:
    return AdminNotificationRead(
        public_id=notification.public_id,
        user_public_id=notification.user.public_id,
        user_name=_display_name(notification.user),
        user_role=notification.user.role,
        type=notification.type,
        title=notification.title,
        content=notification.content,
        business_type=notification.business_type,
        business_id=notification.business_id,
        business_public_id=business_public_id,
        is_read=notification.is_read,
        read_at=notification.read_at,
        created_at=notification.created_at,
    )


class AdminService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_users(
        self,
        current_user: User,
        *,
        role: UserRole | None = None,
        user_status: UserStatus | None = None,
        keyword: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AdminUserRead], int]:
        _ensure_admin_access(current_user)
        page = max(page, 1)
        page_size = min(max(page_size, 1), 100)
        conditions = []

        if role:
            conditions.append(User.role == role)
        if user_status:
            conditions.append(User.status == user_status)
        if keyword and keyword.strip():
            normalized_keyword = f"%{keyword.strip()}%"
            conditions.append(
                or_(
                    User.username.ilike(normalized_keyword),
                    User.nickname.ilike(normalized_keyword),
                    User.email.ilike(normalized_keyword),
                    User.phone_number.ilike(normalized_keyword),
                )
            )

        count_stmt = select(func.count(User.id))
        stmt = (
            select(User)
            .options(
                selectinload(User.class_members)
                .selectinload(ClassMember.camp_class)
                .selectinload(CampClass.camp)
            )
            .order_by(User.created_at.desc())
        )
        if conditions:
            count_stmt = count_stmt.where(*conditions)
            stmt = stmt.where(*conditions)

        total = int(self.db.scalar(count_stmt) or 0)
        users = self.db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
        summaries = self._user_summaries_by_user_id([user.id for user in users])
        return [
            _user_read(
                user,
                report_count=summaries.get(user.id, {}).get("report_count", 0),
                task_assignment_count=summaries.get(user.id, {}).get("task_assignment_count", 0),
                last_training_at=summaries.get(user.id, {}).get("last_training_at"),
            )
            for user in users
        ], total

    def create_user(self, current_user: User, payload: AdminCreateUserRequest) -> AdminUserDetailRead:
        _ensure_admin_access(current_user)
        username = payload.username.strip()
        phone_number = self._normalize_phone_number(payload.phone_number)
        email = self._normalize_email(payload.email) if payload.email else None
        self._ensure_unique_user_identity(username=username, phone_number=phone_number, email=email)

        user = User(
            username=username,
            password_hash=hash_password(payload.password),
            phone_number=phone_number,
            email=email,
            nickname=payload.nickname.strip() if payload.nickname else None,
            role=payload.role,
            status=payload.status,
            is_email_verified=bool(email),
            is_phone_verified=False,
        )
        self.db.add(user)
        self.db.flush()

        if payload.class_public_ids is not None:
            self._sync_user_class_memberships(user, payload.class_public_ids)

        self.db.commit()
        self.db.refresh(user)
        user = self._get_user_by_public_id(user.public_id, include_memberships=True)
        return self._user_detail_read(user)

    def get_user_detail(self, current_user: User, user_public_id: UUID) -> AdminUserDetailRead:
        _ensure_admin_access(current_user)
        user = self._get_user_by_public_id(user_public_id, include_memberships=True)
        return self._user_detail_read(user)

    def update_user(
        self,
        current_user: User,
        user_public_id: UUID,
        payload: AdminUpdateUserRequest,
    ) -> AdminUserDetailRead:
        _ensure_admin_access(current_user)
        user = self._get_user_by_public_id(user_public_id, include_memberships=True)
        fields_set = payload.model_fields_set

        if "role" in fields_set and payload.role is not None:
            self._ensure_not_self_lockout(current_user, user, new_role=payload.role)
            user.role = payload.role
        if "status" in fields_set and payload.status is not None:
            self._ensure_not_self_lockout(current_user, user, new_status=payload.status)
            user.status = payload.status
            if payload.status == UserStatus.active:
                user.deleted_at = None

        if "username" in fields_set and payload.username is not None:
            username = payload.username.strip()
            if username != user.username:
                self._ensure_unique_user_identity(
                    username=username,
                    phone_number=None,
                    email=None,
                    exclude_user_id=user.id,
                )
                user.username = username
        if "password" in fields_set and payload.password is not None:
            user.password_hash = hash_password(payload.password)
        if "phone_number" in fields_set and payload.phone_number is not None:
            phone_number = self._normalize_phone_number(payload.phone_number)
            if phone_number != user.phone_number:
                self._ensure_unique_user_identity(
                    username=None,
                    phone_number=phone_number,
                    email=None,
                    exclude_user_id=user.id,
                )
                user.phone_number = phone_number
                user.is_phone_verified = False
        if "email" in fields_set:
            email = self._normalize_email(payload.email) if payload.email else None
            if email != user.email:
                self._ensure_unique_user_identity(
                    username=None,
                    phone_number=None,
                    email=email,
                    exclude_user_id=user.id,
                )
                user.email = email
                user.is_email_verified = bool(email)
        if "nickname" in fields_set:
            user.nickname = payload.nickname.strip() if payload.nickname else None

        self.db.add(user)
        self.db.flush()

        if "class_public_ids" in fields_set and payload.class_public_ids is not None:
            self._sync_user_class_memberships(user, payload.class_public_ids)

        self.db.commit()
        user = self._get_user_by_public_id(user_public_id, include_memberships=True)
        return self._user_detail_read(user)

    def disable_user(self, current_user: User, user_public_id: UUID) -> None:
        _ensure_admin_access(current_user)
        user = self._get_user_by_public_id(user_public_id)
        self._ensure_not_self_lockout(current_user, user, new_status=UserStatus.disabled)
        user.status = UserStatus.disabled
        user.deleted_at = datetime.now(timezone.utc)
        self.db.add(user)
        self.db.commit()

    def list_announcements(
        self,
        current_user: User,
        *,
        scope_type: str | None = None,
        announcement_status: str | None = None,
        target_role: UserRole | None = None,
        camp_public_id: UUID | None = None,
        class_public_id: UUID | None = None,
        keyword: str | None = None,
        limit: int = 100,
    ) -> list[AdminAnnouncementRead]:
        _ensure_admin_access(current_user)
        stmt = (
            select(Announcement)
            .options(
                selectinload(Announcement.publisher),
                selectinload(Announcement.camp),
                selectinload(Announcement.camp_class),
            )
            .order_by(
                Announcement.is_pinned.desc(),
                Announcement.publish_at.desc(),
                Announcement.created_at.desc(),
            )
        )

        if scope_type:
            stmt = stmt.where(Announcement.scope_type == scope_type)
        if announcement_status:
            stmt = stmt.where(Announcement.status == announcement_status)
        if target_role:
            stmt = stmt.where(Announcement.target_role == target_role.value)
        if camp_public_id:
            camp = self._get_camp_by_public_id(camp_public_id)
            stmt = stmt.where(Announcement.camp_id == camp.id)
        if class_public_id:
            class_row = self._get_class_by_public_id(class_public_id)
            stmt = stmt.where(Announcement.class_id == class_row.id)
        if keyword and keyword.strip():
            pattern = f"%{keyword.strip()}%"
            stmt = stmt.where(or_(Announcement.title.ilike(pattern), Announcement.content.ilike(pattern)))

        announcements = self.db.scalars(stmt.limit(min(max(limit, 1), 100))).all()
        counts = self._announcement_counts([announcement.id for announcement in announcements])
        return [
            _announcement_read(
                announcement,
                notification_count=counts.get(announcement.id, {}).get("notification_count", 0),
                read_count=counts.get(announcement.id, {}).get("read_count", 0),
            )
            for announcement in announcements
        ]

    def create_announcement(
        self,
        current_user: User,
        payload: AdminCreateAnnouncementRequest,
    ) -> AdminAnnouncementRead:
        _ensure_admin_access(current_user)
        scope_type, target_role, camp, class_row = self._resolve_announcement_scope(
            payload.scope_type,
            target_role=payload.target_role,
            camp_public_id=payload.camp_public_id,
            class_public_id=payload.class_public_id,
        )
        now = datetime.now(timezone.utc)
        publish_at = payload.publish_at or (now if payload.status == "published" else None)

        announcement = Announcement(
            publisher_user_id=current_user.id,
            scope_type=scope_type,
            target_role=target_role.value if target_role else None,
            camp_id=camp.id if camp else None,
            class_id=class_row.id if class_row else None,
            title=payload.title,
            content=payload.content,
            status=payload.status,
            is_pinned=payload.is_pinned,
            publish_at=publish_at,
            expire_at=payload.expire_at,
        )
        self.db.add(announcement)
        self.db.flush()

        notification_count = 0
        if payload.notify_recipients and announcement.status == "published":
            notification_count = self._notify_announcement_recipients(announcement)

        self.db.commit()
        announcement = self._get_announcement_by_public_id(announcement.public_id)
        return _announcement_read(announcement, notification_count=notification_count, read_count=0)

    def update_announcement(
        self,
        current_user: User,
        announcement_public_id: UUID,
        payload: AdminUpdateAnnouncementRequest,
    ) -> AdminAnnouncementRead:
        _ensure_admin_access(current_user)
        announcement = self._get_announcement_by_public_id(announcement_public_id)
        fields_set = payload.model_fields_set
        old_status = announcement.status

        if {"scope_type", "target_role", "camp_public_id", "class_public_id"} & fields_set:
            scope_type = payload.scope_type if "scope_type" in fields_set and payload.scope_type else announcement.scope_type
            target_role = payload.target_role if "target_role" in fields_set else _user_role_from_value(announcement.target_role)
            camp_public_id = (
                payload.camp_public_id
                if "camp_public_id" in fields_set
                else announcement.camp.public_id if announcement.camp else None
            )
            class_public_id = (
                payload.class_public_id
                if "class_public_id" in fields_set
                else announcement.camp_class.public_id if announcement.camp_class else None
            )
            resolved_scope_type, resolved_role, camp, class_row = self._resolve_announcement_scope(
                scope_type,
                target_role=target_role,
                camp_public_id=camp_public_id,
                class_public_id=class_public_id,
            )
            announcement.scope_type = resolved_scope_type
            announcement.target_role = resolved_role.value if resolved_role else None
            announcement.camp_id = camp.id if camp else None
            announcement.class_id = class_row.id if class_row else None

        if "title" in fields_set and payload.title is not None:
            announcement.title = payload.title
        if "content" in fields_set and payload.content is not None:
            announcement.content = payload.content
        if "status" in fields_set and payload.status is not None:
            announcement.status = payload.status
            if payload.status == "published" and announcement.publish_at is None:
                announcement.publish_at = datetime.now(timezone.utc)
        if "is_pinned" in fields_set and payload.is_pinned is not None:
            announcement.is_pinned = payload.is_pinned
        if "publish_at" in fields_set:
            announcement.publish_at = payload.publish_at
        if "expire_at" in fields_set:
            announcement.expire_at = payload.expire_at

        self.db.add(announcement)
        self.db.flush()

        if (
            payload.notify_recipients
            and old_status != "published"
            and announcement.status == "published"
        ):
            self._notify_announcement_recipients(announcement)

        self.db.commit()
        announcement = self._get_announcement_by_public_id(announcement_public_id)
        counts = self._announcement_counts([announcement.id])
        return _announcement_read(
            announcement,
            notification_count=counts.get(announcement.id, {}).get("notification_count", 0),
            read_count=counts.get(announcement.id, {}).get("read_count", 0),
        )

    def archive_announcement(self, current_user: User, announcement_public_id: UUID) -> None:
        _ensure_admin_access(current_user)
        announcement = self._get_announcement_by_public_id(announcement_public_id)
        announcement.status = "archived"
        self.db.add(announcement)
        self.db.commit()

    def list_tasks(
        self,
        current_user: User,
        *,
        coach_public_id: UUID | None = None,
        camp_public_id: UUID | None = None,
        class_public_id: UUID | None = None,
        task_status: str | None = None,
        analysis_type: AnalysisType | None = None,
        keyword: str | None = None,
        limit: int = 100,
    ) -> list[AdminTaskRead]:
        _ensure_admin_access(current_user)
        stmt = (
            select(TrainingTask)
            .options(
                selectinload(TrainingTask.camp),
                selectinload(TrainingTask.camp_class),
                selectinload(TrainingTask.created_by),
            )
            .order_by(TrainingTask.created_at.desc())
        )

        if coach_public_id:
            coach = self._get_user_by_public_id(coach_public_id)
            stmt = stmt.where(TrainingTask.created_by_user_id == coach.id)
        if camp_public_id:
            camp = self._get_camp_by_public_id(camp_public_id)
            stmt = stmt.where(TrainingTask.camp_id == camp.id)
        if class_public_id:
            class_row = self._get_class_by_public_id(class_public_id)
            stmt = stmt.where(TrainingTask.class_id == class_row.id)
        if task_status:
            stmt = stmt.where(TrainingTask.status == task_status)
        if analysis_type:
            stmt = stmt.where(TrainingTask.analysis_type == analysis_type)
        if keyword and keyword.strip():
            pattern = f"%{keyword.strip()}%"
            stmt = stmt.where(
                or_(
                    TrainingTask.title.ilike(pattern),
                    TrainingTask.description.ilike(pattern),
                    TrainingTask.template_code.ilike(pattern),
                )
            )

        tasks = self.db.scalars(stmt.limit(min(max(limit, 1), 100))).all()
        counts = self._assignment_status_counts_by_task([task.id for task in tasks])
        return [_task_read(task, assignment_status_counts=counts.get(task.id, {})) for task in tasks]

    def get_task_detail(self, current_user: User, task_public_id: UUID) -> AdminTaskDetailRead:
        _ensure_admin_access(current_user)
        task = self._get_task_by_public_id(task_public_id)
        assignments = self._list_task_assignments(task.id)
        status_counts: dict[str, int] = {}
        for assignment in assignments:
            status_counts[assignment.status] = status_counts.get(assignment.status, 0) + 1
        return AdminTaskDetailRead(
            **_task_read(task, assignment_status_counts=status_counts).model_dump(),
            assignments=[_task_assignment_read(assignment) for assignment in assignments],
        )

    def update_task(
        self,
        current_user: User,
        task_public_id: UUID,
        payload: AdminUpdateTaskRequest,
    ) -> AdminTaskDetailRead:
        _ensure_admin_access(current_user)
        task = self._get_task_by_public_id(task_public_id)
        fields_set = payload.model_fields_set

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
        return self.get_task_detail(current_user, task_public_id)

    def list_notifications(
        self,
        current_user: User,
        *,
        notification_type: str | None = None,
        business_type: str | None = None,
        user_public_id: UUID | None = None,
        user_role: UserRole | None = None,
        is_read: bool | None = None,
        keyword: str | None = None,
        limit: int = 100,
    ) -> list[AdminNotificationRead]:
        _ensure_admin_access(current_user)
        stmt = (
            select(Notification)
            .join(User, Notification.user_id == User.id)
            .options(selectinload(Notification.user))
            .order_by(Notification.created_at.desc())
        )

        if notification_type:
            stmt = stmt.where(Notification.type == notification_type)
        if business_type:
            stmt = stmt.where(Notification.business_type == business_type)
        if user_public_id:
            user = self._get_user_by_public_id(user_public_id)
            stmt = stmt.where(Notification.user_id == user.id)
        if user_role:
            stmt = stmt.where(User.role == user_role)
        if is_read is not None:
            stmt = stmt.where(Notification.is_read == is_read)
        if keyword and keyword.strip():
            pattern = f"%{keyword.strip()}%"
            stmt = stmt.where(or_(Notification.title.ilike(pattern), Notification.content.ilike(pattern)))

        notifications = self.db.scalars(stmt.limit(min(max(limit, 1), 100))).all()
        business_public_ids = self._notification_business_public_ids(notifications)
        return [
            _notification_read(
                notification,
                business_public_id=business_public_ids.get(
                    (notification.business_type or "", notification.business_id or 0)
                ),
            )
            for notification in notifications
        ]

    def get_notification_detail(
        self,
        current_user: User,
        notification_public_id: UUID,
    ) -> AdminNotificationRead:
        _ensure_admin_access(current_user)
        notification = self._get_notification_by_public_id(notification_public_id)
        business_public_ids = self._notification_business_public_ids([notification])
        return _notification_read(
            notification,
            business_public_id=business_public_ids.get(
                (notification.business_type or "", notification.business_id or 0)
            ),
        )

    def list_camps(self, current_user: User) -> list[AdminCampRead]:
        _ensure_admin_access(current_user)
        camps = self.db.scalars(
            select(TrainingCamp).order_by(TrainingCamp.created_at.desc())
        ).all()
        class_counts = self._class_counts_by_camp([camp.id for camp in camps])
        return [_camp_read(camp, class_counts.get(camp.id, 0)) for camp in camps]

    def create_camp(self, current_user: User, payload: AdminCreateCampRequest) -> AdminCampRead:
        _ensure_admin_access(current_user)
        self._ensure_unique_camp_code(payload.code)

        camp = TrainingCamp(
            name=payload.name,
            code=payload.code,
            description=payload.description,
            season_name=payload.season_name,
            status=payload.status,
            start_date=payload.start_date,
            end_date=payload.end_date,
            created_by_user_id=current_user.id,
            updated_by_user_id=current_user.id,
        )
        self.db.add(camp)
        self.db.commit()
        self.db.refresh(camp)
        return _camp_read(camp, 0)

    def update_camp(
        self,
        current_user: User,
        camp_public_id: UUID,
        payload: AdminUpdateCampRequest,
    ) -> AdminCampRead:
        _ensure_admin_access(current_user)
        camp = self._get_camp_by_public_id(camp_public_id)
        fields_set = payload.model_fields_set

        if "code" in fields_set and payload.code is not None and payload.code != camp.code:
            self._ensure_unique_camp_code(payload.code)
            camp.code = payload.code
        if "name" in fields_set and payload.name is not None:
            camp.name = payload.name
        if "description" in fields_set:
            camp.description = payload.description
        if "season_name" in fields_set:
            camp.season_name = payload.season_name
        if "status" in fields_set and payload.status is not None:
            camp.status = payload.status
        if "start_date" in fields_set:
            camp.start_date = payload.start_date
        if "end_date" in fields_set:
            camp.end_date = payload.end_date
        camp.updated_by_user_id = current_user.id

        self.db.add(camp)
        self.db.commit()
        self.db.refresh(camp)
        class_count = self._class_counts_by_camp([camp.id]).get(camp.id, 0)
        return _camp_read(camp, class_count)

    def list_classes(
        self,
        current_user: User,
        camp_public_id: UUID | None = None,
    ) -> list[AdminClassRead]:
        _ensure_admin_access(current_user)
        stmt = (
            select(CampClass)
            .options(selectinload(CampClass.camp))
            .order_by(CampClass.created_at.desc())
        )
        if camp_public_id:
            camp = self._get_camp_by_public_id(camp_public_id)
            stmt = stmt.where(CampClass.camp_id == camp.id)

        classes = self.db.scalars(stmt).all()
        counts = self._member_counts_by_class([class_row.id for class_row in classes])
        return [
            _class_read(
                class_row,
                coach_count=counts.get(class_row.id, {}).get("coach", 0),
                student_count=counts.get(class_row.id, {}).get("student", 0),
            )
            for class_row in classes
        ]

    def create_class(self, current_user: User, payload: AdminCreateClassRequest) -> AdminClassRead:
        _ensure_admin_access(current_user)
        camp = self._get_camp_by_public_id(payload.camp_public_id)
        self._ensure_unique_class_code(camp.id, payload.code)

        class_row = CampClass(
            camp_id=camp.id,
            name=payload.name,
            code=payload.code,
            description=payload.description,
            status=payload.status,
            age_group=payload.age_group,
            max_students=payload.max_students,
            start_date=payload.start_date,
            end_date=payload.end_date,
            created_by_user_id=current_user.id,
            updated_by_user_id=current_user.id,
        )
        self.db.add(class_row)
        self.db.commit()
        self.db.refresh(class_row)
        class_row.camp = camp
        return _class_read(class_row)

    def update_class(
        self,
        current_user: User,
        class_public_id: UUID,
        payload: AdminUpdateClassRequest,
    ) -> AdminClassRead:
        _ensure_admin_access(current_user)
        class_row = self._get_class_by_public_id(class_public_id)
        fields_set = payload.model_fields_set

        if "code" in fields_set and payload.code is not None and payload.code != class_row.code:
            self._ensure_unique_class_code(class_row.camp_id, payload.code)
            class_row.code = payload.code
        if "name" in fields_set and payload.name is not None:
            class_row.name = payload.name
        if "description" in fields_set:
            class_row.description = payload.description
        if "status" in fields_set and payload.status is not None:
            class_row.status = payload.status
        if "age_group" in fields_set:
            class_row.age_group = payload.age_group
        if "max_students" in fields_set:
            class_row.max_students = payload.max_students
        if "start_date" in fields_set:
            class_row.start_date = payload.start_date
        if "end_date" in fields_set:
            class_row.end_date = payload.end_date
        class_row.updated_by_user_id = current_user.id

        self.db.add(class_row)
        self.db.commit()
        self.db.refresh(class_row)
        counts = self._member_counts_by_class([class_row.id]).get(class_row.id, {})
        return _class_read(
            class_row,
            coach_count=counts.get("coach", 0),
            student_count=counts.get("student", 0),
        )

    def list_class_members(
        self,
        current_user: User,
        class_public_id: UUID,
    ) -> list[AdminClassMemberRead]:
        _ensure_admin_access(current_user)
        class_row = self._get_class_by_public_id(class_public_id)
        members = self.db.scalars(
            select(ClassMember)
            .options(
                selectinload(ClassMember.user),
                selectinload(ClassMember.camp_class),
            )
            .where(ClassMember.class_id == class_row.id)
            .order_by(ClassMember.status.asc(), ClassMember.member_role.asc(), ClassMember.created_at.desc())
        ).all()
        return [_member_read(member) for member in members]

    def add_class_member(
        self,
        current_user: User,
        class_public_id: UUID,
        payload: AdminCreateClassMemberRequest,
    ) -> AdminClassMemberRead:
        _ensure_admin_access(current_user)
        class_row = self._get_class_by_public_id(class_public_id)
        user = self._get_user_by_public_id(payload.user_public_id)
        now = datetime.now(timezone.utc)

        member = self.db.scalar(
            select(ClassMember).where(
                ClassMember.class_id == class_row.id,
                ClassMember.user_id == user.id,
                ClassMember.member_role == payload.member_role,
            )
        )

        if member:
            member.status = payload.status
            member.joined_at = payload.joined_at or member.joined_at or now
            member.left_at = None if payload.status == "active" else member.left_at
            member.remarks = payload.remarks
        else:
            member = ClassMember(
                class_id=class_row.id,
                user_id=user.id,
                member_role=payload.member_role,
                status=payload.status,
                joined_at=payload.joined_at or now,
                remarks=payload.remarks,
            )
            self.db.add(member)

        self.db.commit()
        self.db.refresh(member)
        member.camp_class = class_row
        member.user = user
        return _member_read(member)

    def remove_class_member(
        self,
        current_user: User,
        class_public_id: UUID,
        member_public_id: UUID,
    ) -> None:
        _ensure_admin_access(current_user)
        class_row = self._get_class_by_public_id(class_public_id)
        member = self.db.scalar(
            select(ClassMember).where(
                ClassMember.class_id == class_row.id,
                ClassMember.public_id == member_public_id,
            )
        )
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class member not found.")

        member.status = "removed"
        member.left_at = datetime.now(timezone.utc)
        self.db.add(member)
        self.db.commit()

    def list_training_templates(self, current_user: User) -> list[AdminTrainingTemplateRead]:
        _ensure_admin_access(current_user)
        templates = self.db.scalars(
            select(TrainingTemplate).order_by(TrainingTemplate.created_at.desc())
        ).all()
        version_counts = self._version_counts_by_template([template.id for template in templates])
        return [_template_read(template, version_counts.get(template.id, 0)) for template in templates]

    def sync_local_training_templates(
        self,
        current_user: User,
        *,
        dry_run: bool = True,
    ) -> AdminLocalTemplateSyncResponse:
        _ensure_admin_access(current_user)
        local_templates = self._load_local_template_payloads()
        items: list[AdminLocalTemplateSyncItem] = []
        created = 0
        updated = 0
        skipped = 0
        now = datetime.now(timezone.utc)

        for local_template in local_templates:
            existing_template = self.db.scalar(
                select(TrainingTemplate).where(
                    TrainingTemplate.template_code == local_template["template_code"]
                )
            )
            existing_version = None
            action = "create"
            reason: str | None = None

            if existing_template:
                existing_version = self.db.scalar(
                    select(TrainingTemplateVersion).where(
                        TrainingTemplateVersion.template_id == existing_template.id,
                        TrainingTemplateVersion.version == local_template["version"],
                    )
                )
                if existing_version and self._local_template_version_matches(
                    existing_template,
                    existing_version,
                    local_template,
                ):
                    action = "skip"
                    reason = "Local template metadata and rules are already in sync."
                else:
                    action = "update"

            if action == "create":
                created += 1
            elif action == "update":
                updated += 1
            else:
                skipped += 1

            items.append(
                AdminLocalTemplateSyncItem(
                    template_code=local_template["template_code"],
                    name=local_template["name"],
                    analysis_type=local_template["analysis_type"],
                    source_path=local_template["source_path"],
                    version=local_template["version"],
                    action=action,
                    reason=reason,
                )
            )

            if dry_run or action == "skip":
                continue

            template = existing_template or TrainingTemplate(
                template_code=local_template["template_code"],
                name=local_template["name"],
                analysis_type=local_template["analysis_type"],
                description=local_template["description"],
                difficulty_level=None,
                status="active",
                current_version=local_template["version"],
                created_by_user_id=current_user.id,
                updated_by_user_id=current_user.id,
                published_at=now,
            )
            template.name = local_template["name"]
            template.analysis_type = local_template["analysis_type"]
            template.description = local_template["description"]
            template.status = "active"
            template.current_version = local_template["version"]
            template.updated_by_user_id = current_user.id
            if not template.published_at:
                template.published_at = now
            self.db.add(template)
            self.db.flush()

            existing_versions = self.db.scalars(
                select(TrainingTemplateVersion).where(
                    TrainingTemplateVersion.template_id == template.id
                )
            ).all()
            for version_row in existing_versions:
                version_row.is_default = False
                self.db.add(version_row)

            version = existing_version or TrainingTemplateVersion(
                template_id=template.id,
                version=local_template["version"],
                created_by_user_id=current_user.id,
            )
            version.scoring_rules = local_template["scoring_rules"]
            version.metric_definitions = local_template["metric_definitions"]
            version.mediapipe_config = local_template["mediapipe_config"]
            version.summary_template = local_template["summary_template"]
            version.status = "active"
            version.is_default = True
            if not version.published_at:
                version.published_at = now
            self.db.add(version)

        if not dry_run:
            self.db.commit()

        return AdminLocalTemplateSyncResponse(
            dry_run=dry_run,
            created=created,
            updated=updated,
            skipped=skipped,
            items=items,
        )

    def create_training_template(
        self,
        current_user: User,
        payload: AdminCreateTrainingTemplateRequest,
    ) -> AdminTrainingTemplateRead:
        _ensure_admin_access(current_user)
        self._ensure_unique_template_code(payload.template_code)
        now = datetime.now(timezone.utc)

        template = TrainingTemplate(
            template_code=payload.template_code,
            name=payload.name,
            analysis_type=payload.analysis_type,
            description=payload.description,
            difficulty_level=payload.difficulty_level,
            status=payload.status,
            current_version=payload.current_version,
            created_by_user_id=current_user.id,
            updated_by_user_id=current_user.id,
            published_at=now if payload.status == "active" else None,
        )
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        return _template_read(template, 0)

    def update_training_template(
        self,
        current_user: User,
        template_public_id: UUID,
        payload: AdminUpdateTrainingTemplateRequest,
    ) -> AdminTrainingTemplateRead:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)
        fields_set = payload.model_fields_set
        now = datetime.now(timezone.utc)

        if (
            "template_code" in fields_set
            and payload.template_code is not None
            and payload.template_code != template.template_code
        ):
            self._ensure_unique_template_code(payload.template_code)
            template.template_code = payload.template_code
        if "name" in fields_set and payload.name is not None:
            template.name = payload.name
        if "analysis_type" in fields_set and payload.analysis_type is not None:
            template.analysis_type = payload.analysis_type
        if "description" in fields_set:
            template.description = payload.description
        if "difficulty_level" in fields_set:
            template.difficulty_level = payload.difficulty_level
        if "status" in fields_set and payload.status is not None:
            template.status = payload.status
            if payload.status == "active" and not template.published_at:
                template.published_at = now
        if "current_version" in fields_set:
            template.current_version = payload.current_version
        template.updated_by_user_id = current_user.id

        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        version_count = self._version_counts_by_template([template.id]).get(template.id, 0)
        return _template_read(template, version_count)

    def create_training_template_version(
        self,
        current_user: User,
        template_public_id: UUID,
        payload: AdminCreateTrainingTemplateVersionRequest,
    ) -> AdminTrainingTemplateVersionRead:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)
        self._ensure_unique_template_version(template.id, payload.version)
        now = datetime.now(timezone.utc)

        if payload.is_default:
            existing_versions = self.db.scalars(
                select(TrainingTemplateVersion).where(TrainingTemplateVersion.template_id == template.id)
            ).all()
            for version in existing_versions:
                version.is_default = False

            template.current_version = payload.version
            template.updated_by_user_id = current_user.id
            if payload.status == "active" and not template.published_at:
                template.published_at = now

        version = TrainingTemplateVersion(
            template_id=template.id,
            version=payload.version,
            scoring_rules=payload.scoring_rules,
            metric_definitions=payload.metric_definitions,
            mediapipe_config=payload.mediapipe_config,
            summary_template=payload.summary_template,
            status=payload.status,
            is_default=payload.is_default,
            created_by_user_id=current_user.id,
            published_at=now if payload.status == "active" else None,
        )
        self.db.add(version)
        self.db.add(template)
        self.db.commit()
        self.db.refresh(version)
        return _template_version_read(version)

    def list_training_template_versions(
        self,
        current_user: User,
        template_public_id: UUID,
    ) -> list[AdminTrainingTemplateVersionRead]:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)
        versions = self.db.scalars(
            select(TrainingTemplateVersion)
            .where(TrainingTemplateVersion.template_id == template.id)
            .order_by(TrainingTemplateVersion.created_at.desc())
        ).all()
        return [_template_version_read(version) for version in versions]

    def update_training_template_version(
        self,
        current_user: User,
        template_public_id: UUID,
        version_public_id: UUID,
        payload: AdminUpdateTrainingTemplateVersionRequest,
    ) -> AdminTrainingTemplateVersionRead:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)
        version = self._get_template_version_by_public_id(template.id, version_public_id)
        fields_set = payload.model_fields_set
        now = datetime.now(timezone.utc)

        if "version" in fields_set and payload.version is not None and payload.version != version.version:
            self._ensure_unique_template_version(template.id, payload.version)
            version.version = payload.version
        if "scoring_rules" in fields_set and payload.scoring_rules is not None:
            version.scoring_rules = payload.scoring_rules
        if "metric_definitions" in fields_set:
            version.metric_definitions = payload.metric_definitions
        if "mediapipe_config" in fields_set:
            version.mediapipe_config = payload.mediapipe_config
        if "summary_template" in fields_set:
            version.summary_template = payload.summary_template
        if "status" in fields_set and payload.status is not None:
            version.status = payload.status
            if payload.status == "active" and not version.published_at:
                version.published_at = now
        if "is_default" in fields_set and payload.is_default is not None:
            version.is_default = payload.is_default
            if payload.is_default:
                existing_versions = self.db.scalars(
                    select(TrainingTemplateVersion)
                    .where(
                        TrainingTemplateVersion.template_id == template.id,
                        TrainingTemplateVersion.id != version.id,
                    )
                ).all()
                for existing_version in existing_versions:
                    existing_version.is_default = False
                    self.db.add(existing_version)
                template.current_version = version.version
                template.updated_by_user_id = current_user.id
                self.db.add(template)

        self.db.add(version)
        self.db.commit()
        self.db.refresh(version)
        return _template_version_read(version)

    def list_template_example_videos(
        self,
        current_user: User,
        template_public_id: UUID,
    ) -> list[AdminTemplateExampleVideoRead]:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)
        videos = self.db.scalars(
            select(TemplateExampleVideo)
            .options(selectinload(TemplateExampleVideo.template))
            .where(TemplateExampleVideo.template_id == template.id)
            .order_by(TemplateExampleVideo.sort_order.asc(), TemplateExampleVideo.created_at.desc())
        ).all()
        return [_example_video_read(video) for video in videos]

    def create_template_example_video(
        self,
        current_user: User,
        template_public_id: UUID,
        payload: AdminCreateTemplateExampleVideoRequest,
    ) -> AdminTemplateExampleVideoRead:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)

        video = TemplateExampleVideo(
            template_id=template.id,
            template_version=payload.template_version,
            title=payload.title,
            description=payload.description,
            storage_provider=payload.storage_provider,
            bucket_name=payload.bucket_name,
            object_key=payload.object_key,
            file_name=payload.file_name,
            content_type=payload.content_type,
            duration_seconds=payload.duration_seconds,
            cover_url=payload.cover_url,
            sort_order=payload.sort_order,
            status=payload.status,
            created_by_user_id=current_user.id,
        )
        self.db.add(video)
        self.db.commit()
        self.db.refresh(video)
        video.template = template
        return _example_video_read(video)

    def update_template_example_video(
        self,
        current_user: User,
        template_public_id: UUID,
        video_public_id: UUID,
        payload: AdminUpdateTemplateExampleVideoRequest,
    ) -> AdminTemplateExampleVideoRead:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)
        video = self._get_example_video_by_public_id(template.id, video_public_id)
        fields_set = payload.model_fields_set

        if "template_version" in fields_set:
            video.template_version = payload.template_version
        if "title" in fields_set and payload.title is not None:
            video.title = payload.title
        if "description" in fields_set:
            video.description = payload.description
        if "storage_provider" in fields_set and payload.storage_provider is not None:
            video.storage_provider = payload.storage_provider
        if "bucket_name" in fields_set and payload.bucket_name is not None:
            video.bucket_name = payload.bucket_name
        if "object_key" in fields_set and payload.object_key is not None:
            video.object_key = payload.object_key
        if "file_name" in fields_set and payload.file_name is not None:
            video.file_name = payload.file_name
        if "content_type" in fields_set and payload.content_type is not None:
            video.content_type = payload.content_type
        if "duration_seconds" in fields_set:
            video.duration_seconds = payload.duration_seconds
        if "cover_url" in fields_set:
            video.cover_url = payload.cover_url
        if "sort_order" in fields_set and payload.sort_order is not None:
            video.sort_order = payload.sort_order
        if "status" in fields_set and payload.status is not None:
            video.status = payload.status

        self.db.add(video)
        self.db.commit()
        self.db.refresh(video)
        video.template = template
        return _example_video_read(video)

    def delete_template_example_video(
        self,
        current_user: User,
        template_public_id: UUID,
        video_public_id: UUID,
    ) -> None:
        _ensure_admin_access(current_user)
        template = self._get_template_by_public_id(template_public_id)
        video = self._get_example_video_by_public_id(template.id, video_public_id)
        self.db.delete(video)
        self.db.commit()

    def _user_detail_read(self, user: User) -> AdminUserDetailRead:
        summaries = self._user_summaries_by_user_id([user.id])
        base = _user_read(
            user,
            report_count=summaries.get(user.id, {}).get("report_count", 0),
            task_assignment_count=summaries.get(user.id, {}).get("task_assignment_count", 0),
            last_training_at=summaries.get(user.id, {}).get("last_training_at"),
        )
        memberships = [
            _membership_read(member)
            for member in sorted(
                user.class_members,
                key=lambda item: (
                    item.status != "active",
                    item.member_role,
                    item.camp_class.name if item.camp_class else "",
                ),
            )
            if member.camp_class is not None and member.camp_class.camp is not None
        ]
        return AdminUserDetailRead(**base.model_dump(), memberships=memberships)

    def _sync_user_class_memberships(
        self,
        user: User,
        class_public_ids: list[UUID],
    ) -> None:
        desired_class_ids = set(self._get_class_ids_by_public_ids(class_public_ids))
        member_role = "coach" if user.role == UserRole.coach else "student"
        if user.role not in {UserRole.coach, UserRole.student} and desired_class_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only coach and student users can be assigned to classes.",
            )

        now = datetime.now(timezone.utc)
        memberships = self.db.scalars(
            select(ClassMember).where(ClassMember.user_id == user.id)
        ).all()
        existing_by_key = {
            (member.class_id, member.member_role): member
            for member in memberships
            if member.member_role in {"coach", "student"}
        }

        for member in memberships:
            if member.member_role not in {"coach", "student"}:
                continue
            should_be_active = (
                member.member_role == member_role
                and member.class_id in desired_class_ids
                and user.role in {UserRole.coach, UserRole.student}
            )
            if should_be_active:
                member.status = "active"
                member.left_at = None
                member.joined_at = member.joined_at or now
            elif member.status == "active":
                member.status = "removed"
                member.left_at = now
            self.db.add(member)

        if user.role not in {UserRole.coach, UserRole.student}:
            return

        for class_id in desired_class_ids:
            if (class_id, member_role) in existing_by_key:
                continue
            self.db.add(
                ClassMember(
                    class_id=class_id,
                    user_id=user.id,
                    member_role=member_role,
                    status="active",
                    joined_at=now,
                )
            )

    def _get_class_ids_by_public_ids(self, class_public_ids: list[UUID]) -> list[int]:
        if not class_public_ids:
            return []

        unique_public_ids = list(dict.fromkeys(class_public_ids))
        rows = self.db.scalars(
            select(CampClass).where(CampClass.public_id.in_(unique_public_ids))
        ).all()
        found_by_public_id = {row.public_id: row for row in rows}
        missing = [public_id for public_id in unique_public_ids if public_id not in found_by_public_id]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="One or more classes were not found.",
            )
        return [found_by_public_id[public_id].id for public_id in unique_public_ids]

    def _ensure_unique_user_identity(
        self,
        *,
        username: str | None,
        phone_number: str | None,
        email: str | None,
        exclude_user_id: int | None = None,
    ) -> None:
        checks = []
        if username:
            checks.append(User.username == username)
        if phone_number:
            checks.append(User.phone_number == phone_number)
        if email:
            checks.append(User.email == email)
        if not checks:
            return

        stmt = select(User.id).where(or_(*checks))
        if exclude_user_id is not None:
            stmt = stmt.where(User.id != exclude_user_id)
        if self.db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username, phone number, or email already exists.",
            )

    def _ensure_not_self_lockout(
        self,
        current_user: User,
        target_user: User,
        *,
        new_role: UserRole | None = None,
        new_status: UserStatus | None = None,
    ) -> None:
        if current_user.id != target_user.id:
            return
        if new_role is not None and new_role != UserRole.admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin users cannot remove their own admin role.",
            )
        if new_status is not None and new_status != UserStatus.active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin users cannot disable their own account.",
            )

    def _normalize_phone_number(self, phone_number: str) -> str:
        phone_number = phone_number.strip()
        normalized = "".join(
            character for character in phone_number if character.isdigit() or character == "+"
        )
        return normalized or phone_number

    def _normalize_email(self, email: str) -> str:
        return email.strip().lower()

    def _user_summaries_by_user_id(self, user_ids: list[int]) -> dict[int, dict]:
        if not user_ids:
            return {}

        summaries: dict[int, dict] = {user_id: {} for user_id in user_ids}
        report_rows = self.db.execute(
            select(AnalysisReport.user_id, func.count(AnalysisReport.id))
            .where(
                AnalysisReport.user_id.in_(user_ids),
                AnalysisReport.deleted_at.is_(None),
            )
            .group_by(AnalysisReport.user_id)
        ).all()
        for user_id, count in report_rows:
            summaries.setdefault(user_id, {})["report_count"] = int(count)

        task_rows = self.db.execute(
            select(TrainingTaskAssignment.student_id, func.count(TrainingTaskAssignment.id))
            .where(TrainingTaskAssignment.student_id.in_(user_ids))
            .group_by(TrainingTaskAssignment.student_id)
        ).all()
        for user_id, count in task_rows:
            summaries.setdefault(user_id, {})["task_assignment_count"] = int(count)

        latest_training_rows = self.db.execute(
            select(TrainingSession.student_id, func.max(TrainingSession.created_at))
            .where(TrainingSession.student_id.in_(user_ids))
            .group_by(TrainingSession.student_id)
        ).all()
        for user_id, last_training_at in latest_training_rows:
            summaries.setdefault(user_id, {})["last_training_at"] = last_training_at

        return summaries

    def _load_local_template_payloads(self) -> list[dict]:
        templates_root = Path(__file__).resolve().parents[3] / "web" / "src" / "config" / "templates"
        if not templates_root.exists():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Local template directory was not found.",
            )

        payloads: list[dict] = []
        for template_path in sorted(templates_root.glob("*/*.json")):
            with template_path.open("r", encoding="utf-8") as template_file:
                raw_template = json.load(template_file)

            template_code = str(raw_template.get("templateId") or template_path.stem)
            mode = raw_template.get("mode") or template_path.parent.name
            if mode not in {item.value for item in AnalysisType}:
                mode = template_path.parent.name
            if mode not in {AnalysisType.shooting.value, AnalysisType.dribbling.value, AnalysisType.training.value}:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Unsupported local template mode: {mode}.",
                )

            content_hash = hashlib.sha256(
                json.dumps(raw_template, ensure_ascii=False, sort_keys=True).encode("utf-8")
            ).hexdigest()
            relative_source_path = template_path.relative_to(Path(__file__).resolve().parents[3]).as_posix()
            metrics = raw_template.get("metrics") if isinstance(raw_template.get("metrics"), list) else []
            metric_summary = [
                {
                    "metric_id": metric.get("metricId"),
                    "category": metric.get("category"),
                    "type": metric.get("type"),
                    "compute_key": metric.get("computeKey"),
                    "weight": metric.get("weight"),
                }
                for metric in metrics
                if isinstance(metric, dict)
            ]
            version = str(raw_template.get("version") or "local-v1")

            payloads.append(
                {
                    "template_code": template_code,
                    "name": str(raw_template.get("displayName") or template_code),
                    "analysis_type": AnalysisType(mode),
                    "description": f"Imported from {relative_source_path}; camera={raw_template.get('camera', 'unknown')}.",
                    "source_path": relative_source_path,
                    "version": version,
                    "content_hash": content_hash,
                    "scoring_rules": {
                        "source": "local_json",
                        "content_hash": content_hash,
                        "template": raw_template,
                    },
                    "metric_definitions": {
                        "source_path": relative_source_path,
                        "metric_count": len(metric_summary),
                        "metrics": metric_summary,
                        "category_weights": raw_template.get("categoryWeights")
                        or raw_template.get("overallWeights"),
                    },
                    "mediapipe_config": {
                        "camera": raw_template.get("camera"),
                        "options": raw_template.get("options") or {},
                        "age_groups": raw_template.get("ageGroups") or [],
                    },
                    "summary_template": {
                        "display_name": raw_template.get("displayName"),
                        "mode": mode,
                        "rules_note": raw_template.get("rulesNote"),
                        "source_path": relative_source_path,
                        "content_hash": content_hash,
                    },
                }
            )

        return payloads

    def _local_template_version_matches(
        self,
        template: TrainingTemplate,
        version: TrainingTemplateVersion,
        local_template: dict,
    ) -> bool:
        summary_template = version.summary_template if isinstance(version.summary_template, dict) else {}
        version_hash = summary_template.get("content_hash")
        return (
            template.name == local_template["name"]
            and template.analysis_type == local_template["analysis_type"]
            and template.current_version == local_template["version"]
            and version_hash == local_template["content_hash"]
            and version.is_default
            and version.status == "active"
        )

    def _resolve_announcement_scope(
        self,
        scope_type: str,
        *,
        target_role: UserRole | None = None,
        camp_public_id: UUID | None = None,
        class_public_id: UUID | None = None,
    ) -> tuple[str, UserRole | None, TrainingCamp | None, CampClass | None]:
        normalized_scope = scope_type.strip().lower()
        if normalized_scope not in {"global", "camp", "class", "role"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Announcement scope must be global, camp, class, or role.",
            )

        if normalized_scope == "global":
            return normalized_scope, None, None, None

        if normalized_scope == "role":
            if target_role not in {UserRole.coach, UserRole.student}:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Role announcements must target coach or student.",
                )
            return normalized_scope, target_role, None, None

        if normalized_scope == "camp":
            if not camp_public_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="camp_public_id is required for camp announcements.",
                )
            return normalized_scope, None, self._get_camp_by_public_id(camp_public_id), None

        if not class_public_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="class_public_id is required for class announcements.",
            )
        class_row = self._get_class_by_public_id(class_public_id)
        if camp_public_id and class_row.camp.public_id != camp_public_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="class_public_id does not belong to camp_public_id.",
            )
        return normalized_scope, None, class_row.camp, class_row

    def _notify_announcement_recipients(self, announcement: Announcement) -> int:
        user_ids = self._announcement_recipient_user_ids(announcement)
        return self._create_notifications(
            user_ids,
            notification_type="announcement",
            title=announcement.title,
            content=announcement.content,
            business_type="announcement",
            business_id=announcement.id,
        )

    def _announcement_recipient_user_ids(self, announcement: Announcement) -> list[int]:
        active_user_condition = User.status == UserStatus.active
        if announcement.scope_type == "global":
            return list(self.db.scalars(select(User.id).where(active_user_condition)).all())

        if announcement.scope_type == "role" and announcement.target_role:
            return list(
                self.db.scalars(
                    select(User.id).where(
                        active_user_condition,
                        User.role == UserRole(announcement.target_role),
                    )
                ).all()
            )

        if announcement.scope_type == "camp" and announcement.camp_id:
            stmt = (
                select(User.id)
                .join(ClassMember, ClassMember.user_id == User.id)
                .join(CampClass, ClassMember.class_id == CampClass.id)
                .where(
                    active_user_condition,
                    ClassMember.status == "active",
                    CampClass.camp_id == announcement.camp_id,
                )
                .distinct()
            )
            return list(self.db.scalars(stmt).all())

        if announcement.scope_type == "class" and announcement.class_id:
            stmt = (
                select(User.id)
                .join(ClassMember, ClassMember.user_id == User.id)
                .where(
                    active_user_condition,
                    ClassMember.status == "active",
                    ClassMember.class_id == announcement.class_id,
                )
                .distinct()
            )
            return list(self.db.scalars(stmt).all())

        return []

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

    def _announcement_counts(self, announcement_ids: list[int]) -> dict[int, dict[str, int]]:
        if not announcement_ids:
            return {}

        counts: dict[int, dict[str, int]] = {announcement_id: {} for announcement_id in announcement_ids}
        read_rows = self.db.execute(
            select(AnnouncementRead.announcement_id, func.count(AnnouncementRead.id))
            .where(AnnouncementRead.announcement_id.in_(announcement_ids))
            .group_by(AnnouncementRead.announcement_id)
        ).all()
        for announcement_id, read_count in read_rows:
            counts.setdefault(announcement_id, {})["read_count"] = int(read_count)

        notification_rows = self.db.execute(
            select(Notification.business_id, func.count(Notification.id))
            .where(
                Notification.business_type == "announcement",
                Notification.business_id.in_(announcement_ids),
            )
            .group_by(Notification.business_id)
        ).all()
        for announcement_id, notification_count in notification_rows:
            counts.setdefault(announcement_id, {})["notification_count"] = int(notification_count)

        return counts

    def _assignment_status_counts_by_task(self, task_ids: list[int]) -> dict[int, dict[str, int]]:
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

    def _notification_business_public_ids(
        self,
        notifications: list[Notification],
    ) -> dict[tuple[str, int], UUID]:
        business_ids_by_type: dict[str, set[int]] = {}
        for notification in notifications:
            if notification.business_type and notification.business_id:
                business_ids_by_type.setdefault(notification.business_type, set()).add(notification.business_id)

        public_ids: dict[tuple[str, int], UUID] = {}
        announcement_ids = business_ids_by_type.get("announcement", set())
        if announcement_ids:
            rows = self.db.execute(
                select(Announcement.id, Announcement.public_id).where(Announcement.id.in_(announcement_ids))
            ).all()
            public_ids.update({("announcement", row_id): public_id for row_id, public_id in rows})

        task_ids = business_ids_by_type.get("training_task", set()) | business_ids_by_type.get("task", set())
        if task_ids:
            rows = self.db.execute(
                select(TrainingTask.id, TrainingTask.public_id).where(TrainingTask.id.in_(task_ids))
            ).all()
            for row_id, public_id in rows:
                public_ids[("training_task", row_id)] = public_id
                public_ids[("task", row_id)] = public_id

        return public_ids

    def _get_announcement_by_public_id(self, announcement_public_id: UUID) -> Announcement:
        announcement = self.db.scalar(
            select(Announcement)
            .options(
                selectinload(Announcement.publisher),
                selectinload(Announcement.camp),
                selectinload(Announcement.camp_class).selectinload(CampClass.camp),
            )
            .where(Announcement.public_id == announcement_public_id)
        )
        if not announcement:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found.")
        return announcement

    def _get_task_by_public_id(self, task_public_id: UUID) -> TrainingTask:
        task = self.db.scalar(
            select(TrainingTask)
            .options(
                selectinload(TrainingTask.camp),
                selectinload(TrainingTask.camp_class),
                selectinload(TrainingTask.created_by),
            )
            .where(TrainingTask.public_id == task_public_id)
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

    def _get_notification_by_public_id(self, notification_public_id: UUID) -> Notification:
        notification = self.db.scalar(
            select(Notification)
            .options(selectinload(Notification.user))
            .where(Notification.public_id == notification_public_id)
        )
        if not notification:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
        return notification

    def _get_camp_by_public_id(self, camp_public_id: UUID) -> TrainingCamp:
        camp = self.db.scalar(select(TrainingCamp).where(TrainingCamp.public_id == camp_public_id))
        if not camp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training camp not found.")
        return camp

    def _get_class_by_public_id(self, class_public_id: UUID) -> CampClass:
        class_row = self.db.scalar(
            select(CampClass)
            .options(selectinload(CampClass.camp))
            .where(CampClass.public_id == class_public_id)
        )
        if not class_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found.")
        return class_row

    def _get_user_by_public_id(
        self,
        user_public_id: UUID,
        *,
        include_memberships: bool = False,
    ) -> User:
        stmt = select(User).where(User.public_id == user_public_id)
        if include_memberships:
            stmt = stmt.options(
                selectinload(User.class_members)
                .selectinload(ClassMember.camp_class)
                .selectinload(CampClass.camp)
            )
        user = self.db.scalar(stmt)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return user

    def _get_template_by_public_id(self, template_public_id: UUID) -> TrainingTemplate:
        template = self.db.scalar(
            select(TrainingTemplate).where(TrainingTemplate.public_id == template_public_id)
        )
        if not template:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training template not found.")
        return template

    def _get_template_version_by_public_id(
        self,
        template_id: int,
        version_public_id: UUID,
    ) -> TrainingTemplateVersion:
        version = self.db.scalar(
            select(TrainingTemplateVersion).where(
                TrainingTemplateVersion.template_id == template_id,
                TrainingTemplateVersion.public_id == version_public_id,
            )
        )
        if not version:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training template version not found.")
        return version

    def _get_example_video_by_public_id(
        self,
        template_id: int,
        video_public_id: UUID,
    ) -> TemplateExampleVideo:
        video = self.db.scalar(
            select(TemplateExampleVideo)
            .options(selectinload(TemplateExampleVideo.template))
            .where(
                TemplateExampleVideo.template_id == template_id,
                TemplateExampleVideo.public_id == video_public_id,
            )
        )
        if not video:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template example video not found.")
        return video

    def _ensure_unique_camp_code(self, code: str) -> None:
        if self.db.scalar(select(TrainingCamp.id).where(TrainingCamp.code == code)):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Training camp code already exists.")

    def _ensure_unique_class_code(self, camp_id: int, code: str) -> None:
        if self.db.scalar(
            select(CampClass.id).where(
                CampClass.camp_id == camp_id,
                CampClass.code == code,
            )
        ):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Class code already exists in camp.")

    def _ensure_unique_template_code(self, template_code: str) -> None:
        if self.db.scalar(select(TrainingTemplate.id).where(TrainingTemplate.template_code == template_code)):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Training template code already exists.")

    def _ensure_unique_template_version(self, template_id: int, version: str) -> None:
        if self.db.scalar(
            select(TrainingTemplateVersion.id).where(
                TrainingTemplateVersion.template_id == template_id,
                TrainingTemplateVersion.version == version,
            )
        ):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Training template version already exists.")

    def _class_counts_by_camp(self, camp_ids: list[int]) -> dict[int, int]:
        if not camp_ids:
            return {}

        rows = self.db.execute(
            select(CampClass.camp_id, func.count(CampClass.id))
            .where(CampClass.camp_id.in_(camp_ids))
            .group_by(CampClass.camp_id)
        ).all()
        return {camp_id: int(count) for camp_id, count in rows}

    def _member_counts_by_class(self, class_ids: list[int]) -> dict[int, dict[str, int]]:
        if not class_ids:
            return {}

        rows = self.db.execute(
            select(ClassMember.class_id, ClassMember.member_role, func.count(ClassMember.id))
            .where(
                ClassMember.class_id.in_(class_ids),
                ClassMember.status == "active",
            )
            .group_by(ClassMember.class_id, ClassMember.member_role)
        ).all()
        counts: dict[int, dict[str, int]] = {}
        for class_id, member_role, count in rows:
            counts.setdefault(class_id, {})[member_role] = int(count)
        return counts

    def _version_counts_by_template(self, template_ids: list[int]) -> dict[int, int]:
        if not template_ids:
            return {}

        rows = self.db.execute(
            select(TrainingTemplateVersion.template_id, func.count(TrainingTemplateVersion.id))
            .where(TrainingTemplateVersion.template_id.in_(template_ids))
            .group_by(TrainingTemplateVersion.template_id)
        ).all()
        return {template_id: int(count) for template_id, count in rows}
