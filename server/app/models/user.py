from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Enum as SqlEnum, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import UserRole, UserStatus
from app.models.mixins import PublicIdMixin, TimestampMixin


class User(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_created_at", "created_at"),
        Index(
            "ix_users_email_not_null",
            "email",
            unique=True,
            postgresql_where=text("email IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        nullable=False,
    )
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nickname: Mapped[str | None] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_phone_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    is_email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    status: Mapped[UserStatus] = mapped_column(
        SqlEnum(UserStatus, name="user_status"),
        default=UserStatus.active,
        nullable=False,
    )
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole, name="user_role"),
        default=UserRole.user,
        nullable=False,
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    verification_codes = relationship("VerificationCode", back_populates="user")
    user_sessions = relationship("UserSession", back_populates="user")
    videos = relationship("Video", back_populates="user")
    upload_tasks = relationship("UploadTask", back_populates="user")
    analysis_reports = relationship("AnalysisReport", back_populates="user")
    operation_logs = relationship("OperationLog", back_populates="user")

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.active
