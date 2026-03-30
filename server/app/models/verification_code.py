from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum as SqlEnum, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import (
    VerificationCodeStatus,
    VerificationScene,
    VerificationTargetType,
)
from app.models.mixins import PublicIdMixin, TimestampMixin


class VerificationCode(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "verification_codes"
    __table_args__ = (
        Index("ix_verification_codes_target_scene_status", "target", "scene", "status"),
        Index("ix_verification_codes_expire_at", "expire_at"),
        Index("ix_verification_codes_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    target: Mapped[str] = mapped_column(String(255), nullable=False)
    target_type: Mapped[VerificationTargetType] = mapped_column(
        SqlEnum(VerificationTargetType, name="verification_target_type"),
        nullable=False,
    )
    scene: Mapped[VerificationScene] = mapped_column(
        SqlEnum(VerificationScene, name="verification_scene"),
        nullable=False,
    )
    code: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[VerificationCodeStatus] = mapped_column(
        SqlEnum(VerificationCodeStatus, name="verification_code_status"),
        default=VerificationCodeStatus.pending,
        nullable=False,
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    expire_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    request_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    request_device: Mapped[str | None] = mapped_column(String(255), nullable=True)

    user = relationship("User", back_populates="verification_codes")
