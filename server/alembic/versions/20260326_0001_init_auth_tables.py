"""init core tables

Revision ID: 20260326_0001
Revises:
Create Date: 2026-03-26 19:25:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260326_0001"
down_revision = None
branch_labels = None
depends_on = None


user_status_enum = postgresql.ENUM(
    "active",
    "disabled",
    "locked",
    name="user_status",
)

user_role_enum = postgresql.ENUM(
    "user",
    "admin",
    "coach",
    name="user_role",
)

verification_target_type_enum = postgresql.ENUM(
    "phone",
    "email",
    name="verification_target_type",
)

verification_scene_enum = postgresql.ENUM(
    "register",
    "login",
    "reset_password",
    name="verification_scene",
)

verification_code_status_enum = postgresql.ENUM(
    "pending",
    "used",
    "expired",
    "invalidated",
    name="verification_code_status",
)

session_status_enum = postgresql.ENUM(
    "active",
    "revoked",
    "expired",
    name="session_status",
)

storage_provider_enum = postgresql.ENUM(
    "s3",
    name="storage_provider",
)

video_upload_status_enum = postgresql.ENUM(
    "pending",
    "uploaded",
    "failed",
    "deleted",
    name="video_upload_status",
)

video_visibility_enum = postgresql.ENUM(
    "private",
    "public",
    name="video_visibility",
)

analysis_type_enum = postgresql.ENUM(
    "shooting",
    "dribbling",
    "training",
    name="analysis_type",
)

upload_task_status_enum = postgresql.ENUM(
    "created",
    "uploading",
    "uploaded",
    "failed",
    "expired",
    name="upload_task_status",
)

report_status_enum = postgresql.ENUM(
    "processing",
    "completed",
    "failed",
    name="report_status",
)


def upgrade() -> None:
    bind = op.get_bind()

    user_status_enum.create(bind, checkfirst=True)
    user_role_enum.create(bind, checkfirst=True)
    verification_target_type_enum.create(bind, checkfirst=True)
    verification_scene_enum.create(bind, checkfirst=True)
    verification_code_status_enum.create(bind, checkfirst=True)
    session_status_enum.create(bind, checkfirst=True)
    storage_provider_enum.create(bind, checkfirst=True)
    video_upload_status_enum.create(bind, checkfirst=True)
    video_visibility_enum.create(bind, checkfirst=True)
    analysis_type_enum.create(bind, checkfirst=True)
    upload_task_status_enum.create(bind, checkfirst=True)
    report_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("phone_number", sa.String(length=32), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("nickname", sa.String(length=100), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("is_phone_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("status", user_status_enum, nullable=False, server_default="active"),
        sa.Column("role", user_role_enum, nullable=False, server_default="user"),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("char_length(username) >= 3", name="ck_users_username_length"),
        sa.UniqueConstraint("public_id", name="uq_users_public_id"),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.UniqueConstraint("phone_number", name="uq_users_phone_number"),
    )
    op.create_index("ix_users_created_at", "users", ["created_at"], unique=False)
    op.create_index(
        "ix_users_email_not_null",
        "users",
        ["email"],
        unique=True,
        postgresql_where=sa.text("email IS NOT NULL"),
    )

    op.create_table(
        "verification_codes",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target", sa.String(length=255), nullable=False),
        sa.Column("target_type", verification_target_type_enum, nullable=False),
        sa.Column("scene", verification_scene_enum, nullable=False),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("status", verification_code_status_enum, nullable=False, server_default="pending"),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("expire_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("request_ip", sa.String(length=64), nullable=True),
        sa.Column("request_device", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("expire_at > created_at", name="ck_verification_codes_expire_after_create"),
        sa.UniqueConstraint("public_id", name="uq_verification_codes_public_id"),
    )
    op.create_index(
        "ix_verification_codes_target_scene_status",
        "verification_codes",
        ["target", "scene", "status"],
        unique=False,
    )
    op.create_index("ix_verification_codes_expire_at", "verification_codes", ["expire_at"], unique=False)
    op.create_index("ix_verification_codes_user_id", "verification_codes", ["user_id"], unique=False)

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=255), nullable=False),
        sa.Column("device_type", sa.String(length=50), nullable=True),
        sa.Column("device_name", sa.String(length=255), nullable=True),
        sa.Column("os", sa.String(length=100), nullable=True),
        sa.Column("browser", sa.String(length=100), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=1000), nullable=True),
        sa.Column("status", session_status_enum, nullable=False, server_default="active"),
        sa.Column("expire_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("public_id", name="uq_user_sessions_public_id"),
    )
    op.create_index("ix_user_sessions_user_id_status", "user_sessions", ["user_id", "status"], unique=False)
    op.create_index("ix_user_sessions_expire_at", "user_sessions", ["expire_at"], unique=False)

    op.create_table(
        "videos",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("storage_provider", storage_provider_enum, nullable=False, server_default="s3"),
        sa.Column("bucket_name", sa.String(length=100), nullable=False),
        sa.Column("object_key", sa.String(length=500), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("original_file_name", sa.String(length=255), nullable=True),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=True),
        sa.Column("cdn_url", sa.String(length=1000), nullable=True),
        sa.Column("checksum_md5", sa.String(length=64), nullable=True),
        sa.Column("etag", sa.String(length=255), nullable=True),
        sa.Column("upload_status", video_upload_status_enum, nullable=False, server_default="pending"),
        sa.Column("visibility", video_visibility_enum, nullable=False, server_default="private"),
        sa.Column("duration_seconds", sa.Numeric(10, 2), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("fps", sa.Numeric(8, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("file_size > 0", name="ck_videos_file_size_positive"),
        sa.UniqueConstraint("public_id", name="uq_videos_public_id"),
        sa.UniqueConstraint("bucket_name", "object_key", name="uq_videos_bucket_object_key"),
    )
    op.create_index("ix_videos_user_id_created_at", "videos", ["user_id", "created_at"], unique=False)
    op.create_index("ix_videos_upload_status", "videos", ["upload_status"], unique=False)

    op.create_table(
        "upload_tasks",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("video_id", sa.BigInteger(), sa.ForeignKey("videos.id"), nullable=True),
        sa.Column("analysis_type", analysis_type_enum, nullable=True),
        sa.Column("status", upload_task_status_enum, nullable=False, server_default="created"),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("presigned_url_expire_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_code", sa.String(length=50), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("file_size > 0", name="ck_upload_tasks_file_size_positive"),
        sa.UniqueConstraint("public_id", name="uq_upload_tasks_public_id"),
    )
    op.create_index("ix_upload_tasks_user_id_status", "upload_tasks", ["user_id", "status"], unique=False)
    op.create_index("ix_upload_tasks_video_id", "upload_tasks", ["video_id"], unique=False)

    op.create_table(
        "analysis_reports",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("video_id", sa.BigInteger(), sa.ForeignKey("videos.id"), nullable=False),
        sa.Column("analysis_type", analysis_type_enum, nullable=False),
        sa.Column("template_id", sa.String(length=100), nullable=False),
        sa.Column("template_version", sa.String(length=50), nullable=True),
        sa.Column("status", report_status_enum, nullable=False, server_default="completed"),
        sa.Column("overall_score", sa.Numeric(6, 2), nullable=True),
        sa.Column("grade", sa.String(length=10), nullable=True),
        sa.Column("score_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("timeline_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("summary_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("analysis_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("analysis_finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)",
            name="ck_analysis_reports_overall_score",
        ),
        sa.UniqueConstraint("public_id", name="uq_analysis_reports_public_id"),
    )
    op.create_index("ix_analysis_reports_user_id_created_at", "analysis_reports", ["user_id", "created_at"], unique=False)
    op.create_index("ix_analysis_reports_video_id", "analysis_reports", ["video_id"], unique=False)
    op.create_index(
        "ix_analysis_reports_analysis_type_created_at",
        "analysis_reports",
        ["analysis_type", "created_at"],
        unique=False,
    )
    op.create_index("ix_analysis_reports_template_id", "analysis_reports", ["template_id"], unique=False)
    op.create_index("ix_analysis_reports_overall_score", "analysis_reports", ["overall_score"], unique=False)

    op.create_table(
        "report_snapshots",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("report_id", sa.BigInteger(), sa.ForeignKey("analysis_reports.id"), nullable=False),
        sa.Column("template_version", sa.String(length=50), nullable=False),
        sa.Column("score_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("timeline_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("summary_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_report_snapshots_public_id"),
    )
    op.create_index("ix_report_snapshots_report_id", "report_snapshots", ["report_id"], unique=False)

    op.create_table(
        "operation_logs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("module", sa.String(length=50), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("target_type", sa.String(length=50), nullable=True),
        sa.Column("target_id", sa.String(length=100), nullable=True),
        sa.Column("request_id", sa.String(length=100), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_operation_logs_user_id", "operation_logs", ["user_id"], unique=False)
    op.create_index("ix_operation_logs_request_id", "operation_logs", ["request_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index("ix_operation_logs_request_id", table_name="operation_logs")
    op.drop_index("ix_operation_logs_user_id", table_name="operation_logs")
    op.drop_table("operation_logs")

    op.drop_index("ix_report_snapshots_report_id", table_name="report_snapshots")
    op.drop_table("report_snapshots")

    op.drop_index("ix_analysis_reports_overall_score", table_name="analysis_reports")
    op.drop_index("ix_analysis_reports_template_id", table_name="analysis_reports")
    op.drop_index("ix_analysis_reports_analysis_type_created_at", table_name="analysis_reports")
    op.drop_index("ix_analysis_reports_video_id", table_name="analysis_reports")
    op.drop_index("ix_analysis_reports_user_id_created_at", table_name="analysis_reports")
    op.drop_table("analysis_reports")

    op.drop_index("ix_upload_tasks_video_id", table_name="upload_tasks")
    op.drop_index("ix_upload_tasks_user_id_status", table_name="upload_tasks")
    op.drop_table("upload_tasks")

    op.drop_index("ix_videos_upload_status", table_name="videos")
    op.drop_index("ix_videos_user_id_created_at", table_name="videos")
    op.drop_table("videos")

    op.drop_index("ix_user_sessions_expire_at", table_name="user_sessions")
    op.drop_index("ix_user_sessions_user_id_status", table_name="user_sessions")
    op.drop_table("user_sessions")

    op.drop_index("ix_verification_codes_user_id", table_name="verification_codes")
    op.drop_index("ix_verification_codes_expire_at", table_name="verification_codes")
    op.drop_index("ix_verification_codes_target_scene_status", table_name="verification_codes")
    op.drop_table("verification_codes")

    op.drop_index("ix_users_email_not_null", table_name="users")
    op.drop_index("ix_users_created_at", table_name="users")
    op.drop_table("users")

    report_status_enum.drop(bind, checkfirst=True)
    upload_task_status_enum.drop(bind, checkfirst=True)
    analysis_type_enum.drop(bind, checkfirst=True)
    video_visibility_enum.drop(bind, checkfirst=True)
    video_upload_status_enum.drop(bind, checkfirst=True)
    storage_provider_enum.drop(bind, checkfirst=True)
    session_status_enum.drop(bind, checkfirst=True)
    verification_code_status_enum.drop(bind, checkfirst=True)
    verification_scene_enum.drop(bind, checkfirst=True)
    verification_target_type_enum.drop(bind, checkfirst=True)
    user_role_enum.drop(bind, checkfirst=True)
    user_status_enum.drop(bind, checkfirst=True)
