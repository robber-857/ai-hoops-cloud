from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, Text
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import AnalysisType
from app.models.mixins import PublicIdMixin, TimestampMixin


class TrainingTask(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "training_tasks"
    __table_args__ = (
        Index("ix_training_tasks_class_status_due_at", "class_id", "status", "due_at"),
        Index("ix_training_tasks_created_by_created_at", "created_by_user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    camp_id: Mapped[int | None] = mapped_column(ForeignKey("training_camps.id"), nullable=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("camp_classes.id"), nullable=False)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    analysis_type: Mapped[AnalysisType | None] = mapped_column(
        SqlEnum(AnalysisType, name="analysis_type", create_type=False),
        nullable=True,
    )
    template_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    publish_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    camp = relationship("TrainingCamp", back_populates="training_tasks")
    camp_class = relationship("CampClass", back_populates="training_tasks")
    created_by = relationship("User", back_populates="created_training_tasks")
    assignments = relationship("TrainingTaskAssignment", back_populates="task")
