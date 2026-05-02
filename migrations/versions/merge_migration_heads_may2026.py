"""merge migration heads May 2026

Revision ID: merge_migration_heads_may2026
Revises: add_is_published_to_reviews, add_review_soft_skills
Create Date: 2026-05-02 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'merge_migration_heads_may2026'
down_revision = ('add_is_published_to_reviews', 'add_review_soft_skills')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
