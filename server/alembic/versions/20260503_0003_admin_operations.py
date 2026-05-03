"""add admin announcement role targeting

Revision ID: 20260503_0003
Revises: 20260427_0002
Create Date: 2026-05-03 13:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260503_0003"
down_revision = "20260427_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("announcements", sa.Column("target_role", sa.String(length=20), nullable=True))
    op.create_index(
        "ix_announcements_target_role_publish_at",
        "announcements",
        ["target_role", "publish_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_announcements_target_role_publish_at", table_name="announcements")
    op.drop_column("announcements", "target_role")
