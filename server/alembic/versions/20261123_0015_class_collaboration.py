"""Add class invitations, join requests, and shared video metadata."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "20261123_0015"
down_revision = "20261006_0014"
branch_labels = None
depends_on = None


def timestamps():
    return (
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def upgrade():
    op.create_table(
        "class_invitations",
        sa.Column("class_id", sa.BigInteger(), sa.ForeignKey("camp_classes.id"), primary_key=True),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("issued_by_user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        *timestamps(),
    )
    op.create_table(
        "class_join_requests",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("class_id", sa.BigInteger(), sa.ForeignKey("camp_classes.id"), nullable=False),
        sa.Column("student_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("reviewed_by_user_id", sa.BigInteger(), sa.ForeignKey("users.id")),
        *timestamps(),
        sa.UniqueConstraint("class_id", "student_id", name="uq_class_join_requests_class_student"),
        sa.CheckConstraint("status in ('pending', 'approved', 'declined')", name="ck_class_join_request_status"),
    )
    op.create_index("ix_class_join_requests_class_status", "class_join_requests", ["class_id", "status"])
    op.create_table(
        "class_videos",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("class_id", sa.BigInteger(), sa.ForeignKey("camp_classes.id"), nullable=False),
        sa.Column("uploader_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(140), nullable=False),
        sa.Column("object_key", sa.String(180), nullable=False, unique=True),
        sa.Column("content_type", sa.String(40), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True)),
        *timestamps(),
    )
    op.create_index("ix_class_videos_class_created", "class_videos", ["class_id", "created_at"])


def downgrade():
    op.drop_table("class_videos")
    op.drop_table("class_join_requests")
    op.drop_table("class_invitations")
