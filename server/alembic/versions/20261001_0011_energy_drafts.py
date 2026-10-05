"""Append-only staff review drafts, never published player nutrition."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision='20261001_0011'
down_revision='20260930_0010'
branch_labels=None
depends_on=None


def upgrade():
    op.create_table('energy_review_drafts',
        sa.Column('id',sa.BigInteger(),primary_key=True),
        sa.Column('public_id',postgresql.UUID(as_uuid=True),nullable=False,unique=True),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
        sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
        sa.Column('lesson_id',sa.BigInteger(),sa.ForeignKey('camp_lessons.id'),nullable=False),
        sa.Column('revision',sa.Integer(),nullable=False),
        sa.Column('created_by',sa.BigInteger(),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('request_id',postgresql.UUID(as_uuid=True),nullable=False),
        sa.Column('request_hash',sa.String(64),nullable=False),
        sa.Column('snapshot',postgresql.JSONB(),nullable=False),
        sa.UniqueConstraint('lesson_id','revision',name='uq_energy_draft_revision'),
        sa.UniqueConstraint('lesson_id','request_id',name='uq_energy_draft_request'))
    op.execute("CREATE FUNCTION protect_energy_draft() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Energy review history is append-only'; END; $$ LANGUAGE plpgsql")
    op.execute('CREATE TRIGGER energy_draft_immutable BEFORE UPDATE OR DELETE ON energy_review_drafts FOR EACH ROW EXECUTE FUNCTION protect_energy_draft()')


def downgrade():
    op.execute("DO $$ BEGIN IF EXISTS (SELECT 1 FROM energy_review_drafts) THEN RAISE EXCEPTION 'Cannot discard energy review history; use a forward migration'; END IF; END $$")
    op.drop_table('energy_review_drafts')
    op.execute('DROP FUNCTION protect_energy_draft()')
