"""Recipe drafts and immutable published nutrition snapshots."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260929_0008"
down_revision = "20260929_0007"
branch_labels = None
depends_on = None


def common():
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
        "recipes",
        *common(),
        sa.Column(
            "created_by_user_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("creation_payload", postgresql.JSONB(), nullable=False)
    )
    op.create_table(
        "recipe_publications",
        *common(),
        sa.Column(
            "recipe_id", sa.BigInteger(), sa.ForeignKey("recipes.id"), nullable=False
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column(
            "published_by_user_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False),
        sa.UniqueConstraint(
            "recipe_id", "version", name="uq_recipe_publication_version"
        )
    )


def downgrade():
    op.drop_table("recipe_publications")
    op.drop_table("recipes")
