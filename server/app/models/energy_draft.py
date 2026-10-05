from sqlalchemy import BigInteger, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base
from app.models.mixins import PublicIdMixin, TimestampMixin


class EnergyDraft(PublicIdMixin, TimestampMixin, Base):
    __tablename__ = 'energy_review_drafts'
    __table_args__ = (
        UniqueConstraint('lesson_id','revision',name='uq_energy_draft_revision'),
        UniqueConstraint('lesson_id','request_id',name='uq_energy_draft_request'),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey('camp_lessons.id'))
    revision: Mapped[int] = mapped_column(Integer)
    created_by: Mapped[int] = mapped_column(ForeignKey('users.id'))
    request_id = mapped_column(UUID(as_uuid=True), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64))
    snapshot: Mapped[dict] = mapped_column(JSONB)
