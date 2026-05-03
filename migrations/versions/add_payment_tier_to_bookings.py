"""add payment tier, deposit, amount_lock, dispute columns to client_bookings

Revision ID: add_payment_tier_to_bookings
Revises: add_booking_schedule_fields
Create Date: 2026-05-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_payment_tier_to_bookings'
down_revision = 'add_booking_schedule_fields'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('client_bookings')}

    if 'payment_tier' not in existing:
        op.add_column('client_bookings', sa.Column('payment_tier', sa.String(20), nullable=True))
    if 'deposit_amount' not in existing:
        op.add_column('client_bookings', sa.Column('deposit_amount', sa.Integer(), nullable=True))
    if 'cancellation_policy' not in existing:
        op.add_column('client_bookings', sa.Column('cancellation_policy', sa.String(30), nullable=True))
    if 'amount_locked' not in existing:
        op.add_column('client_bookings', sa.Column('amount_locked', sa.Boolean(), nullable=False, server_default='false'))
    if 'amount_locked_at' not in existing:
        op.add_column('client_bookings', sa.Column('amount_locked_at', sa.DateTime(), nullable=True))
    if 'dispute_flag' not in existing:
        op.add_column('client_bookings', sa.Column('dispute_flag', sa.Boolean(), nullable=False, server_default='false'))
    if 'dispute_reason' not in existing:
        op.add_column('client_bookings', sa.Column('dispute_reason', sa.Text(), nullable=True))
    if 'dispute_opened_at' not in existing:
        op.add_column('client_bookings', sa.Column('dispute_opened_at', sa.DateTime(), nullable=True))
    if 'dispute_resolution' not in existing:
        op.add_column('client_bookings', sa.Column('dispute_resolution', sa.String(20), nullable=True))
    if 'dispute_resolved_at' not in existing:
        op.add_column('client_bookings', sa.Column('dispute_resolved_at', sa.DateTime(), nullable=True))


def downgrade():
    for col in ('dispute_resolved_at', 'dispute_resolution', 'dispute_opened_at',
                'dispute_reason', 'dispute_flag', 'amount_locked_at', 'amount_locked',
                'cancellation_policy', 'deposit_amount', 'payment_tier'):
        op.drop_column('client_bookings', col)
