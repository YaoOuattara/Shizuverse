"""Add waitlist table

Revision ID: add_waitlist_table
Revises: add_booking_events_table
Create Date: 2026-05-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_waitlist_table'
down_revision = 'add_booking_events_table'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS waitlist (
            id         SERIAL PRIMARY KEY,
            commune    VARCHAR(100) NOT NULL,
            phone      VARCHAR(30) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_waitlist_commune ON waitlist (commune)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS waitlist")
