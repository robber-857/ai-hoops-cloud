from datetime import date
from sqlalchemy import BigInteger, Date, ForeignKey, Integer, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base
from app.models.mixins import PublicIdMixin, TimestampMixin


class CampLesson(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "camp_lessons"
    __table_args__ = (Index("ix_camp_lessons_class_date", "class_id", "held_on"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("camp_classes.id"))
    plan_id: Mapped[int] = mapped_column(ForeignKey("camp_plans.id"))
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    held_on: Mapped[date] = mapped_column(Date)
    version: Mapped[int] = mapped_column(Integer, default=1)
    content: Mapped[dict] = mapped_column(JSONB)
    source_plan: Mapped[dict] = mapped_column(JSONB)
    roster: Mapped[list] = mapped_column(JSONB)
    creation_payload: Mapped[dict] = mapped_column(JSONB)


class CampLessonRevision(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = "camp_lesson_revisions"
    __table_args__ = (
        UniqueConstraint("lesson_id", "version", name="uq_lesson_revision_version"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("camp_lessons.id"))
    version: Mapped[int] = mapped_column(Integer)
    saved_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    content: Mapped[dict] = mapped_column(JSONB)
    request_payload: Mapped[dict] = mapped_column(JSONB)
