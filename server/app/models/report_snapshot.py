from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.mixins import PublicIdMixin


class ReportSnapshot(PublicIdMixin, Base):
    __tablename__ = "report_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("analysis_reports.id"), nullable=False, index=True)
    template_version: Mapped[str] = mapped_column(String(50), nullable=False)
    score_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    timeline_data: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    summary_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    report = relationship("AnalysisReport", back_populates="snapshots")
