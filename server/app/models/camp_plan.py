from datetime import date, datetime
from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    CheckConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base
from app.models.mixins import PublicIdMixin, TimestampMixin


class CampPlan(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "camp_plans"
    __table_args__ = (
        CheckConstraint("status IN ('draft','published')", name="ck_camp_plan_status"),
        Index("ix_camp_plan_class_date", "class_id", "planned_on"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("camp_classes.id"))
    student_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(120))
    planned_on: Mapped[date] = mapped_column(Date)
    focus: Mapped[str] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    items: Mapped[list] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    version: Mapped[int] = mapped_column(Integer, default=1)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    supersedes_id: Mapped[int | None] = mapped_column(
        ForeignKey("camp_plans.id"), unique=True, nullable=True
    )
    creation_payload: Mapped[dict] = mapped_column(JSONB)
