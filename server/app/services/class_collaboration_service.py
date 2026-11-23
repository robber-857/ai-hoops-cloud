from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, selectinload

from app.models.camp_class import CampClass
from app.models.class_collaboration import ClassInvitation, ClassJoinRequest, ClassVideo
from app.models.class_member import ClassMember
from app.models.enums import ADMIN_ROLES, UserRole, UserStatus
from app.models.notification import Notification
from app.models.user import User
from app.schemas.class_collaboration import (
    ClassInvitationIssued,
    ClassInvitationPreview,
    ClassInvitationStatus,
    ClassJoinRequestRead,
    ClassJoinStatus,
    ClassVideoRead,
    ClassVideosPage,
)
from app.services.coach_service import CoachService
from app.services.display_names import staff_display_name

INVITATION_LIFETIME = timedelta(days=7)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


class ClassCollaborationService:
    def __init__(self, db: Session):
        self.db = db

    def _lock_class(self, class_id: int) -> CampClass:
        return self.db.execute(
            select(CampClass).where(CampClass.id == class_id).with_for_update()
            .execution_options(populate_existing=True)
        ).scalar_one()

    def _require_active_class(self, class_row: CampClass) -> None:
        if class_row.status != "active":
            raise HTTPException(409, "This class is no longer open.")

    def _active_invitation(self, invitation: ClassInvitation | None) -> bool:
        return bool(invitation and invitation.revoked_at is None and invitation.expires_at > _now())

    def _find_invitation(self, token: str, *, lock_class: bool = False):
        token_hash = _token_hash(token)
        match = self.db.execute(
            select(CampClass, ClassInvitation)
            .join(ClassInvitation, ClassInvitation.class_id == CampClass.id)
            .options(selectinload(CampClass.camp))
            .where(ClassInvitation.token_hash == token_hash)
        ).one_or_none()
        if match:
            class_row, invitation = match
            if lock_class:
                class_row = self._lock_class(class_row.id)
                self.db.refresh(invitation)
            if (class_row.status == "active" and invitation.token_hash == token_hash
                    and self._active_invitation(invitation)):
                return class_row, invitation
        raise HTTPException(404, "This invitation is invalid, expired, or withdrawn.")

    def invitation_status(self, user: User, class_public_id: UUID) -> ClassInvitationStatus:
        class_row = CoachService(self.db)._get_accessible_class(user, class_public_id)
        invitation = self.db.get(ClassInvitation, class_row.id)
        return ClassInvitationStatus(
            active=class_row.status == "active" and self._active_invitation(invitation),
            expires_at=invitation.expires_at if invitation else None,
        )

    def issue_invitation(self, user: User, class_public_id: UUID) -> ClassInvitationIssued:
        accessible = CoachService(self.db)._get_accessible_class(user, class_public_id)
        class_row = self._lock_class(accessible.id)
        self._require_active_class(class_row)
        token = secrets.token_urlsafe(32)
        now = _now()
        expires_at = now + INVITATION_LIFETIME
        invitation = self.db.get(ClassInvitation, class_row.id) or ClassInvitation(class_id=class_row.id)
        invitation.token_hash = _token_hash(token)
        invitation.issued_by_user_id = user.id
        invitation.issued_at = now
        invitation.expires_at = expires_at
        invitation.revoked_at = None
        self.db.add(invitation)
        self.db.commit()
        return ClassInvitationIssued(token=token, expires_at=expires_at)

    def revoke_invitation(self, user: User, class_public_id: UUID) -> None:
        accessible = CoachService(self.db)._get_accessible_class(user, class_public_id)
        class_row = self._lock_class(accessible.id)
        invitation = self.db.get(ClassInvitation, class_row.id)
        if invitation and invitation.revoked_at is None:
            invitation.revoked_at = _now()
        self.db.commit()

    def preview_invitation(self, token: str) -> ClassInvitationPreview:
        class_row, _ = self._find_invitation(token)
        return ClassInvitationPreview(class_name=class_row.name, course_name=class_row.camp.name)

    def apply(self, user: User, token: str) -> ClassJoinStatus:
        if user.role != UserRole.student:
            raise HTTPException(403, "Use a student account to apply to join this class.")
        class_row, invitation = self._find_invitation(token, lock_class=True)
        class_details = {"class_name": class_row.name, "course_name": class_row.camp.name}
        if self._student_membership_active(class_row.id, user.id):
            return ClassJoinStatus(status="approved", **class_details)

        request = self.db.scalar(select(ClassJoinRequest).where(
            ClassJoinRequest.class_id == class_row.id, ClassJoinRequest.student_id == user.id,
        ))
        if request:
            if request.status == "pending":
                return ClassJoinStatus(status="pending", **class_details)
            if invitation.issued_at <= request.requested_at:
                if request.status == "approved":
                    raise HTTPException(409, "Your membership has ended. Ask your coach for a new invitation.")
                return ClassJoinStatus(status="declined", **class_details)

        if request is None:
            request = ClassJoinRequest(class_id=class_row.id, student_id=user.id)
        request.status = "pending"
        request.requested_at = _now()
        request.reviewed_at = None
        request.reviewed_by_user_id = None
        self.db.add(request)
        self.db.commit()
        return ClassJoinStatus(status="pending", **class_details)

    def _student_membership_active(self, class_id: int, student_id: int) -> bool:
        return self.db.scalar(select(ClassMember.id).where(
            ClassMember.class_id == class_id, ClassMember.user_id == student_id,
            ClassMember.member_role == "student", ClassMember.status == "active",
        )) is not None

    def _request_read(self, request: ClassJoinRequest, student: User) -> ClassJoinRequestRead:
        return ClassJoinRequestRead(
            public_id=request.public_id,
            student_name=staff_display_name(student),
            status=request.status,
            requested_at=request.requested_at,
            reviewed_at=request.reviewed_at,
        )

    def list_requests(self, user: User, class_public_id: UUID) -> list[ClassJoinRequestRead]:
        class_row = CoachService(self.db)._get_accessible_class(user, class_public_id)
        requests = self.db.execute(
            select(ClassJoinRequest, User).join(User, User.id == ClassJoinRequest.student_id)
            .where(ClassJoinRequest.class_id == class_row.id)
            .order_by((ClassJoinRequest.status == "pending").desc(), ClassJoinRequest.requested_at.desc())
        ).all()
        return [self._request_read(request, student) for request, student in requests]

    def review_request(
        self, user: User, class_public_id: UUID, request_public_id: UUID, decision: str,
    ) -> ClassJoinRequestRead:
        accessible = CoachService(self.db)._get_accessible_class(user, class_public_id)
        class_row = self._lock_class(accessible.id)
        match = self.db.execute(
            select(ClassJoinRequest, User).join(User, User.id == ClassJoinRequest.student_id)
            .where(ClassJoinRequest.class_id == class_row.id, ClassJoinRequest.public_id == request_public_id)
        ).one_or_none()
        if not match:
            raise HTTPException(404, "Join request not found.")
        request, student = match
        if request.status == decision:
            return self._request_read(request, student)
        if request.status != "pending":
            raise HTTPException(409, "This request has already been reviewed.")

        now = _now()
        if decision == "approved":
            self._require_active_class(class_row)
            if student.role != UserRole.student or student.status != UserStatus.active or student.deleted_at is not None:
                raise HTTPException(409, "This student account is no longer active.")
            if not self._student_membership_active(class_row.id, student.id):
                self._approve_membership(class_row, student, now)

        request.status = decision
        request.reviewed_at = now
        request.reviewed_by_user_id = user.id
        self.db.add(Notification(
            user_id=student.id, type="class_join_request", title=f"Class request {decision}",
            content=f"Your request to join {class_row.name} was {decision}.",
            business_type="class_join_request", business_id=request.id,
        ))
        self.db.commit()
        return self._request_read(request, student)

    def _approve_membership(self, class_row: CampClass, student: User, now: datetime) -> None:
        if class_row.max_students is not None:
            active_count = self.db.scalar(select(func.count()).select_from(ClassMember).where(
                ClassMember.class_id == class_row.id, ClassMember.member_role == "student",
                ClassMember.status == "active",
            ))
            if active_count >= class_row.max_students:
                raise HTTPException(409, "This class has reached its student limit.")

        self.db.execute(insert(ClassMember).values(
            class_id=class_row.id, user_id=student.id, member_role="student", status="active", joined_at=now,
        ).on_conflict_do_update(
            constraint="uq_class_members_class_user_role",
            set_={"status": "active", "joined_at": now, "left_at": None, "updated_at": now},
            where=ClassMember.status != "active",
        ))

    def class_for_upload(self, user: User, class_public_id: UUID) -> int:
        class_row = CoachService(self.db)._get_accessible_class(user, class_public_id)
        self._require_active_class(class_row)
        return class_row.id

    def publish_video(
        self, user: User, class_public_id: UUID, *, title: str, object_key: str, content_type: str, size_bytes: int,
    ) -> ClassVideoRead:
        class_id = self.class_for_upload(user, class_public_id)
        class_row = self._lock_class(class_id)
        self._require_active_class(class_row)
        video = ClassVideo(
            class_id=class_id, uploader_id=user.id, title=title, object_key=object_key,
            content_type=content_type, size_bytes=size_bytes,
        )
        self.db.add(video)
        self.db.flush()
        result = self._video_read(video, class_row, user)
        self.db.commit()
        return result

    def _video_rows(self):
        return (
            select(ClassVideo, CampClass, User)
            .join(CampClass, CampClass.id == ClassVideo.class_id)
            .join(User, User.id == ClassVideo.uploader_id)
            .where(ClassVideo.archived_at.is_(None))
        )

    def _restrict_videos(self, stmt, user: User):
        if user.role in ADMIN_ROLES:
            return stmt
        if user.role not in (UserRole.coach, UserRole.student):
            return stmt.where(False)
        return stmt.join(ClassMember, ClassMember.class_id == ClassVideo.class_id).where(
            ClassMember.user_id == user.id, ClassMember.status == "active",
            ClassMember.member_role == user.role.value,
        )

    def _video_read(self, video: ClassVideo, class_row: CampClass, uploader: User) -> ClassVideoRead:
        return ClassVideoRead(
            public_id=video.public_id, class_public_id=class_row.public_id,
            class_name=class_row.name, title=video.title, uploader_name=staff_display_name(uploader),
            created_at=video.created_at,
        )

    def list_videos(self, user: User, offset: int, limit: int, class_public_id: UUID | None = None) -> ClassVideosPage:
        stmt = self._restrict_videos(self._video_rows(), user)
        if class_public_id is not None:
            class_row = CoachService(self.db)._get_accessible_class(user, class_public_id)
            stmt = stmt.where(ClassVideo.class_id == class_row.id)
        rows = self.db.execute(
            stmt.order_by(ClassVideo.created_at.desc(), ClassVideo.id.desc()).offset(offset).limit(limit + 1)
        ).all()
        return ClassVideosPage(items=[self._video_read(*row) for row in rows[:limit]], has_more=len(rows) > limit)

    def get_video_object_key(self, user: User, video_public_id: UUID) -> str:
        stmt = self._restrict_videos(self._video_rows(), user).where(ClassVideo.public_id == video_public_id)
        video = self.db.scalars(stmt).one_or_none()
        if video is None:
            raise HTTPException(404, "Class video not found.")
        return video.object_key

    def archive_video(self, user: User, class_public_id: UUID, video_public_id: UUID) -> None:
        class_row = CoachService(self.db)._get_accessible_class(user, class_public_id)
        result = self.db.execute(update(ClassVideo).where(
            ClassVideo.class_id == class_row.id, ClassVideo.public_id == video_public_id,
            ClassVideo.archived_at.is_(None),
        ).values(archived_at=_now()))
        if result.rowcount == 0:
            raise HTTPException(404, "Class video not found.")
        self.db.commit()
