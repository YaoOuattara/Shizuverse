"""merge_all_heads_may2026

Revision ID: merge_all_heads_may2026
Revises: add_anomaly_log_table, add_is_deleted_to_users
Create Date: 2026-05-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'merge_all_heads_may2026'
down_revision = ('add_anomaly_log_table', 'add_is_deleted_to_users')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
