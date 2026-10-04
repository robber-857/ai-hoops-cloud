"""Store the learner's training start date separately from body measurements."""
from alembic import op
import sqlalchemy as sa

revision = "20261003_0012"
down_revision = "20261001_0011"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("training_started_on", sa.Date(), nullable=True))


def downgrade():
    op.drop_column("users", "training_started_on")
