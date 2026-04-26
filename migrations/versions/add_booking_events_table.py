"""Add booking_events table

Revision ID: add_booking_events_table
Revises: merge_heads_20260424
Create Date: 2026-04-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_booking_events_table'
down_revision = 'merge_heads_20260424'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS booking_events (
            id          SERIAL PRIMARY KEY,
            booking_id  INTEGER NOT NULL REFERENCES client_bookings(id),
            event_type  VARCHAR(50) NOT NULL,
            from_status VARCHAR(50),
            to_status   VARCHAR(50) NOT NULL,
            actor_id    INTEGER REFERENCES users(id),
            actor_phone VARCHAR(30),
            note        TEXT,
            created_at  TIMESTAMP DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_booking_events_booking_id ON booking_events (booking_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS booking_events")
