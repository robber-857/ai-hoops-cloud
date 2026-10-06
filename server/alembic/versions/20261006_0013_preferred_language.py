"""Persist account language with English as the existing/new account default."""

from alembic import op
import sqlalchemy as sa

revision = "20261006_0013"
down_revision = "20261003_0012"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column(
        "preferred_language", sa.String(5), server_default=sa.text("'en'"), nullable=False,
    ))
    op.create_check_constraint("ck_users_preferred_language", "users", "preferred_language IN ('en', 'zh-CN')")


def downgrade():
    op.drop_constraint("ck_users_preferred_language", "users", type_="check")
    op.drop_column("users", "preferred_language")
