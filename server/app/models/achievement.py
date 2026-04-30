from __future__ import annotations

from sqlalchemy import BigInteger, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.mixins import PublicIdMixin, TimestampMixin


class Achievement(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rule_type: Mapped[str] = mapped_column(String(30), nullable=False)
    rule_config: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)

    student_achievements = relationship("StudentAchievement", back_populates="achievement")
