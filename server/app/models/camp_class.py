from __future__ import annotations

from datetime import date

from sqlalchemy import BigInteger, Date, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.mixins import PublicIdMixin, TimestampMixin


class CampClass(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "camp_classes"
    __table_args__ = (
        UniqueConstraint("camp_id", "code", name="uq_camp_classes_camp_id_code"),
        Index("ix_camp_classes_camp_id_status", "camp_id", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    camp_id: Mapped[int] = mapped_column(ForeignKey("training_camps.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    age_group: Mapped[str | None] = mapped_column(String(50), nullable=True)
    max_students: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    updated_by_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    camp = relationship("TrainingCamp", back_populates="classes")
    class_members = relationship("ClassMember", back_populates="camp_class")
    training_sessions = relationship("TrainingSession", back_populates="camp_class")
    training_tasks = relationship("TrainingTask", back_populates="camp_class")
    announcements = relationship("Announcement", back_populates="camp_class")
