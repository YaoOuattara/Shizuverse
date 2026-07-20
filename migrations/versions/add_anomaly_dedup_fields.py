"""add dedup/reminder fields to anomaly_log

last_seen_at, occurrence_count, last_notified_at — support deduplicating a
recurring anomaly into a single row (updated each run) instead of one row per
cron pass, and rate-limiting re-notifications. Idempotent.

Revision ID: add_anomaly_dedup_fields
Revises: add_locale_to_client_bookings
Create Date: 2026-07-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_anomaly_dedup_fields'
down_revision = 'add_locale_to_client_bookings'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('anomaly_log')}
    if 'last_seen_at' not in existing:
        op.add_column('anomaly_log', sa.Column('last_seen_at', sa.DateTime(), nullable=True))
    if 'occurrence_count' not in existing:
        op.add_column('anomaly_log', sa.Column('occurrence_count', sa.Integer(),
                      nullable=False, server_default='1'))
    if 'last_notified_at' not in existing:
        op.add_column('anomaly_log', sa.Column('last_notified_at', sa.DateTime(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('anomaly_log')}
    if 'last_notified_at' in existing:
        op.drop_column('anomaly_log', 'last_notified_at')
    if 'occurrence_count' in existing:
        op.drop_column('anomaly_log', 'occurrence_count')
    if 'last_seen_at' in existing:
        op.drop_column('anomaly_log', 'last_seen_at')
