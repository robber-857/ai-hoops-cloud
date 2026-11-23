"""Store private coach feedback and add the system administrator role."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261123_0016"
down_revision = "20261123_0015"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin'")
    op.create_table(
        "report_feedback",
        sa.Column("public_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("report_id", sa.BigInteger(), sa.ForeignKey("analysis_reports.id"), nullable=False),
        sa.Column("author_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("report_id", "author_id", "request_id", name="uq_report_feedback_request"),
    )
    op.create_index("ix_report_feedback_report_created", "report_feedback", ["report_id", "created_at"])


def downgrade():
    # Fail closed if features have been used. Retain the additive enum value.
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM report_feedback)
               OR EXISTS (SELECT 1 FROM users WHERE role::text = 'super_admin') THEN
                RAISE EXCEPTION 'Report feedback or system administrator data exists';
            END IF;
        END $$;
    """)
    op.drop_table("report_feedback")
