"""
Reset production data — deletes all test bookings, providers, and non-admin users.
Categories and services are preserved.

Usage:
    DATABASE_URL=<url> python scripts/reset_production_data.py
"""

import os
import sys


def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL environment variable is not set.")
        sys.exit(1)

    # SQLAlchemy uses postgresql:// but Render provides postgres:// on some plans
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    print()
    print("=" * 60)
    print("  PRODUCTION DATA RESET")
    print("=" * 60)
    print()
    print("This will permanently delete:")
    print("  - All rows in booking_events")
    print("  - All rows in client_bookings")
    print("  - All rows in service_providers")
    print("  - All users WHERE user_type != 'admin'")
    print()
    print("Preserved: service_categories, service_subcategories, services")
    print()
    print(f"Database: {db_url[:40]}...")
    print()

    answer = input("Type CONFIRM to proceed, anything else to abort: ").strip()
    if answer != "CONFIRM":
        print("Aborted.")
        sys.exit(0)

    print()

    try:
        import sqlalchemy as sa
    except ImportError:
        print("ERROR: sqlalchemy is not installed. Run: pip install sqlalchemy psycopg2-binary")
        sys.exit(1)

    engine = sa.create_engine(db_url)

    with engine.begin() as conn:
        # 1. booking_events
        result = conn.execute(sa.text("DELETE FROM booking_events"))
        print(f"  booking_events    : {result.rowcount} rows deleted")

        # 2. client_bookings
        result = conn.execute(sa.text("DELETE FROM client_bookings"))
        print(f"  client_bookings   : {result.rowcount} rows deleted")

        # 3. service_providers
        result = conn.execute(sa.text("DELETE FROM service_providers"))
        print(f"  service_providers : {result.rowcount} rows deleted")

        # 4. non-admin users
        result = conn.execute(sa.text("DELETE FROM users WHERE user_type != 'admin'"))
        print(f"  users (non-admin) : {result.rowcount} rows deleted")

    print()
    print("Reset complete. Categories and services preserved.")
    print()


if __name__ == "__main__":
    main()
