"""Persist private training assistant conversations and completed question-answer turns."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261123_0017"
down_revision = "20261123_0016"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "assistant_conversations",
        sa.Column("public_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("player_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("creation_request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(80), nullable=False),
        sa.Column("archived", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("turn_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("pending_token", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("pending_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("player_id", "creation_request_id", name="uq_assistant_conversation_creation"),
        sa.CheckConstraint("turn_count >= 0", name="ck_assistant_conversation_turn_count"),
    )
    op.create_index("ix_assistant_conversations_history", "assistant_conversations",
                    ["player_id", "archived", "updated_at", "public_id"])
    op.create_table(
        "assistant_conversation_turns",
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("assistant_conversations.public_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("number", sa.Integer(), primary_key=True),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("recommendations", postgresql.JSONB(), nullable=False),
        sa.Column("training_priorities", postgresql.JSONB(none_as_null=True), nullable=True),
        sa.Column("asked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("conversation_id", "request_id", name="uq_assistant_conversation_turn_request"),
        sa.CheckConstraint("number > 0", name="ck_assistant_conversation_turn_number"),
        sa.CheckConstraint(
            "training_priorities IS NULL OR (jsonb_typeof(training_priorities) = 'array' "
            "AND jsonb_array_length(training_priorities) BETWEEN 1 AND 2)",
            name="ck_assistant_turn_training_priorities",
        ),
    )
    op.create_index(
        "ix_assistant_turns_with_priorities", "assistant_conversation_turns", ["conversation_id", "answered_at"],
        postgresql_where=sa.text("training_priorities IS NOT NULL"),
    )


def downgrade():
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM assistant_conversations) THEN
                RAISE EXCEPTION 'Training assistant conversations exist; preserve them before downgrading';
            END IF;
        END $$;
    """)
    op.drop_table("assistant_conversation_turns")
    op.drop_table("assistant_conversations")
