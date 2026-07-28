"""add whatsapp_messages table (inbound webhook + outbound delivery status)

Revision ID: add_whatsapp_messages_table
Revises: remap_service_rates_keys
Create Date: 2026-07-28 00:00:00.000000

One table for both directions of the WhatsApp thread, joined on Twilio's
MessageSid (UNIQUE — the statusCallback upserts on it). booking_id and
provider_id are nullable so a message from an unknown number is still stored
rather than dropped. Additive and idempotent (T-03): creating a new table
touches no existing row.
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_whatsapp_messages_table'
down_revision = 'remap_service_rates_keys'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'whatsapp_messages' in inspector.get_table_names():
        return

    op.create_table(
        'whatsapp_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('message_sid', sa.String(length=64), nullable=False),
        sa.Column('direction', sa.String(length=10), nullable=False),
        sa.Column('from_phone_raw', sa.String(length=40), nullable=True),
        sa.Column('to_phone_raw', sa.String(length=40), nullable=True),
        sa.Column('from_phone', sa.String(length=30), nullable=True),
        sa.Column('to_phone', sa.String(length=30), nullable=True),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('num_media', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('template_key', sa.String(length=80), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='received'),
        sa.Column('error_code', sa.String(length=20), nullable=True),
        sa.Column('booking_id', sa.Integer(), nullable=True),
        sa.Column('provider_id', sa.Integer(), nullable=True),
        sa.Column('matched_role', sa.String(length=10), nullable=False, server_default='none'),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('received_at', sa.DateTime(), nullable=False),
        sa.Column('status_updated_at', sa.DateTime(), nullable=True),
        sa.Column('raw_payload', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['booking_id'], ['client_bookings.id'], ),
        sa.ForeignKeyConstraint(['provider_id'], ['service_providers.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('message_sid', name='uq_whatsapp_messages_message_sid'),
    )
    op.create_index('ix_whatsapp_messages_message_sid', 'whatsapp_messages', ['message_sid'])
    op.create_index('ix_whatsapp_messages_from_phone', 'whatsapp_messages', ['from_phone'])
    op.create_index('ix_whatsapp_messages_to_phone', 'whatsapp_messages', ['to_phone'])
    op.create_index('ix_whatsapp_messages_booking_id', 'whatsapp_messages', ['booking_id'])
    op.create_index('ix_whatsapp_messages_is_read', 'whatsapp_messages', ['is_read'])
    op.create_index('ix_whatsapp_messages_received_at', 'whatsapp_messages', ['received_at'])


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'whatsapp_messages' not in inspector.get_table_names():
        return
    op.drop_table('whatsapp_messages')
