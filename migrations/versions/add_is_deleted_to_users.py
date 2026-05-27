"""Add is_deleted and deleted_at to users table

Revision ID: add_is_deleted_to_users
Revises: merge_migration_heads_may2026_v2
Create Date: 2026-05-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_is_deleted_to_users'
down_revision = 'merge_migration_heads_may2026_v2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('is_deleted', sa.Boolean(), nullable=True))
    op.add_column('users', sa.Column('deleted_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('users', 'deleted_at')
    op.drop_column('users', 'is_deleted')
