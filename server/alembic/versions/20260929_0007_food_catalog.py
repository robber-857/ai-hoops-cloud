"""Versioned AFCD source releases and food composition records."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260929_0007"
down_revision = "20260927_0006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "food_releases",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False, unique=True),
        sa.Column("fingerprint", sa.String(64), nullable=False, unique=True),
        sa.Column("manifest", postgresql.JSONB(), nullable=False),
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
    )
    op.create_table(
        "food_entries",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "release_id",
            sa.BigInteger(),
            sa.ForeignKey("food_releases.id"),
            nullable=False,
        ),
        sa.Column("food_key", sa.String(16), nullable=False),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.UniqueConstraint("release_id", "food_key", name="uq_food_release_key"),
    )


def downgrade():
    op.drop_table("food_entries")
    op.drop_table("food_releases")
