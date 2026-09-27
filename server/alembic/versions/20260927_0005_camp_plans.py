"""Separate camp plans from video evaluation tasks."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260927_0005"
down_revision = "20260927_0004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "camp_plans",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "public_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True
        ),
        sa.Column(
            "class_id",
            sa.BigInteger(),
            sa.ForeignKey("camp_classes.id"),
            nullable=False,
        ),
        sa.Column("student_id", sa.BigInteger(), sa.ForeignKey("users.id")),
        sa.Column(
            "created_by_user_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("planned_on", sa.Date(), nullable=False),
        sa.Column("focus", sa.String(40), nullable=False),
        sa.Column("notes", sa.String(2000)),
        sa.Column("items", postgresql.JSONB(), nullable=False),
        sa.Column("creation_payload", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column(
            "supersedes_id",
            sa.BigInteger(),
            sa.ForeignKey("camp_plans.id"),
            unique=True,
        ),
        sa.Column("published_at", sa.DateTime(timezone=True)),
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
        sa.CheckConstraint(
            "status IN ('draft','published')", name="ck_camp_plan_status"
        ),
    )
    op.create_index("ix_camp_plan_class_date", "camp_plans", ["class_id", "planned_on"])
    op.execute(
        """CREATE FUNCTION protect_published_camp_plan() RETURNS trigger AS $$ BEGIN
      IF OLD.status = 'published' THEN RAISE EXCEPTION 'Published plans are immutable; create a revision'; END IF;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql"""
    )
    op.execute(
        "CREATE TRIGGER camp_plan_immutable BEFORE UPDATE OR DELETE ON camp_plans FOR EACH ROW EXECUTE FUNCTION protect_published_camp_plan()"
    )


def downgrade():
    op.execute(
        """DO $$ BEGIN IF EXISTS (SELECT 1 FROM camp_plans) THEN
      RAISE EXCEPTION 'Cannot downgrade populated plans; use a forward migration'; END IF; END $$"""
    )
    op.drop_table("camp_plans")
    op.execute("DROP FUNCTION protect_published_camp_plan()")
