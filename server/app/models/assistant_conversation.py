from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String,
    Text, UniqueConstraint, false, func, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AssistantConversation(Base):
    __tablename__ = "assistant_conversations"
    __table_args__ = (
        UniqueConstraint("player_id", "creation_request_id", name="uq_assistant_conversation_creation"),
        CheckConstraint("turn_count >= 0", name="ck_assistant_conversation_turn_count"),
        Index("ix_assistant_conversations_history", "player_id", "archived", "updated_at", "public_id"),
    )

    public_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    player_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"))
    creation_request_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True))
    title: Mapped[str] = mapped_column(String(80))
    archived: Mapped[bool] = mapped_column(Boolean, server_default=false())
    turn_count: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    pending_token: Mapped[UUID | None] = mapped_column(PgUUID(as_uuid=True))
    pending_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AssistantConversationTurn(Base):
    __tablename__ = "assistant_conversation_turns"
    __table_args__ = (
        UniqueConstraint("conversation_id", "request_id", name="uq_assistant_conversation_turn_request"),
        CheckConstraint("number > 0", name="ck_assistant_conversation_turn_number"),
        CheckConstraint(
            "training_priorities IS NULL OR (jsonb_typeof(training_priorities) = 'array' "
            "AND jsonb_array_length(training_priorities) BETWEEN 1 AND 2)",
            name="ck_assistant_turn_training_priorities",
        ).ddl_if(dialect="postgresql"),
        Index(
            "ix_assistant_turns_with_priorities", "conversation_id", "answered_at",
            postgresql_where=text("training_priorities IS NOT NULL"),
        ),
    )

    conversation_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("assistant_conversations.public_id", ondelete="CASCADE"), primary_key=True,
    )
    number: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    recommendations: Mapped[list[dict]] = mapped_column(JSONB)
    training_priorities: Mapped[list[dict[str, str]] | None] = mapped_column(JSONB(none_as_null=True))
    asked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
