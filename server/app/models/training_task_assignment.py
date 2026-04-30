from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.mixins import PublicIdMixin, TimestampMixin


class TrainingTaskAssignment(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "training_task_assignments"
    __table_args__ = (
        UniqueConstraint("task_id", "student_id", name="uq_training_task_assignments_task_student"),
        Index("ix_training_task_assignments_student_status", "student_id", "status"),
        Index("ix_training_task_assignments_class_status", "class_id", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("training_tasks.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    class_id: Mapped[int] = mapped_column(ForeignKey("camp_classes.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    progress_percent: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    completed_sessions: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    best_score: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    latest_report_id: Mapped[int | None] = mapped_column(ForeignKey("analysis_reports.id"), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_submission_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    task = relationship("TrainingTask", back_populates="assignments")
    student = relationship("User", back_populates="training_task_assignments")
    camp_class = relationship("CampClass")
    latest_report = relationship("AnalysisReport", foreign_keys=[latest_report_id], post_update=True)
    training_sessions = relationship("TrainingSession", back_populates="task_assignment")
    student_achievements = relationship("StudentAchievement", back_populates="source_task_assignment")
