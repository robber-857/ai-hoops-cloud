from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as SqlUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ReportFeedback(Base):
    __tablename__ = "report_feedback"
    __table_args__ = (
        UniqueConstraint("report_id", "author_id", "request_id", name="uq_report_feedback_request"),
        Index("ix_report_feedback_report_created", "report_id", "created_at"),
    )

    public_id: Mapped[UUID] = mapped_column(SqlUUID(as_uuid=True), primary_key=True, default=uuid4)
    report_id: Mapped[int] = mapped_column(ForeignKey("analysis_reports.id"), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    request_id: Mapped[UUID] = mapped_column(SqlUUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
