from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum as SqlEnum, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import StorageProvider, VideoUploadStatus, VideoVisibility
from app.models.mixins import PublicIdMixin, TimestampMixin


class Video(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "videos"
    __table_args__ = (
        UniqueConstraint("bucket_name", "object_key", name="uq_videos_bucket_object_key"),
        Index("ix_videos_user_id_created_at", "user_id", "created_at"),
        Index("ix_videos_upload_status", "upload_status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    storage_provider: Mapped[StorageProvider] = mapped_column(
        SqlEnum(StorageProvider, name="storage_provider"),
        default=StorageProvider.s3,
        nullable=False,
    )
    bucket_name: Mapped[str] = mapped_column(String(100), nullable=False)
    object_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    cdn_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    checksum_md5: Mapped[str | None] = mapped_column(String(64), nullable=True)
    etag: Mapped[str | None] = mapped_column(String(255), nullable=True)
    upload_status: Mapped[VideoUploadStatus] = mapped_column(
        SqlEnum(VideoUploadStatus, name="video_upload_status"),
        default=VideoUploadStatus.pending,
        nullable=False,
    )
    visibility: Mapped[VideoVisibility] = mapped_column(
        SqlEnum(VideoVisibility, name="video_visibility"),
        default=VideoVisibility.private,
        nullable=False,
    )
    duration_seconds: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fps: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="videos")
    upload_tasks = relationship("UploadTask", back_populates="video")
    analysis_reports = relationship("AnalysisReport", back_populates="video")
    training_sessions = relationship("TrainingSession", back_populates="video")
