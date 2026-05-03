"""add urgency, time_preference, time_slot to client_bookings

Revision ID: add_booking_schedule_fields
Revises: add_final_amount_to_bookings
Create Date: 2026-05-02 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_booking_schedule_fields'
down_revision = 'add_final_amount_to_bookings'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('client_bookings')}

    if 'urgency' not in existing:
        op.add_column('client_bookings', sa.Column('urgency', sa.String(20), nullable=True))
    if 'time_preference' not in existing:
        op.add_column('client_bookings', sa.Column('time_preference', sa.String(20), nullable=True))
    if 'time_slot' not in existing:
        op.add_column('client_bookings', sa.Column('time_slot', sa.String(20), nullable=True))


def downgrade():
    op.drop_column('client_bookings', 'time_slot')
    op.drop_column('client_bookings', 'time_preference')
    op.drop_column('client_bookings', 'urgency')
