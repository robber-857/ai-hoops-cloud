"""Immutable lesson publications, separate from video scores and reports."""
from sqlalchemy import BigInteger, ForeignKey, Integer, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base
from app.models.mixins import PublicIdMixin, TimestampMixin

class LessonPublication(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = 'lesson_publications'
    __table_args__ = (UniqueConstraint('lesson_id', 'lesson_version', name='uq_lesson_publication_version'),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey('camp_lessons.id'))
    lesson_version: Mapped[int] = mapped_column(Integer)
    published_by_user_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    snapshot: Mapped[dict] = mapped_column(JSONB)

class ClassReport(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = 'class_reports'
    __table_args__ = (UniqueConstraint('publication_id', 'student_id', name='uq_class_report_recipient'), Index('ix_class_reports_student', 'student_id', 'id'))
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    publication_id: Mapped[int] = mapped_column(ForeignKey('lesson_publications.id'))
    student_id: Mapped[int] = mapped_column(ForeignKey('users.id'))
    snapshot: Mapped[dict] = mapped_column(JSONB)
