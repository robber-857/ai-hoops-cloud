from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.mixins import PublicIdMixin, TimestampMixin


class Announcement(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "announcements"
    __table_args__ = (
        Index("ix_announcements_scope_publish_at", "scope_type", "publish_at"),
        Index("ix_announcements_target_role_publish_at", "target_role", "publish_at"),
        Index("ix_announcements_class_publish_at", "class_id", "publish_at"),
        Index("ix_announcements_camp_publish_at", "camp_id", "publish_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    publisher_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    scope_type: Mapped[str] = mapped_column(String(20), nullable=False)
    target_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    camp_id: Mapped[int | None] = mapped_column(ForeignKey("training_camps.id"), nullable=True)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("camp_classes.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    publish_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expire_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    publisher = relationship("User", back_populates="announcements")
    camp = relationship("TrainingCamp", back_populates="announcements")
    camp_class = relationship("CampClass", back_populates="announcements")
    reads = relationship("AnnouncementRead", back_populates="announcement")
