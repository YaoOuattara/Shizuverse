"""Add featured to services

Revision ID: d956664f9c87
Revises: 8da1d46e0219
Create Date: 2025-10-20 09:39:47.710395

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d956664f9c87"
down_revision = "8da1d46e0219"  # current head/mergepoint
branch_labels = None
depends_on = None

def upgrade():
    op.add_column(
        "services",
        sa.Column("featured", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index(op.f("ix_services_featured"), "services", ["featured"])
    op.alter_column("services", "featured", server_default=None)

def downgrade():
    op.drop_index(op.f("ix_services_featured"), table_name="services")
    op.drop_column("services", "featured")
