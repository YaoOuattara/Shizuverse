"""Add punctuality and respect columns to reviews

Revision ID: add_review_soft_skills
Revises: add_booking_events_table
Create Date: 2026-05-01 00:00:00.000000

"""
from alembic import op

revision = 'add_review_soft_skills'
down_revision = 'add_booking_events_table'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS punctuality BOOLEAN")
    op.execute("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS respect BOOLEAN")


def downgrade():
    pass
