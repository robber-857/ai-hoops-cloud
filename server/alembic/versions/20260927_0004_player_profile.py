"""Append-only player measurements and optional phone for verified email signup."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260927_0004"
down_revision = "20260503_0003"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("users", "phone_number", existing_type=sa.String(32), nullable=True)
    op.create_check_constraint("ck_users_contact_required", "users", "(phone_number IS NOT NULL AND length(trim(phone_number)) > 0) OR (email IS NOT NULL AND length(trim(email)) > 0)")
    op.create_table(
        "player_profile_revisions",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("public_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("measured_on", sa.Date(), nullable=False),
        sa.Column("height_cm", sa.Numeric(5, 2), nullable=False),
        sa.Column("weight_kg", sa.Numeric(5, 2), nullable=False),
        sa.Column("sex", sa.String(10), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("height_cm > 0 AND height_cm <= 300", name="ck_profile_height"),
        sa.CheckConstraint("weight_kg > 0 AND weight_kg <= 500", name="ck_profile_weight"),
        sa.CheckConstraint("date_of_birth < measured_on", name="ck_profile_dates"),
        sa.CheckConstraint("sex IS NULL OR sex IN ('female', 'male')", name="ck_profile_sex"),
    )
    op.create_index("ix_player_profile_user_measured", "player_profile_revisions", ["user_id", "measured_on", "created_at"])
    op.execute("""CREATE FUNCTION reject_player_profile_mutation() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'Player measurements are append-only; save a new revision'; END;
      $$ LANGUAGE plpgsql""")
    op.execute("""CREATE TRIGGER player_profile_immutable BEFORE UPDATE OR DELETE ON player_profile_revisions
      FOR EACH ROW EXECUTE FUNCTION reject_player_profile_mutation()""")


def downgrade():
    # Once in use, prefer a forward fix. Never invent phone numbers or discard history.
    op.execute("""DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM player_profile_revisions) OR EXISTS (SELECT 1 FROM users WHERE phone_number IS NULL) THEN
        RAISE EXCEPTION 'Cannot downgrade: measurement history or email-only accounts exist; use a forward migration';
      END IF;
    END $$""")
    op.drop_table("player_profile_revisions")
    op.execute("DROP FUNCTION reject_player_profile_mutation()")
    op.drop_constraint("ck_users_contact_required", "users", type_="check")
    op.alter_column("users", "phone_number", existing_type=sa.String(32), nullable=False)
