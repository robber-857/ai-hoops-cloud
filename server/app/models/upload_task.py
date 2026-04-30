from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum as SqlEnum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import AnalysisType, StorageProvider, UploadTaskStatus
from app.models.mixins import PublicIdMixin, TimestampMixin


class UploadTask(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "upload_tasks"
    __table_args__ = (
        Index("ix_upload_tasks_user_id_status", "user_id", "status"),
        Index("ix_upload_tasks_video_id", "video_id"),
        Index("ix_upload_tasks_session_id", "session_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    session_id: Mapped[int] = mapped_column(ForeignKey("training_sessions.id"), nullable=False)
    video_id: Mapped[int | None] = mapped_column(ForeignKey("videos.id"), nullable=True)
    analysis_type: Mapped[AnalysisType | None] = mapped_column(
        SqlEnum(AnalysisType, name="analysis_type"),
        nullable=True,
    )
    storage_provider: Mapped[StorageProvider] = mapped_column(
        SqlEnum(StorageProvider, name="storage_provider", create_type=False),
        default=StorageProvider.supabase,
        nullable=False,
    )
    bucket_name: Mapped[str] = mapped_column(String(100), nullable=False)
    object_key: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[UploadTaskStatus] = mapped_column(
        SqlEnum(UploadTaskStatus, name="upload_task_status"),
        default=UploadTaskStatus.created,
        nullable=False,
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    presigned_url_expire_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    error_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="upload_tasks")
    session = relationship("TrainingSession", back_populates="upload_tasks")
    video = relationship("Video", back_populates="upload_tasks")
