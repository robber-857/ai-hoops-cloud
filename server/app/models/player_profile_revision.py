from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.mixins import PublicIdMixin


class PlayerProfileRevision(PublicIdMixin, Base):
    """Append-only measurements, separate from video scoring and report snapshots."""

    __tablename__ = "player_profile_revisions"
    __table_args__ = (
        Index("ix_player_profile_user_measured", "user_id", "measured_on", "created_at"),
        CheckConstraint("height_cm > 0 AND height_cm <= 300", name="ck_profile_height"),
        CheckConstraint("weight_kg > 0 AND weight_kg <= 500", name="ck_profile_weight"),
        CheckConstraint("date_of_birth < measured_on", name="ck_profile_dates"),
        CheckConstraint("sex IS NULL OR sex IN ('female', 'male')", name="ck_profile_sex"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    measured_on: Mapped[date] = mapped_column(Date, nullable=False)
    height_cm: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    sex: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
