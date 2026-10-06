"""Allow measurements on the date of birth as well as later dates."""

from alembic import op

revision = "20261006_0014"
down_revision = "20261006_0013"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("ck_profile_dates", "player_profile_revisions", type_="check")
    op.create_check_constraint("ck_profile_dates", "player_profile_revisions", "date_of_birth <= measured_on")


def downgrade():
    # Refuse downgrade if same-day records exist; never delete historical measurements.
    op.drop_constraint("ck_profile_dates", "player_profile_revisions", type_="check")
    op.create_check_constraint("ck_profile_dates", "player_profile_revisions", "date_of_birth < measured_on")
