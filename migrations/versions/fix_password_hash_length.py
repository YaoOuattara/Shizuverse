"""Increase password_hash column length

Revision ID: fix_password_hash_length
Revises: 212bf0a263c2
Create Date: 2026-03-06

"""
from alembic import op
import sqlalchemy as sa

revision = 'fix_password_hash_length'
down_revision = '212bf0a263c2'
branch_labels = None
depends_on = None

def upgrade():
    op.alter_column('users', 'password_hash',
        existing_type=sa.String(length=128),
        type_=sa.String(length=256),
        existing_nullable=False)

def downgrade():
    op.alter_column('users', 'password_hash',
        existing_type=sa.String(length=256),
        type_=sa.String(length=128),
        existing_nullable=False)
