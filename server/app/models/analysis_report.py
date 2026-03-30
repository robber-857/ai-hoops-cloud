from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Enum as SqlEnum, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import AnalysisType, ReportStatus
from app.models.mixins import PublicIdMixin, TimestampMixin


class AnalysisReport(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "analysis_reports"
    __table_args__ = (
        CheckConstraint("overall_score >= 0 AND overall_score <= 100", name="ck_analysis_reports_overall_score"),
        Index("ix_analysis_reports_user_id_created_at", "user_id", "created_at"),
        Index("ix_analysis_reports_video_id", "video_id"),
        Index("ix_analysis_reports_analysis_type_created_at", "analysis_type", "created_at"),
        Index("ix_analysis_reports_template_id", "template_id"),
        Index("ix_analysis_reports_overall_score", "overall_score"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    video_id: Mapped[int] = mapped_column(ForeignKey("videos.id"), nullable=False)
    analysis_type: Mapped[AnalysisType] = mapped_column(
        SqlEnum(AnalysisType, name="analysis_type", create_type=False),
        nullable=False,
    )
    template_id: Mapped[str] = mapped_column(String(100), nullable=False)
    template_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[ReportStatus] = mapped_column(
        SqlEnum(ReportStatus, name="report_status"),
        default=ReportStatus.completed,
        nullable=False,
    )
    overall_score: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    grade: Mapped[str | None] = mapped_column(String(10), nullable=True)
    score_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    timeline_data: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    summary_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    analysis_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    analysis_finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="analysis_reports")
    video = relationship("Video", back_populates="analysis_reports")
    snapshots = relationship("ReportSnapshot", back_populates="report")
