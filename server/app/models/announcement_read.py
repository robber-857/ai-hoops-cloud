from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.mixins import PublicIdMixin, TimestampMixin


class AnnouncementRead(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "announcement_reads"
    __table_args__ = (
        UniqueConstraint("announcement_id", "user_id", name="uq_announcement_reads_announcement_user"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    announcement_id: Mapped[int] = mapped_column(ForeignKey("announcements.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    announcement = relationship("Announcement", back_populates="reads")
    user = relationship("User", back_populates="announcement_reads")
