from __future__ import annotations

from datetime import date

from sqlalchemy import BigInteger, Date, Enum as SqlEnum, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import AnalysisType
from app.models.mixins import PublicIdMixin, TimestampMixin


class StudentGrowthSnapshot(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "student_growth_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "snapshot_date",
            "period_type",
            "analysis_type",
            name="uq_student_growth_snapshots_student_date_period_analysis",
        ),
        Index("ix_student_growth_snapshots_student_date", "student_id", "snapshot_date"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_type: Mapped[str] = mapped_column(String(20), nullable=False)
    analysis_type: Mapped[AnalysisType | None] = mapped_column(
        SqlEnum(AnalysisType, name="analysis_type", create_type=False),
        nullable=True,
    )
    session_count: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    average_score: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    best_score: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    training_days_count: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    streak_days: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    improvement_delta: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    metric_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    student = relationship("User", back_populates="student_growth_snapshots")
