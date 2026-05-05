"""merge migration heads May 2026 v2

Revision ID: merge_migration_heads_may2026_v2
Revises: add_payment_tier_to_bookings, make_user_email_nullable
Create Date: 2026-05-05 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'merge_migration_heads_may2026_v2'
down_revision = ('add_payment_tier_to_bookings', 'make_user_email_nullable')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
