"""add retention_campaigns table

Revision ID: add_retention_campaigns_table
Revises: merge_migration_heads_may2026_v2
Create Date: 2026-05-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_retention_campaigns_table'
down_revision = 'merge_migration_heads_may2026_v2'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'retention_campaigns' not in inspector.get_table_names():
        op.create_table(
            'retention_campaigns',
            sa.Column('id',            sa.Integer(),     nullable=False),
            sa.Column('client_phone',  sa.String(30),    nullable=False),
            sa.Column('message_sent',  sa.Text(),        nullable=True),
            sa.Column('sent_at',       sa.DateTime(),    nullable=True),
            sa.Column('campaign_date', sa.Date(),        nullable=True),
            sa.Column('opted_out',     sa.Boolean(),     nullable=False, server_default='false'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_retention_campaigns_client_phone', 'retention_campaigns', ['client_phone'])


def downgrade():
    op.drop_index('ix_retention_campaigns_client_phone', table_name='retention_campaigns')
    op.drop_table('retention_campaigns')
