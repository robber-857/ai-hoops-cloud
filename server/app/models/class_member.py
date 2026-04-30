from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.mixins import PublicIdMixin, TimestampMixin


class ClassMember(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "class_members"
    __table_args__ = (
        UniqueConstraint("class_id", "user_id", "member_role", name="uq_class_members_class_user_role"),
        Index("ix_class_members_class_role_status", "class_id", "member_role", "status"),
        Index("ix_class_members_user_role_status", "user_id", "member_role", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("camp_classes.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    member_role: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    joined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    camp_class = relationship("CampClass", back_populates="class_members")
    user = relationship("User", back_populates="class_members")
