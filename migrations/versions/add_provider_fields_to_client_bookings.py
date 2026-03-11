"""add provider_name, provider_phone, reviewed_by to client_bookings

Revision ID: add_provider_fields_cb
Revises: fix_password_hash_length
Create Date: 2026-03-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_provider_fields_cb'
down_revision = 'fix_password_hash_length'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('client_bookings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('provider_name',  sa.String(100), nullable=True))
        batch_op.add_column(sa.Column('provider_phone', sa.String(20),  nullable=True))
        batch_op.add_column(sa.Column('reviewed_by',    sa.String(50),  nullable=True))


def downgrade():
    with op.batch_alter_table('client_bookings', schema=None) as batch_op:
        batch_op.drop_column('reviewed_by')
        batch_op.drop_column('provider_phone')
        batch_op.drop_column('provider_name')
