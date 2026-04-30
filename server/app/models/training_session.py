from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum as SqlEnum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import AnalysisType
from app.models.mixins import PublicIdMixin, TimestampMixin


class TrainingSession(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "training_sessions"
    __table_args__ = (
        Index("ix_training_sessions_student_id_created_at", "student_id", "created_at"),
        Index("ix_training_sessions_class_id_created_at", "class_id", "created_at"),
        Index("ix_training_sessions_task_assignment_id", "task_assignment_id"),
        Index("ix_training_sessions_status_created_at", "status", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    camp_id: Mapped[int | None] = mapped_column(ForeignKey("training_camps.id"), nullable=True)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("camp_classes.id"), nullable=True)
    task_assignment_id: Mapped[int | None] = mapped_column(
        ForeignKey("training_task_assignments.id"),
        nullable=True,
    )
    analysis_type: Mapped[AnalysisType] = mapped_column(
        SqlEnum(AnalysisType, name="analysis_type", create_type=False),
        nullable=False,
    )
    template_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    template_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_type: Mapped[str] = mapped_column(String(20), default="free_practice", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="created", nullable=False)
    video_id: Mapped[int | None] = mapped_column(ForeignKey("videos.id"), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    analysis_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    student = relationship("User", back_populates="training_sessions")
    camp = relationship("TrainingCamp", back_populates="training_sessions")
    camp_class = relationship("CampClass", back_populates="training_sessions")
    task_assignment = relationship("TrainingTaskAssignment", back_populates="training_sessions")
    video = relationship("Video", back_populates="training_sessions")
    upload_tasks = relationship("UploadTask", back_populates="session")
    analysis_reports = relationship("AnalysisReport", back_populates="session")
