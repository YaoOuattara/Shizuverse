"""add final_amount, shizu_commission, provider_payout to client_bookings

Revision ID: add_final_amount_to_bookings
Revises: merge_migration_heads_may2026
Create Date: 2026-05-02 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_final_amount_to_bookings'
down_revision = 'merge_migration_heads_may2026'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('client_bookings')}

    if 'final_amount' not in existing:
        op.add_column('client_bookings', sa.Column('final_amount', sa.Integer(), nullable=True))
    if 'shizu_commission' not in existing:
        op.add_column('client_bookings', sa.Column('shizu_commission', sa.Integer(), nullable=True))
    if 'provider_payout' not in existing:
        op.add_column('client_bookings', sa.Column('provider_payout', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('client_bookings', 'provider_payout')
    op.drop_column('client_bookings', 'shizu_commission')
    op.drop_column('client_bookings', 'final_amount')
