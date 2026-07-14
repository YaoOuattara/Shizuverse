"""add quote_token + quote_token_expires_at to client_bookings

Magic-link quote acceptance for anonymous clients. Idempotent.

Revision ID: add_quote_token_to_bookings
Revises: add_quote_note_to_bookings
Create Date: 2026-07-14 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_quote_token_to_bookings'
down_revision = 'add_quote_note_to_bookings'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('client_bookings')}
    if 'quote_token' not in existing:
        op.add_column('client_bookings', sa.Column('quote_token', sa.String(length=64), nullable=True))
        op.create_index('ix_client_bookings_quote_token', 'client_bookings', ['quote_token'], unique=True)
    if 'quote_token_expires_at' not in existing:
        op.add_column('client_bookings', sa.Column('quote_token_expires_at', sa.DateTime(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('client_bookings')}
    indexes = {ix['name'] for ix in inspector.get_indexes('client_bookings')}
    if 'quote_token_expires_at' in existing:
        op.drop_column('client_bookings', 'quote_token_expires_at')
    if 'ix_client_bookings_quote_token' in indexes:
        op.drop_index('ix_client_bookings_quote_token', table_name='client_bookings')
    if 'quote_token' in existing:
        op.drop_column('client_bookings', 'quote_token')
