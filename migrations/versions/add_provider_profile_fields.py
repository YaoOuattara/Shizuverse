"""add provider profile and verification fields

Revision ID: add_provider_profile_fields
Revises: d812b70ce272
Create Date: 2026-04-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_provider_profile_fields'
down_revision = 'd812b70ce272'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS profile_photo_url  VARCHAR(500)")
    op.execute("ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS id_document_url    VARCHAR(500)")
    op.execute("ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS experience_text     TEXT")
    op.execute("ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS experience_photo_url VARCHAR(500)")
    op.execute("ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS mobile_money_number VARCHAR(30)")
    op.execute("ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS mobile_money_name   VARCHAR(120)")
    op.execute("ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS mobile_money_operator VARCHAR(50)")


def downgrade():
    with op.batch_alter_table('service_providers', schema=None) as batch_op:
        batch_op.drop_column('mobile_money_operator')
        batch_op.drop_column('mobile_money_name')
        batch_op.drop_column('mobile_money_number')
        batch_op.drop_column('experience_photo_url')
        batch_op.drop_column('experience_text')
        batch_op.drop_column('id_document_url')
        batch_op.drop_column('profile_photo_url')
