"""Fix FK for Rating.service_id

Revision ID: 7e2a3cc045e5
Revises: 
Create Date: 2025-09-29 13:51:22.844027
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from alembic.runtime.migration import MigrationContext

# revision identifiers, used by Alembic.
revision = '7e2a3cc045e5'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create new service-related tables
    op.create_table(
        'service_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    op.create_table(
        'service_subcategories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['service_categories.id']),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'services',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('professional_required', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('is_priority', sa.Boolean(), nullable=True),
        sa.Column('subcategory_id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['provider_id'], ['service_providers.id']),
        sa.ForeignKeyConstraint(['subcategory_id'], ['service_subcategories.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Drop old tables if they exist
    op.execute("DROP TABLE IF EXISTS service_category CASCADE")
    op.execute("DROP TABLE IF EXISTS service CASCADE")

    # Recreate FK for appointment.service_id
    conn = op.get_bind()
    inspector = inspect(conn)

    appointment_fks = inspector.get_foreign_keys('appointment')
    for fk in appointment_fks:
        if fk['constrained_columns'] == ['service_id']:
            with op.batch_alter_table('appointment', schema=None) as batch_op:
                batch_op.drop_constraint(fk['name'], type_='foreignkey')
            break

    with op.batch_alter_table('appointment', schema=None) as batch_op:
        batch_op.create_foreign_key(None, 'services', ['service_id'], ['id'])

    # Recreate FK for rating.service_id
    rating_fks = inspector.get_foreign_keys('rating')
    for fk in rating_fks:
        if fk['constrained_columns'] == ['service_id']:
            with op.batch_alter_table('rating', schema=None) as batch_op:
                batch_op.drop_constraint(fk['name'], type_='foreignkey')
            break

    with op.batch_alter_table('rating', schema=None) as batch_op:
        batch_op.create_foreign_key(None, 'services', ['service_id'], ['id'])


def downgrade():
    with op.batch_alter_table('rating', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.create_foreign_key(None, 'service', ['service_id'], ['id'])

    with op.batch_alter_table('appointment', schema=None) as batch_op:
        batch_op.drop_constraint(None, type_='foreignkey')
        batch_op.create_foreign_key(None, 'service', ['service_id'], ['id'])

    op.create_table(
        'service',
        sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column('provider_id', sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column('category_id', sa.INTEGER(), autoincrement=False, nullable=True),
        sa.Column('description', sa.TEXT(), autoincrement=False, nullable=True),
        sa.Column('price_range', sa.VARCHAR(length=50), autoincrement=False, nullable=True),
        sa.Column('available', sa.BOOLEAN(), autoincrement=False, nullable=True),
        sa.Column('total_appointments', sa.INTEGER(), autoincrement=False, nullable=True),
        sa.Column('demand_score', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True),
        sa.ForeignKeyConstraint(['category_id'], ['service_category.id'], name='service_category_id_fkey'),
        sa.ForeignKeyConstraint(['provider_id'], ['users.id'], name='service_provider_id_fkey'),
        sa.PrimaryKeyConstraint('id', name='service_pkey')
    )

    op.create_table(
        'service_category',
        sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column('name', sa.VARCHAR(length=64), autoincrement=False, nullable=True),
        sa.PrimaryKeyConstraint('id', name='service_category_pkey'),
        sa.UniqueConstraint('name', name='service_category_name_key')
    )

    op.drop_table('services')
    op.drop_table('service_subcategories')
    op.drop_table('service_categories')
