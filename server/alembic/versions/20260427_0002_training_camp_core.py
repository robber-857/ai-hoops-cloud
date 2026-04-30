"""add training camp core domain

Revision ID: 20260427_0002
Revises: 20260326_0001
Create Date: 2026-04-27 15:10:00
"""
from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260427_0002"
down_revision = "20260326_0001"
branch_labels = None
depends_on = None


analysis_type_enum = postgresql.ENUM(
    "shooting",
    "dribbling",
    "training",
    "comprehensive",
    name="analysis_type",
    create_type=False,
)

storage_provider_enum = postgresql.ENUM(
    "s3",
    "supabase",
    name="storage_provider",
    create_type=False,
)

upload_task_status_enum = postgresql.ENUM(
    "created",
    "uploading",
    "uploaded",
    "failed",
    "expired",
    name="upload_task_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()

    # PostgreSQL requires enum value additions to be committed before
    # the new values can be used in defaults or inserts inside the migration.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'student'")
        op.execute("ALTER TYPE storage_provider ADD VALUE IF NOT EXISTS 'supabase'")
        op.execute("ALTER TYPE analysis_type ADD VALUE IF NOT EXISTS 'comprehensive'")

    op.alter_column("users", "role", server_default="student")
    op.alter_column("videos", "storage_provider", server_default="supabase")

    op.create_table(
        "training_camps",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("season_name", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("created_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column("updated_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_training_camps_public_id"),
        sa.UniqueConstraint("code", name="uq_training_camps_code"),
    )
    op.create_index("ix_training_camps_status", "training_camps", ["status"], unique=False)

    op.create_table(
        "camp_classes",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("camp_id", sa.BigInteger(), sa.ForeignKey("training_camps.id"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("age_group", sa.String(length=50), nullable=True),
        sa.Column("max_students", sa.Integer(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("created_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column("updated_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_camp_classes_public_id"),
        sa.UniqueConstraint("camp_id", "code", name="uq_camp_classes_camp_id_code"),
    )
    op.create_index("ix_camp_classes_camp_id_status", "camp_classes", ["camp_id", "status"], unique=False)

    op.create_table(
        "class_members",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("class_id", sa.BigInteger(), sa.ForeignKey("camp_classes.id"), nullable=False),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("member_role", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_class_members_public_id"),
        sa.UniqueConstraint("class_id", "user_id", "member_role", name="uq_class_members_class_user_role"),
    )
    op.create_index("ix_class_members_class_role_status", "class_members", ["class_id", "member_role", "status"], unique=False)
    op.create_index("ix_class_members_user_role_status", "class_members", ["user_id", "member_role", "status"], unique=False)

    op.create_table(
        "training_templates",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("analysis_type", analysis_type_enum, nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("difficulty_level", sa.String(length=20), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("current_version", sa.String(length=50), nullable=True),
        sa.Column("created_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column("updated_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_training_templates_public_id"),
        sa.UniqueConstraint("template_code", name="uq_training_templates_template_code"),
    )
    op.create_index(
        "ix_training_templates_analysis_type_status",
        "training_templates",
        ["analysis_type", "status"],
        unique=False,
    )

    op.create_table(
        "training_template_versions",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_id", sa.BigInteger(), sa.ForeignKey("training_templates.id"), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("scoring_rules", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("metric_definitions", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("mediapipe_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("summary_template", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_training_template_versions_public_id"),
        sa.UniqueConstraint("template_id", "version", name="uq_training_template_versions_template_version"),
    )
    op.create_index(
        "ix_training_template_versions_template_status",
        "training_template_versions",
        ["template_id", "status"],
        unique=False,
    )

    op.create_table(
        "template_example_videos",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_id", sa.BigInteger(), sa.ForeignKey("training_templates.id"), nullable=False),
        sa.Column("template_version", sa.String(length=50), nullable=True),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("storage_provider", storage_provider_enum, nullable=False, server_default="supabase"),
        sa.Column("bucket_name", sa.String(length=100), nullable=False),
        sa.Column("object_key", sa.String(length=500), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("duration_seconds", sa.Numeric(10, 2), nullable=True),
        sa.Column("cover_url", sa.String(length=1000), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("created_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_template_example_videos_public_id"),
    )
    op.create_index(
        "ix_template_example_videos_template_status_sort",
        "template_example_videos",
        ["template_id", "status", "sort_order"],
        unique=False,
    )

    op.create_table(
        "training_tasks",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("camp_id", sa.BigInteger(), sa.ForeignKey("training_camps.id"), nullable=True),
        sa.Column("class_id", sa.BigInteger(), sa.ForeignKey("camp_classes.id"), nullable=False),
        sa.Column("created_by_user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("analysis_type", analysis_type_enum, nullable=True),
        sa.Column("template_code", sa.String(length=100), nullable=True),
        sa.Column("target_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("publish_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_training_tasks_public_id"),
    )
    op.create_index("ix_training_tasks_class_status_due_at", "training_tasks", ["class_id", "status", "due_at"], unique=False)
    op.create_index(
        "ix_training_tasks_created_by_created_at",
        "training_tasks",
        ["created_by_user_id", "created_at"],
        unique=False,
    )

    op.create_table(
        "training_task_assignments",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", sa.BigInteger(), sa.ForeignKey("training_tasks.id"), nullable=False),
        sa.Column("student_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("class_id", sa.BigInteger(), sa.ForeignKey("camp_classes.id"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("progress_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column("completed_sessions", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("best_score", sa.Numeric(6, 2), nullable=True),
        sa.Column("latest_report_id", sa.BigInteger(), sa.ForeignKey("analysis_reports.id"), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_submission_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_training_task_assignments_public_id"),
        sa.UniqueConstraint("task_id", "student_id", name="uq_training_task_assignments_task_student"),
    )
    op.create_index(
        "ix_training_task_assignments_student_status",
        "training_task_assignments",
        ["student_id", "status"],
        unique=False,
    )
    op.create_index(
        "ix_training_task_assignments_class_status",
        "training_task_assignments",
        ["class_id", "status"],
        unique=False,
    )

    op.create_table(
        "training_sessions",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("camp_id", sa.BigInteger(), sa.ForeignKey("training_camps.id"), nullable=True),
        sa.Column("class_id", sa.BigInteger(), sa.ForeignKey("camp_classes.id"), nullable=True),
        sa.Column("task_assignment_id", sa.BigInteger(), sa.ForeignKey("training_task_assignments.id"), nullable=True),
        sa.Column("analysis_type", analysis_type_enum, nullable=False),
        sa.Column("template_code", sa.String(length=100), nullable=True),
        sa.Column("template_version", sa.String(length=50), nullable=True),
        sa.Column("source_type", sa.String(length=20), nullable=False, server_default="free_practice"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="created"),
        sa.Column("video_id", sa.BigInteger(), sa.ForeignKey("videos.id"), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("analysis_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_training_sessions_public_id"),
    )
    op.create_index(
        "ix_training_sessions_student_id_created_at",
        "training_sessions",
        ["student_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_training_sessions_class_id_created_at",
        "training_sessions",
        ["class_id", "created_at"],
        unique=False,
    )
    op.create_index("ix_training_sessions_task_assignment_id", "training_sessions", ["task_assignment_id"], unique=False)
    op.create_index("ix_training_sessions_status_created_at", "training_sessions", ["status", "created_at"], unique=False)

    op.create_table(
        "announcements",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("publisher_user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("scope_type", sa.String(length=20), nullable=False),
        sa.Column("camp_id", sa.BigInteger(), sa.ForeignKey("training_camps.id"), nullable=True),
        sa.Column("class_id", sa.BigInteger(), sa.ForeignKey("camp_classes.id"), nullable=True),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("publish_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expire_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_announcements_public_id"),
    )
    op.create_index("ix_announcements_scope_publish_at", "announcements", ["scope_type", "publish_at"], unique=False)
    op.create_index("ix_announcements_class_publish_at", "announcements", ["class_id", "publish_at"], unique=False)
    op.create_index("ix_announcements_camp_publish_at", "announcements", ["camp_id", "publish_at"], unique=False)

    op.create_table(
        "announcement_reads",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("announcement_id", sa.BigInteger(), sa.ForeignKey("announcements.id"), nullable=False),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_announcement_reads_public_id"),
        sa.UniqueConstraint("announcement_id", "user_id", name="uq_announcement_reads_announcement_user"),
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("business_type", sa.String(length=30), nullable=True),
        sa.Column("business_id", sa.BigInteger(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_notifications_public_id"),
    )
    op.create_index(
        "ix_notifications_user_read_created_at",
        "notifications",
        ["user_id", "is_read", "created_at"],
        unique=False,
    )
    op.create_index("ix_notifications_type_created_at", "notifications", ["type", "created_at"], unique=False)

    op.create_table(
        "student_growth_snapshots",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("period_type", sa.String(length=20), nullable=False),
        sa.Column("analysis_type", analysis_type_enum, nullable=True),
        sa.Column("session_count", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("average_score", sa.Numeric(6, 2), nullable=True),
        sa.Column("best_score", sa.Numeric(6, 2), nullable=True),
        sa.Column("training_days_count", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("streak_days", sa.BigInteger(), nullable=True),
        sa.Column("improvement_delta", sa.Numeric(6, 2), nullable=True),
        sa.Column("metric_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_student_growth_snapshots_public_id"),
        sa.UniqueConstraint(
            "student_id",
            "snapshot_date",
            "period_type",
            "analysis_type",
            name="uq_student_growth_snapshots_student_date_period_analysis",
        ),
    )
    op.create_index(
        "ix_student_growth_snapshots_student_date",
        "student_growth_snapshots",
        ["student_id", "snapshot_date"],
        unique=False,
    )

    op.create_table(
        "achievements",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon_url", sa.String(length=500), nullable=True),
        sa.Column("rule_type", sa.String(length=30), nullable=False),
        sa.Column("rule_config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_achievements_public_id"),
        sa.UniqueConstraint("code", name="uq_achievements_code"),
    )

    op.create_table(
        "student_achievements",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("achievement_id", sa.BigInteger(), sa.ForeignKey("achievements.id"), nullable=False),
        sa.Column("source_report_id", sa.BigInteger(), sa.ForeignKey("analysis_reports.id"), nullable=True),
        sa.Column("source_task_assignment_id", sa.BigInteger(), sa.ForeignKey("training_task_assignments.id"), nullable=True),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_student_achievements_public_id"),
        sa.UniqueConstraint("student_id", "achievement_id", name="uq_student_achievements_student_achievement"),
    )
    op.create_index(
        "ix_student_achievements_student_unlocked_at",
        "student_achievements",
        ["student_id", "unlocked_at"],
        unique=False,
    )

    op.create_table(
        "student_goals",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("source_type", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("goal_type", sa.String(length=30), nullable=False),
        sa.Column("target_config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("progress_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("public_id", name="uq_student_goals_public_id"),
    )
    op.create_index("ix_student_goals_student_status_end_at", "student_goals", ["student_id", "status", "end_at"], unique=False)

    op.add_column("upload_tasks", sa.Column("session_id", sa.BigInteger(), nullable=True))
    op.add_column(
        "upload_tasks",
        sa.Column("storage_provider", storage_provider_enum, nullable=False, server_default="supabase"),
    )
    op.add_column(
        "upload_tasks",
        sa.Column("bucket_name", sa.String(length=100), nullable=False, server_default="user-videos"),
    )
    op.add_column(
        "upload_tasks",
        sa.Column("object_key", sa.String(length=500), nullable=False, server_default=""),
    )
    op.create_foreign_key("fk_upload_tasks_session_id", "upload_tasks", "training_sessions", ["session_id"], ["id"])

    upload_tasks_table = sa.table(
        "upload_tasks",
        sa.column("id", sa.BigInteger()),
        sa.column("public_id", postgresql.UUID(as_uuid=True)),
        sa.column("user_id", sa.BigInteger()),
        sa.column("video_id", sa.BigInteger()),
        sa.column("analysis_type", analysis_type_enum),
        sa.column("status", upload_task_status_enum),
        sa.column("file_name", sa.String()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("completed_at", sa.DateTime(timezone=True)),
        sa.column("session_id", sa.BigInteger()),
    )
    training_sessions_table = sa.table(
        "training_sessions",
        sa.column("id", sa.BigInteger()),
        sa.column("public_id", postgresql.UUID(as_uuid=True)),
        sa.column("student_id", sa.BigInteger()),
        sa.column("analysis_type", analysis_type_enum),
        sa.column("template_code", sa.String()),
        sa.column("source_type", sa.String()),
        sa.column("status", sa.String()),
        sa.column("video_id", sa.BigInteger()),
        sa.column("started_at", sa.DateTime(timezone=True)),
        sa.column("uploaded_at", sa.DateTime(timezone=True)),
        sa.column("completed_at", sa.DateTime(timezone=True)),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )

    upload_rows = bind.execute(
        sa.select(
            upload_tasks_table.c.id,
            upload_tasks_table.c.public_id,
            upload_tasks_table.c.user_id,
            upload_tasks_table.c.video_id,
            upload_tasks_table.c.analysis_type,
            upload_tasks_table.c.status,
            upload_tasks_table.c.file_name,
            upload_tasks_table.c.created_at,
            upload_tasks_table.c.completed_at,
        )
    ).mappings().all()

    upload_to_session: dict[int, int] = {}
    for row in upload_rows:
        task_status = row["status"]
        session_status = "uploading"
        uploaded_at = None
        completed_at = None
        if task_status == "uploaded":
            session_status = "uploaded"
            uploaded_at = row["completed_at"]
        elif task_status in {"failed", "expired"}:
            session_status = "failed"
            completed_at = row["completed_at"]

        insert_result = bind.execute(
            training_sessions_table.insert().values(
                public_id=uuid.uuid4(),
                student_id=row["user_id"],
                analysis_type=row["analysis_type"] or "training",
                template_code=None,
                source_type="legacy_migration",
                status=session_status,
                video_id=row["video_id"],
                started_at=row["created_at"],
                uploaded_at=uploaded_at,
                completed_at=completed_at,
                created_at=row["created_at"],
                updated_at=row["created_at"],
            )
        )
        upload_to_session[row["id"]] = int(insert_result.inserted_primary_key[0])

    for row in upload_rows:
        upload_id = row["id"]
        session_id = upload_to_session[upload_id]
        legacy_object_key = f"legacy/{row['public_id']}/{row['file_name']}"
        bind.execute(
            sa.update(upload_tasks_table)
            .where(upload_tasks_table.c.id == upload_id)
            .values(
                session_id=session_id,
                bucket_name="user-videos",
                object_key=legacy_object_key,
            )
        )

    op.alter_column("upload_tasks", "session_id", nullable=False)
    op.alter_column("upload_tasks", "object_key", server_default=None)
    op.create_index("ix_upload_tasks_session_id", "upload_tasks", ["session_id"], unique=False)

    op.add_column("analysis_reports", sa.Column("session_id", sa.BigInteger(), nullable=True))
    op.add_column("analysis_reports", sa.Column("training_template_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key("fk_analysis_reports_session_id", "analysis_reports", "training_sessions", ["session_id"], ["id"])
    op.create_foreign_key(
        "fk_analysis_reports_training_template_id",
        "analysis_reports",
        "training_templates",
        ["training_template_id"],
        ["id"],
    )

    analysis_reports_table = sa.table(
        "analysis_reports",
        sa.column("id", sa.BigInteger()),
        sa.column("public_id", postgresql.UUID(as_uuid=True)),
        sa.column("user_id", sa.BigInteger()),
        sa.column("video_id", sa.BigInteger()),
        sa.column("analysis_type", analysis_type_enum),
        sa.column("template_id", sa.String()),
        sa.column("analysis_started_at", sa.DateTime(timezone=True)),
        sa.column("analysis_finished_at", sa.DateTime(timezone=True)),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("session_id", sa.BigInteger()),
    )

    report_rows = bind.execute(
        sa.select(
            analysis_reports_table.c.id,
            analysis_reports_table.c.user_id,
            analysis_reports_table.c.video_id,
            analysis_reports_table.c.analysis_type,
            analysis_reports_table.c.template_id,
            analysis_reports_table.c.analysis_started_at,
            analysis_reports_table.c.analysis_finished_at,
            analysis_reports_table.c.created_at,
        )
    ).mappings().all()

    session_lookup_table = sa.table(
        "training_sessions",
        sa.column("id", sa.BigInteger()),
        sa.column("student_id", sa.BigInteger()),
        sa.column("video_id", sa.BigInteger()),
        sa.column("analysis_type", analysis_type_enum),
        sa.column("template_code", sa.String()),
        sa.column("status", sa.String()),
    )

    for row in report_rows:
        session_id = bind.execute(
            sa.select(session_lookup_table.c.id)
            .where(
                session_lookup_table.c.student_id == row["user_id"],
                session_lookup_table.c.video_id == row["video_id"],
            )
            .order_by(session_lookup_table.c.id.asc())
            .limit(1)
        ).scalar()

        if session_id is None:
            insert_result = bind.execute(
                training_sessions_table.insert().values(
                    public_id=uuid.uuid4(),
                    student_id=row["user_id"],
                    analysis_type=row["analysis_type"] or "training",
                    template_code=row["template_id"],
                    source_type="legacy_migration",
                    status="completed",
                    video_id=row["video_id"],
                    started_at=row["analysis_started_at"] or row["created_at"],
                    uploaded_at=row["analysis_started_at"] or row["created_at"],
                    analysis_started_at=row["analysis_started_at"],
                    completed_at=row["analysis_finished_at"] or row["created_at"],
                    created_at=row["created_at"],
                    updated_at=row["created_at"],
                )
            )
            session_id = int(insert_result.inserted_primary_key[0])

        bind.execute(
            sa.update(analysis_reports_table)
            .where(analysis_reports_table.c.id == row["id"])
            .values(session_id=session_id)
        )
        bind.execute(
            sa.update(session_lookup_table)
            .where(session_lookup_table.c.id == session_id)
            .values(template_code=row["template_id"], status="completed")
        )

    op.alter_column("analysis_reports", "session_id", nullable=False)
    op.create_index("ix_analysis_reports_session_id", "analysis_reports", ["session_id"], unique=False)
    op.create_index("ix_analysis_reports_training_template_id", "analysis_reports", ["training_template_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_analysis_reports_training_template_id", table_name="analysis_reports")
    op.drop_index("ix_analysis_reports_session_id", table_name="analysis_reports")
    op.drop_constraint("fk_analysis_reports_training_template_id", "analysis_reports", type_="foreignkey")
    op.drop_constraint("fk_analysis_reports_session_id", "analysis_reports", type_="foreignkey")
    op.drop_column("analysis_reports", "training_template_id")
    op.drop_column("analysis_reports", "session_id")

    op.drop_index("ix_upload_tasks_session_id", table_name="upload_tasks")
    op.drop_constraint("fk_upload_tasks_session_id", "upload_tasks", type_="foreignkey")
    op.drop_column("upload_tasks", "object_key")
    op.drop_column("upload_tasks", "bucket_name")
    op.drop_column("upload_tasks", "storage_provider")
    op.drop_column("upload_tasks", "session_id")

    op.drop_index("ix_student_goals_student_status_end_at", table_name="student_goals")
    op.drop_table("student_goals")

    op.drop_index("ix_student_achievements_student_unlocked_at", table_name="student_achievements")
    op.drop_table("student_achievements")

    op.drop_table("achievements")

    op.drop_index("ix_student_growth_snapshots_student_date", table_name="student_growth_snapshots")
    op.drop_table("student_growth_snapshots")

    op.drop_index("ix_notifications_type_created_at", table_name="notifications")
    op.drop_index("ix_notifications_user_read_created_at", table_name="notifications")
    op.drop_table("notifications")

    op.drop_table("announcement_reads")

    op.drop_index("ix_announcements_camp_publish_at", table_name="announcements")
    op.drop_index("ix_announcements_class_publish_at", table_name="announcements")
    op.drop_index("ix_announcements_scope_publish_at", table_name="announcements")
    op.drop_table("announcements")

    op.drop_index("ix_training_sessions_status_created_at", table_name="training_sessions")
    op.drop_index("ix_training_sessions_task_assignment_id", table_name="training_sessions")
    op.drop_index("ix_training_sessions_class_id_created_at", table_name="training_sessions")
    op.drop_index("ix_training_sessions_student_id_created_at", table_name="training_sessions")
    op.drop_table("training_sessions")

    op.drop_index("ix_training_task_assignments_class_status", table_name="training_task_assignments")
    op.drop_index("ix_training_task_assignments_student_status", table_name="training_task_assignments")
    op.drop_table("training_task_assignments")

    op.drop_index("ix_training_tasks_created_by_created_at", table_name="training_tasks")
    op.drop_index("ix_training_tasks_class_status_due_at", table_name="training_tasks")
    op.drop_table("training_tasks")

    op.drop_index("ix_template_example_videos_template_status_sort", table_name="template_example_videos")
    op.drop_table("template_example_videos")

    op.drop_index("ix_training_template_versions_template_status", table_name="training_template_versions")
    op.drop_table("training_template_versions")

    op.drop_index("ix_training_templates_analysis_type_status", table_name="training_templates")
    op.drop_table("training_templates")

    op.drop_index("ix_class_members_user_role_status", table_name="class_members")
    op.drop_index("ix_class_members_class_role_status", table_name="class_members")
    op.drop_table("class_members")

    op.drop_index("ix_camp_classes_camp_id_status", table_name="camp_classes")
    op.drop_table("camp_classes")

    op.drop_index("ix_training_camps_status", table_name="training_camps")
    op.drop_table("training_camps")

    op.alter_column("videos", "storage_provider", server_default="s3")
    op.alter_column("users", "role", server_default="user")
