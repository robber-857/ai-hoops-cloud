"""init auth tables

Revision ID: 20260326_0001
Revises:
Create Date: 2026-03-26 19:25:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260326_0001"
down_revision = None
branch_labels = None
depends_on = None


verification_scene_enum = sa.Enum(
    "register",
    "login",
    "reset_password",
    name="verificationscene",
)

verification_target_type_enum = sa.Enum(
    "phone",
    "email",
    name="verificationtargettype",
)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("phone_number", sa.String(length=32), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("nickname", sa.String(length=100), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_phone_number", "users", ["phone_number"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "verification_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("target", sa.String(length=255), nullable=False),
        sa.Column("target_type", verification_target_type_enum, nullable=False),
        sa.Column("scene", verification_scene_enum, nullable=False),
        sa.Column("code", sa.String(length=10), nullable=False),
        sa.Column("expired_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_verification_codes_target", "verification_codes", ["target"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_verification_codes_target", table_name="verification_codes")
    op.drop_table("verification_codes")
    verification_target_type_enum.drop(op.get_bind(), checkfirst=True)
    verification_scene_enum.drop(op.get_bind(), checkfirst=True)

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_phone_number", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
