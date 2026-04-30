from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.mixins import PublicIdMixin, TimestampMixin


class TrainingTemplateVersion(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "training_template_versions"
    __table_args__ = (
        UniqueConstraint("template_id", "version", name="uq_training_template_versions_template_version"),
        Index("ix_training_template_versions_template_status", "template_id", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("training_templates.id"), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    scoring_rules: Mapped[dict] = mapped_column(JSONB, nullable=False)
    metric_definitions: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    mediapipe_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    summary_template: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    template = relationship("TrainingTemplate", back_populates="versions")
