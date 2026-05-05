"""make users.email nullable (providers use phone only)

Revision ID: make_user_email_nullable
Revises: merge_migration_heads_may2026
Create Date: 2026-05-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'make_user_email_nullable'
down_revision = 'merge_migration_heads_may2026'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    # Check current nullability — idempotent if already nullable
    inspector = sa.inspect(bind)
    cols = {c['name']: c for c in inspector.get_columns('users')}
    if 'email' in cols and not cols['email']['nullable']:
        op.alter_column('users', 'email', existing_type=sa.String(120), nullable=True)


def downgrade():
    op.alter_column('users', 'email', existing_type=sa.String(120), nullable=False)
