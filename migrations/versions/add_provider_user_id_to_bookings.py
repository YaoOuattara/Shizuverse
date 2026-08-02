"""add provider_user_id to client_bookings — stable link to the provider PERSON

Revision ID: add_provider_user_id_to_bookings
Revises: add_whatsapp_messages_table
Create Date: 2026-08-05 00:00:00.000000

Until now the only link from a booking to its provider was provider_phone, a
string. Aggregating payouts on it would repeat, on money, the bug 6a89893 fixed
for WhatsApp: resolving by phone instead of carrying the id. A provider changing
number would lose their payout history.

The target is users.id, NOT service_providers.id: T-20 gives a provider one row
per service offered (three for most), all sharing a user_id — grouping on the
service row would count the same person three times.

Additive, nullable, idempotent (T-03). Existing rows keep NULL until the
backfill script runs; the boot never guesses.
"""
from alembic import op

revision = 'add_provider_user_id_to_bookings'
down_revision = 'add_whatsapp_messages_table'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE client_bookings ADD COLUMN IF NOT EXISTS provider_user_id INTEGER")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_client_bookings_provider_user_id "
        "ON client_bookings (provider_user_id)"
    )
    # ADD CONSTRAINT has no IF NOT EXISTS in PostgreSQL — the DO block makes the
    # migration replayable, which the boot-time upgrade relies on (T-03).
    op.execute("""
        DO $$
        BEGIN
            ALTER TABLE client_bookings
                ADD CONSTRAINT fk_client_bookings_provider_user_id
                FOREIGN KEY (provider_user_id) REFERENCES users (id);
        EXCEPTION
            WHEN duplicate_object THEN NULL;
            WHEN duplicate_table THEN NULL;
        END $$;
    """)


def downgrade():
    op.execute("""
        DO $$
        BEGIN
            ALTER TABLE client_bookings
                DROP CONSTRAINT fk_client_bookings_provider_user_id;
        EXCEPTION
            WHEN undefined_object THEN NULL;
        END $$;
    """)
    op.execute("DROP INDEX IF EXISTS ix_client_bookings_provider_user_id")
    op.execute("ALTER TABLE client_bookings DROP COLUMN IF EXISTS provider_user_id")
