"""Publish factual lesson reports without unapproved nutrition calculations."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision = '20260930_0009'
down_revision = '20260929_0008'
branch_labels = None
depends_on = None

def common():
    return [sa.Column('id',sa.BigInteger(),primary_key=True),
        sa.Column('public_id',postgresql.UUID(as_uuid=True),nullable=False,unique=True),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now()),
        sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False,server_default=sa.func.now())]

def upgrade():
    op.create_table('lesson_publications',*common(),
        sa.Column('lesson_id',sa.BigInteger(),sa.ForeignKey('camp_lessons.id'),nullable=False),
        sa.Column('lesson_version',sa.Integer(),nullable=False),
        sa.Column('published_by_user_id',sa.BigInteger(),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('snapshot',postgresql.JSONB(),nullable=False),
        sa.UniqueConstraint('lesson_id','lesson_version',name='uq_lesson_publication_version'))
    op.create_table('class_reports',*common(),
        sa.Column('publication_id',sa.BigInteger(),sa.ForeignKey('lesson_publications.id'),nullable=False),
        sa.Column('student_id',sa.BigInteger(),sa.ForeignKey('users.id'),nullable=False),
        sa.Column('snapshot',postgresql.JSONB(),nullable=False),
        sa.UniqueConstraint('publication_id','student_id',name='uq_class_report_recipient'))
    op.create_index('ix_class_reports_student','class_reports',['student_id','id'])

def downgrade():
    op.drop_table('class_reports')
    op.drop_table('lesson_publications')
