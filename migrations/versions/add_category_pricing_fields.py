"""add price_min, price_max, is_quote_based to service_categories

Indicative price range shown to clients (display only — never constrains
the amount_xof locked by admin). Idempotent: safe to run against a DB where
the columns already exist.

Revision ID: add_category_pricing_fields
Revises: merge_all_heads_may2026
Create Date: 2026-07-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_category_pricing_fields'
down_revision = 'merge_all_heads_may2026'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('service_categories')}

    if 'price_min' not in existing:
        op.add_column('service_categories', sa.Column('price_min', sa.Integer(), nullable=True))
    if 'price_max' not in existing:
        op.add_column('service_categories', sa.Column('price_max', sa.Integer(), nullable=True))
    if 'is_quote_based' not in existing:
        op.add_column(
            'service_categories',
            sa.Column('is_quote_based', sa.Boolean(), nullable=False, server_default='false'),
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('service_categories')}

    if 'is_quote_based' in existing:
        op.drop_column('service_categories', 'is_quote_based')
    if 'price_max' in existing:
        op.drop_column('service_categories', 'price_max')
    if 'price_min' in existing:
        op.drop_column('service_categories', 'price_min')
