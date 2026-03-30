from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum as SqlEnum, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import SessionStatus
from app.models.mixins import PublicIdMixin, TimestampMixin


class UserSession(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "user_sessions"
    __table_args__ = (
        Index("ix_user_sessions_user_id_status", "user_id", "status"),
        Index("ix_user_sessions_expire_at", "expire_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    refresh_token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    device_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    os: Mapped[str | None] = mapped_column(String(100), nullable=True)
    browser: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[SessionStatus] = mapped_column(
        SqlEnum(SessionStatus, name="session_status"),
        default=SessionStatus.active,
        nullable=False,
    )
    expire_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_active_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="user_sessions")
