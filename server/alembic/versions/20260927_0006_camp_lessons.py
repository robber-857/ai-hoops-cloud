"""Actual class lessons and append-only save history, separate from video sessions."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260927_0006"
down_revision = "20260927_0005"
branch_labels = None
depends_on = None


def common_columns():
    return [
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "public_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    ]


def upgrade():
    op.create_table(
        "camp_lessons",
        *common_columns(),
        sa.Column(
            "class_id",
            sa.BigInteger(),
            sa.ForeignKey("camp_classes.id"),
            nullable=False,
        ),
        sa.Column(
            "plan_id", sa.BigInteger(), sa.ForeignKey("camp_plans.id"), nullable=False
        ),
        sa.Column(
            "created_by_user_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("held_on", sa.Date(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("source_plan", postgresql.JSONB(), nullable=False),
        sa.Column("roster", postgresql.JSONB(), nullable=False),
        sa.Column("creation_payload", postgresql.JSONB(), nullable=False)
    )
    op.create_index(
        "ix_camp_lessons_class_date", "camp_lessons", ["class_id", "held_on"]
    )
    op.create_table(
        "camp_lesson_revisions",
        *common_columns(),
        sa.Column(
            "lesson_id",
            sa.BigInteger(),
            sa.ForeignKey("camp_lessons.id"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column(
            "saved_by_user_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("request_payload", postgresql.JSONB(), nullable=False),
        sa.UniqueConstraint("lesson_id", "version", name="uq_lesson_revision_version")
    )
    op.execute(
        """CREATE FUNCTION protect_camp_lesson_revision() RETURNS trigger AS $$ BEGIN
      RAISE EXCEPTION 'Lesson history is append-only'; END; $$ LANGUAGE plpgsql"""
    )
    op.execute(
        "CREATE TRIGGER camp_lesson_revision_immutable BEFORE UPDATE OR DELETE ON camp_lesson_revisions FOR EACH ROW EXECUTE FUNCTION protect_camp_lesson_revision()"
    )


def downgrade():
    op.execute(
        """DO $$ BEGIN IF EXISTS (SELECT 1 FROM camp_lessons) THEN
      RAISE EXCEPTION 'Cannot downgrade populated lessons; use a forward migration'; END IF; END $$"""
    )
    op.drop_table("camp_lesson_revisions")
    op.drop_table("camp_lessons")
    op.execute("DROP FUNCTION protect_camp_lesson_revision()")
