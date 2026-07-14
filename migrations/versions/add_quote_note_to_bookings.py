"""add quote_note to client_bookings

Note sent to the client alongside the quote (AI-generated or manual).
Idempotent: safe to run when the column already exists.

Revision ID: add_quote_note_to_bookings
Revises: add_category_pricing_fields
Create Date: 2026-07-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_quote_note_to_bookings'
down_revision = 'add_category_pricing_fields'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('client_bookings')}
    if 'quote_note' not in existing:
        op.add_column('client_bookings', sa.Column('quote_note', sa.Text(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('client_bookings')}
    if 'quote_note' in existing:
        op.drop_column('client_bookings', 'quote_note')
