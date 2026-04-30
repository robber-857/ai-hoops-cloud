from __future__ import annotations

from datetime import date

from sqlalchemy import BigInteger, Date, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.mixins import PublicIdMixin, TimestampMixin


class TrainingCamp(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "training_camps"
    __table_args__ = (
        Index("ix_training_camps_status", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    season_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    classes = relationship("CampClass", back_populates="camp")
    training_sessions = relationship("TrainingSession", back_populates="camp")
    training_tasks = relationship("TrainingTask", back_populates="camp")
    announcements = relationship("Announcement", back_populates="camp")
