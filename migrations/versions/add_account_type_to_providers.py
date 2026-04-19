"""Add account_type and rccm_number to service_providers

Revision ID: add_account_type_to_providers
Revises: seed_mvp_26_services
Create Date: 2026-04-19 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = 'add_account_type_to_providers'
down_revision = 'seed_mvp_26_services'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    # account_type
    try:
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='service_providers' AND column_name='account_type'"
        ))
        if not result.fetchone():
            conn.execute(text(
                "ALTER TABLE service_providers "
                "ADD COLUMN account_type VARCHAR(20) NOT NULL DEFAULT 'individual'"
            ))
    except Exception:
        pass

    # rccm_number
    try:
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='service_providers' AND column_name='rccm_number'"
        ))
        if not result.fetchone():
            conn.execute(text(
                "ALTER TABLE service_providers "
                "ADD COLUMN rccm_number VARCHAR(100)"
            ))
    except Exception:
        pass


def downgrade():
    pass
