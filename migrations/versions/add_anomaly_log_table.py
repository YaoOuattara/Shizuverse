"""add anomaly_log table

Revision ID: add_anomaly_log_table
Revises: add_retention_campaigns_table
Create Date: 2026-05-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_anomaly_log_table'
down_revision = 'add_retention_campaigns_table'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'anomaly_log' not in inspector.get_table_names():
        op.create_table(
            'anomaly_log',
            sa.Column('id',           sa.Integer(),     nullable=False),
            sa.Column('anomaly_type', sa.String(80),    nullable=False),
            sa.Column('severity',     sa.String(20),    nullable=False),
            sa.Column('description',  sa.Text(),        nullable=False),
            sa.Column('booking_id',   sa.Integer(),     nullable=True),
            sa.Column('provider_id',  sa.Integer(),     nullable=True),
            sa.Column('detected_at',  sa.DateTime(),    nullable=False),
            sa.Column('resolved_at',  sa.DateTime(),    nullable=True),
            sa.Column('resolved_by',  sa.String(100),   nullable=True),
            sa.ForeignKeyConstraint(['booking_id'],  ['client_bookings.id']),
            sa.ForeignKeyConstraint(['provider_id'], ['service_providers.id']),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_anomaly_log_severity',    'anomaly_log', ['severity'])
        op.create_index('ix_anomaly_log_detected_at', 'anomaly_log', ['detected_at'])


def downgrade():
    op.drop_index('ix_anomaly_log_detected_at', table_name='anomaly_log')
    op.drop_index('ix_anomaly_log_severity',    table_name='anomaly_log')
    op.drop_table('anomaly_log')
