from __future__ import annotations

from sqlalchemy import BigInteger, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from sqlalchemy import Enum as SqlEnum

from app.models.base import Base
from app.models.enums import StorageProvider
from app.models.mixins import PublicIdMixin, TimestampMixin


class TemplateExampleVideo(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "template_example_videos"
    __table_args__ = (
        Index("ix_template_example_videos_template_status_sort", "template_id", "status", "sort_order"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("training_templates.id"), nullable=False)
    template_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    storage_provider: Mapped[StorageProvider] = mapped_column(
        SqlEnum(StorageProvider, name="storage_provider", create_type=False),
        default=StorageProvider.supabase,
        nullable=False,
    )
    bucket_name: Mapped[str] = mapped_column(String(100), nullable=False)
    object_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    duration_seconds: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    created_by_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    template = relationship("TrainingTemplate", back_populates="example_videos")
