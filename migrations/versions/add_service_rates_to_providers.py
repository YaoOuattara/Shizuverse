"""add service_rates (provider-entered rates) to service_providers

Revision ID: add_service_rates_to_providers
Revises: add_anomaly_dedup_fields
Create Date: 2026-07-24 00:00:00.000000

Stores the rates a provider enters at registration (frontend `service_rates`,
keyed by localized category name → {min, max}) that were previously discarded.
Additive and nullable — safe for existing rows and idempotent (T-03).
"""
from alembic import op

revision = 'add_service_rates_to_providers'
down_revision = 'add_anomaly_dedup_fields'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS service_rates JSONB")


def downgrade():
    op.execute("ALTER TABLE service_providers DROP COLUMN IF EXISTS service_rates")
