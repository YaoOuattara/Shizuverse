"""add locale to client_bookings

Capture the client's UI language at booking time so WhatsApp messages and the
AI quote note can be sent in the client's language. Idempotent. Existing rows
default to 'fr' — current behaviour is preserved.

Revision ID: add_locale_to_client_bookings
Revises: add_quote_token_to_bookings
Create Date: 2026-07-18 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_locale_to_client_bookings'
down_revision = 'add_quote_token_to_bookings'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('client_bookings')}
    if 'locale' not in existing:
        op.add_column(
            'client_bookings',
            sa.Column('locale', sa.String(length=5), nullable=False, server_default='fr'),
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {col['name'] for col in inspector.get_columns('client_bookings')}
    if 'locale' in existing:
        op.drop_column('client_bookings', 'locale')
