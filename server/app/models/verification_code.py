from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class VerificationScene(str, Enum):
    register = "register"
    login = "login"
    reset_password = "reset_password"


class VerificationTargetType(str, Enum):
    phone = "phone"
    email = "email"


class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    target: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    target_type: Mapped[VerificationTargetType] = mapped_column(
        SqlEnum(VerificationTargetType),
        nullable=False,
    )
    scene: Mapped[VerificationScene] = mapped_column(
        SqlEnum(VerificationScene),
        nullable=False,
    )
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    expired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
