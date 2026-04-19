"""Add account_type, company_name, full_name, phone to users

Revision ID: add_account_type_to_users
Revises: add_account_type_to_providers
Create Date: 2026-04-19 13:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = 'add_account_type_to_users'
down_revision = 'add_account_type_to_providers'
branch_labels = None
depends_on = None


def _add_column_if_missing(conn, table, column, definition):
    result = conn.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": column})
    if not result.fetchone():
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))


def upgrade():
    conn = op.get_bind()
    try:
        _add_column_if_missing(conn, 'users', 'account_type',
                               "VARCHAR(20) NOT NULL DEFAULT 'individual'")
    except Exception:
        pass
    try:
        _add_column_if_missing(conn, 'users', 'company_name', 'VARCHAR(120)')
    except Exception:
        pass
    try:
        _add_column_if_missing(conn, 'users', 'full_name', 'VARCHAR(120)')
    except Exception:
        pass
    try:
        _add_column_if_missing(conn, 'users', 'phone', 'VARCHAR(30)')
    except Exception:
        pass


def downgrade():
    pass
