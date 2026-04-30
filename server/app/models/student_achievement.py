from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.mixins import PublicIdMixin, TimestampMixin


class StudentAchievement(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "student_achievements"
    __table_args__ = (
        UniqueConstraint("student_id", "achievement_id", name="uq_student_achievements_student_achievement"),
        Index("ix_student_achievements_student_unlocked_at", "student_id", "unlocked_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    achievement_id: Mapped[int] = mapped_column(ForeignKey("achievements.id"), nullable=False)
    source_report_id: Mapped[int | None] = mapped_column(ForeignKey("analysis_reports.id"), nullable=True)
    source_task_assignment_id: Mapped[int | None] = mapped_column(
        ForeignKey("training_task_assignments.id"),
        nullable=True,
    )
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    student = relationship("User", back_populates="student_achievements")
    achievement = relationship("Achievement", back_populates="student_achievements")
    source_report = relationship("AnalysisReport")
    source_task_assignment = relationship("TrainingTaskAssignment", back_populates="student_achievements")
