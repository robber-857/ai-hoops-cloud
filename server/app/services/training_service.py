from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.analysis_report import AnalysisReport
from app.models.camp_class import CampClass
from app.models.class_member import ClassMember
from app.models.enums import StorageProvider, UploadTaskStatus, UserRole, VideoUploadStatus, VideoVisibility
from app.models.training_session import TrainingSession
from app.models.training_task_assignment import TrainingTaskAssignment
from app.models.upload_task import UploadTask
from app.models.user import User
from app.models.video import Video
from app.schemas.training import (
    TrainingSessionRead,
    UploadCompleteRequest,
    UploadCompleteResponse,
    UploadInitRequest,
    UploadInitResponse,
    VideoRead,
)


STUDENT_ROLES = {UserRole.user, UserRole.student}


def _numeric_to_float(value: Decimal | float | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _sanitize_file_name(file_name: str) -> str:
    suffix = Path(file_name).suffix
    stem = Path(file_name).stem or "video"
    safe_stem = re.sub(r"[^A-Za-z0-9_-]+", "-", stem).strip("-") or "video"
    safe_suffix = re.sub(r"[^A-Za-z0-9.]+", "", suffix)
    return f"{safe_stem}{safe_suffix}"[:255]


def _video_read(video: Video) -> VideoRead:
    return VideoRead(
        public_id=video.public_id,
        storage_provider=video.storage_provider,
        bucket_name=video.bucket_name,
        object_key=video.object_key,
        file_name=video.file_name,
        original_file_name=video.original_file_name,
        content_type=video.content_type,
        file_size=video.file_size,
        url=video.url,
        cdn_url=video.cdn_url,
        upload_status=video.upload_status.value,
        duration_seconds=_numeric_to_float(video.duration_seconds),
        width=video.width,
        height=video.height,
        fps=_numeric_to_float(video.fps),
        created_at=video.created_at,
    )


def _session_read(session: TrainingSession) -> TrainingSessionRead:
    return TrainingSessionRead(
        public_id=session.public_id,
        student_public_id=session.student.public_id,
        class_public_id=session.camp_class.public_id if session.camp_class else None,
        task_assignment_public_id=session.task_assignment.public_id if session.task_assignment else None,
        analysis_type=session.analysis_type,
        template_code=session.template_code,
        template_version=session.template_version,
        source_type=session.source_type,
        status=session.status,
        started_at=session.started_at,
        uploaded_at=session.uploaded_at,
        analysis_started_at=session.analysis_started_at,
        completed_at=session.completed_at,
        created_at=session.created_at,
        video=_video_read(session.video) if session.video else None,
    )


class TrainingService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def init_upload(self, current_user: User, payload: UploadInitRequest) -> UploadInitResponse:
        self._ensure_student_role(current_user)

        now = datetime.now(timezone.utc)
        class_row: CampClass | None = None
        task_assignment: TrainingTaskAssignment | None = None

        if payload.class_public_id:
            class_row = self._get_class_for_student(current_user.id, payload.class_public_id)

        if payload.task_assignment_public_id:
            task_assignment = self._get_task_assignment_for_student(current_user.id, payload.task_assignment_public_id)
            if not class_row and task_assignment.camp_class:
                class_row = task_assignment.camp_class

        session = TrainingSession(
            student_id=current_user.id,
            camp_id=class_row.camp_id if class_row else None,
            class_id=class_row.id if class_row else None,
            task_assignment_id=task_assignment.id if task_assignment else None,
            analysis_type=payload.analysis_type,
            template_code=payload.template_code,
            template_version=payload.template_version,
            source_type="coach_task" if task_assignment else payload.source_type,
            status="uploading",
            started_at=now,
        )
        self.db.add(session)
        self.db.flush()

        safe_file_name = _sanitize_file_name(payload.file_name)
        object_key = f"students/{current_user.public_id}/sessions/{session.public_id}/{int(now.timestamp())}_{safe_file_name}"
        expires_at = now + timedelta(hours=24)

        upload_task = UploadTask(
            user_id=current_user.id,
            session_id=session.id,
            analysis_type=payload.analysis_type,
            storage_provider=StorageProvider.supabase,
            bucket_name=settings.upload_video_bucket,
            object_key=object_key,
            status=UploadTaskStatus.created,
            file_name=safe_file_name,
            content_type=payload.content_type,
            file_size=payload.file_size,
            presigned_url_expire_at=expires_at,
        )
        self.db.add(upload_task)
        self.db.commit()
        self.db.refresh(session)
        self.db.refresh(upload_task)

        return UploadInitResponse(
            session_public_id=session.public_id,
            upload_task_public_id=upload_task.public_id,
            storage_provider=upload_task.storage_provider,
            bucket_name=upload_task.bucket_name,
            object_key=upload_task.object_key,
            upload_strategy="client_direct_supabase",
            upload_expires_at=upload_task.presigned_url_expire_at,
        )

    def complete_upload(
        self,
        current_user: User,
        payload: UploadCompleteRequest,
    ) -> UploadCompleteResponse:
        self._ensure_student_role(current_user)

        upload_task = self.db.scalar(
            select(UploadTask)
            .options(selectinload(UploadTask.session), selectinload(UploadTask.video))
            .where(UploadTask.public_id == payload.upload_task_public_id, UploadTask.user_id == current_user.id)
        )
        if not upload_task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload task not found.")

        if upload_task.video and upload_task.status == UploadTaskStatus.uploaded:
            return UploadCompleteResponse(
                session_public_id=upload_task.session.public_id,
                upload_task_public_id=upload_task.public_id,
                video=_video_read(upload_task.video),
            )

        now = datetime.now(timezone.utc)
        stored_file_name = Path(upload_task.object_key).name

        video = Video(
            user_id=current_user.id,
            storage_provider=upload_task.storage_provider,
            bucket_name=upload_task.bucket_name,
            object_key=upload_task.object_key,
            file_name=stored_file_name,
            original_file_name=payload.original_file_name or upload_task.file_name,
            content_type=upload_task.content_type,
            file_size=upload_task.file_size,
            url=payload.url,
            cdn_url=payload.cdn_url,
            checksum_md5=payload.checksum_md5,
            etag=payload.etag,
            upload_status=VideoUploadStatus.uploaded,
            visibility=VideoVisibility.private,
            duration_seconds=payload.duration_seconds,
            width=payload.width,
            height=payload.height,
            fps=payload.fps,
        )
        self.db.add(video)
        self.db.flush()

        upload_task.video_id = video.id
        upload_task.status = UploadTaskStatus.uploaded
        upload_task.completed_at = now

        session = upload_task.session
        session.video_id = video.id
        session.status = "uploaded"
        session.uploaded_at = now

        self.db.add_all([video, upload_task, session])
        self.db.commit()
        self.db.refresh(video)
        self.db.refresh(session)

        return UploadCompleteResponse(
            session_public_id=session.public_id,
            upload_task_public_id=upload_task.public_id,
            video=_video_read(video),
        )

    def get_my_sessions(self, current_user: User, limit: int = 20) -> list[TrainingSessionRead]:
        sessions = self.db.scalars(
            select(TrainingSession)
            .options(
                selectinload(TrainingSession.student),
                selectinload(TrainingSession.camp_class),
                selectinload(TrainingSession.task_assignment),
                selectinload(TrainingSession.video),
            )
            .where(TrainingSession.student_id == current_user.id)
            .order_by(TrainingSession.created_at.desc())
            .limit(limit)
        ).all()
        return [_session_read(session) for session in sessions]

    def _ensure_student_role(self, current_user: User) -> None:
        if current_user.role not in STUDENT_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only students can upload training videos.",
            )

    def _get_class_for_student(self, student_id: int, class_public_id: UUID) -> CampClass:
        class_row = self.db.scalar(
            select(CampClass)
            .join(ClassMember, ClassMember.class_id == CampClass.id)
            .where(
                CampClass.public_id == class_public_id,
                ClassMember.user_id == student_id,
                ClassMember.member_role == "student",
                ClassMember.status == "active",
            )
        )
        if not class_row:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not belong to the requested class.",
            )
        return class_row

    def _get_task_assignment_for_student(
        self,
        student_id: int,
        assignment_public_id: UUID,
    ) -> TrainingTaskAssignment:
        assignment = self.db.scalar(
            select(TrainingTaskAssignment)
            .options(selectinload(TrainingTaskAssignment.camp_class))
            .where(
                TrainingTaskAssignment.public_id == assignment_public_id,
                TrainingTaskAssignment.student_id == student_id,
            )
        )
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Training task assignment not found.",
            )
        return assignment
