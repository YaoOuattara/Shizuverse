"""add amount_collected + relax payment_status to VARCHAR (dossier flag only)

Revision ID: add_amount_collected
Revises: add_service_rates_to_providers
Create Date: 2026-07-24 00:00:00.000000

Partial-payment model:
- amount_collected (int, default 0) becomes the single source of truth for how
  much was collected; unpaid/partial/paid are DERIVED, never stored.
- payment_status stops carrying amounts. The PG enum is dropped in favour of a
  plain VARCHAR validated in app code (decision A: this set already changed once
  and will again — enum surgery is costly). Kept values: open|pending|refunded,
  default 'open'. Legacy 'unpaid'/'paid' collapse to 'open'.

0 bookings in prod → the USING cast and the legacy remap are trivially safe.
All statements are idempotent (T-03).
"""
from alembic import op

revision = 'add_amount_collected'
down_revision = 'add_service_rates_to_providers'
branch_labels = None
depends_on = None


def upgrade():
    # Single source of truth for collected money.
    op.execute("ALTER TABLE client_bookings ADD COLUMN IF NOT EXISTS amount_collected INTEGER NOT NULL DEFAULT 0")

    # Detach payment_status from the enum, become a plain VARCHAR dossier flag.
    op.execute("ALTER TABLE client_bookings ALTER COLUMN payment_status DROP DEFAULT")
    op.execute("ALTER TABLE client_bookings ALTER COLUMN payment_status TYPE VARCHAR(20) USING payment_status::text")
    op.execute("ALTER TABLE client_bookings ALTER COLUMN payment_status SET DEFAULT 'open'")

    # Amount-bearing values are no longer valid dossier flags → collapse to 'open'.
    op.execute("UPDATE client_bookings SET payment_status = 'open' WHERE payment_status IN ('unpaid', 'paid')")

    # The enum type is now unused (only this column referenced it).
    op.execute("DROP TYPE IF EXISTS payment_status_enum")


def downgrade():
    # Irreversible cleanup: the enum is not recreated (payment_status stays
    # VARCHAR). Only the additive column is dropped.
    op.execute("ALTER TABLE client_bookings DROP COLUMN IF EXISTS amount_collected")
