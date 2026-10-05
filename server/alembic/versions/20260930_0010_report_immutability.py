"""Protect published class records against UPDATE and DELETE."""
from alembic import op
revision='20260930_0010'
down_revision='20260930_0009'
branch_labels=None
depends_on=None

def upgrade():
    op.execute("""CREATE FUNCTION protect_class_publication() RETURNS trigger AS $$ BEGIN
        RAISE EXCEPTION 'Published class records are append-only'; END; $$ LANGUAGE plpgsql""")
    for table in ('lesson_publications','class_reports'):
        op.execute(f'CREATE TRIGGER {table}_immutable BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION protect_class_publication()')

def downgrade():
    op.execute("""DO $$ BEGIN IF EXISTS (SELECT 1 FROM lesson_publications) THEN
        RAISE EXCEPTION 'Cannot downgrade published class records; use a forward migration'; END IF; END $$""")
    for table in ('class_reports','lesson_publications'):
        op.execute(f'DROP TRIGGER {table}_immutable ON {table}')
    op.execute('DROP FUNCTION protect_class_publication()')
