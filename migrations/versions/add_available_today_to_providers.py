"""Add available_today to service_providers

Revision ID: add_available_today_to_providers
Revises: add_account_type_to_users
Create Date: 2026-04-20 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = 'add_available_today_to_providers'
down_revision = 'add_account_type_to_users'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    result = conn.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='service_providers' AND column_name='available_today'"
    ))
    if not result.fetchone():
        conn.execute(text(
            "ALTER TABLE service_providers "
            "ADD COLUMN available_today BOOLEAN NOT NULL DEFAULT FALSE"
        ))


def downgrade():
    pass
