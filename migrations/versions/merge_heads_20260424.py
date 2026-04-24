"""Merge competing heads: add_peinture_renovation_cat and rename_childcare_category

Revision ID: merge_heads_20260424
Revises: add_peinture_renovation_cat, rename_childcare_category
Create Date: 2026-04-24 00:00:00.000000
"""
from alembic import op

revision = 'merge_heads_20260424'
down_revision = ('add_peinture_renovation_cat', 'rename_childcare_category')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
