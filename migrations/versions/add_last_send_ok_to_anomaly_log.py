"""add last_send_ok to anomaly_log — stamp attempts, not successes

Revision ID: add_last_send_ok_to_anomaly_log
Revises: add_provider_user_id_to_bookings
Create Date: 2026-08-06 00:00:00.000000

last_notified_at used to be stamped only on a SUCCESSFUL send. Sound for a
transient failure, wrong for a structural one (free-form WhatsApp outside the
24h window fails on every run): the row never got stamped, the 6h reminder
never engaged, and the alert re-fired hourly forever. The stamp now records the
attempt, and this column keeps the outcome visible. Additive, idempotent (T-03).
"""
from alembic import op

revision = 'add_last_send_ok_to_anomaly_log'
down_revision = 'add_provider_user_id_to_bookings'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE anomaly_log ADD COLUMN IF NOT EXISTS last_send_ok BOOLEAN")


def downgrade():
    op.execute("ALTER TABLE anomaly_log DROP COLUMN IF EXISTS last_send_ok")
