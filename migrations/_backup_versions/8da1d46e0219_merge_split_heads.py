"""Merge split heads

Revision ID: 8da1d46e0219
Revises: 43c62e1ea891, b5e80e3d1d93
Create Date: 2025-10-20 09:07:10.762270

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8da1d46e0219'
down_revision = ('43c62e1ea891', 'b5e80e3d1d93')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
