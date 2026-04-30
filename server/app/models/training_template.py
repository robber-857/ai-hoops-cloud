from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import AnalysisType
from app.models.mixins import PublicIdMixin, TimestampMixin
from sqlalchemy import Enum as SqlEnum


class TrainingTemplate(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "training_templates"
    __table_args__ = (
        Index("ix_training_templates_analysis_type_status", "analysis_type", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    template_code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    analysis_type: Mapped[AnalysisType] = mapped_column(
        SqlEnum(AnalysisType, name="analysis_type", create_type=False),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    difficulty_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    current_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    versions = relationship("TrainingTemplateVersion", back_populates="template")
    example_videos = relationship("TemplateExampleVideo", back_populates="template")
    analysis_reports = relationship("AnalysisReport", back_populates="training_template")
