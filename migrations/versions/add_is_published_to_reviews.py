"""Add is_published to reviews

Revision ID: add_is_published_to_reviews
Revises: add_waitlist_table
Create Date: 2026-05-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_is_published_to_reviews'
down_revision = 'add_waitlist_table'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE reviews
        ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE
    """)


def downgrade():
    op.execute("ALTER TABLE reviews DROP COLUMN IF EXISTS is_published")
