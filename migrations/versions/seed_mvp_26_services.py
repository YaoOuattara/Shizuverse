"""Wipe service catalog and seed 26 MVP services

Revision ID: seed_mvp_26_services
Revises: add_provider_profile_fields
Create Date: 2026-04-19 01:00:00.000000

This is a data migration. It runs automatically on flask db upgrade.
Safe to re-run: checks if catalog is already correct before wiping.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = 'seed_mvp_26_services'
down_revision = 'add_provider_profile_fields'
branch_labels = None
depends_on = None

# ── Catalog ────────────────────────────────────────────────────────────────────

CATALOG = [
    {
        "name_fr": "Ménage et nettoyage",
        "name_en": "Cleaning & Housekeeping",
        "subcategories": [
            {"name_fr": "Nettoyage général",  "name_en": "General cleaning"},
            {"name_fr": "Grand nettoyage",    "name_en": "Deep clean"},
            {"name_fr": "Repassage et lavage","name_en": "Ironing & laundry"},
            {"name_fr": "Nettoyage de vitres","name_en": "Window cleaning"},
        ],
    },
    {
        "name_fr": "Plomberie",
        "name_en": "Plumbing",
        "subcategories": [
            {"name_fr": "Réparation de fuite",   "name_en": "Leak repair"},
            {"name_fr": "Installation sanitaire", "name_en": "Plumbing installation"},
            {"name_fr": "Débouchage",             "name_en": "Drain unblocking"},
        ],
    },
    {
        "name_fr": "Électricité",
        "name_en": "Electrical",
        "subcategories": [
            {"name_fr": "Installation électrique", "name_en": "Electrical installation"},
            {"name_fr": "Réparation panne",        "name_en": "Fault repair"},
            {"name_fr": "Mise aux normes",         "name_en": "Compliance upgrade"},
        ],
    },
    {
        "name_fr": "Bricolage & Réparations",
        "name_en": "Handyman & Repairs",
        "subcategories": [
            {"name_fr": "Montage de meubles",    "name_en": "Furniture assembly"},
            {"name_fr": "Petites réparations",   "name_en": "Small repairs"},
            {"name_fr": "Peinture et enduit",    "name_en": "Painting & plastering"},
            {"name_fr": "Fixations et étagères", "name_en": "Shelving & fixtures"},
        ],
    },
    {
        "name_fr": "Nounou et baby-sitting",
        "name_en": "Childcare & Babysitting",
        "subcategories": [
            {"name_fr": "Garde à domicile",      "name_en": "Home childcare"},
            {"name_fr": "Baby-sitting ponctuel", "name_en": "Occasional babysitting"},
            {"name_fr": "Aide aux devoirs",      "name_en": "Homework help"},
        ],
    },
    {
        "name_fr": "Beauté à domicile",
        "name_en": "Beauty at Home",
        "subcategories": [
            {"name_fr": "Coiffure",             "name_en": "Hairdressing"},
            {"name_fr": "Manucure et pédicure", "name_en": "Manicure & pedicure"},
            {"name_fr": "Maquillage",           "name_en": "Makeup"},
        ],
    },
    {
        "name_fr": "Jardinage et piscine",
        "name_en": "Garden & Pool",
        "subcategories": [
            {"name_fr": "Entretien jardin",  "name_en": "Garden maintenance"},
            {"name_fr": "Entretien piscine", "name_en": "Pool maintenance"},
            {"name_fr": "Taille et élagage", "name_en": "Pruning & trimming"},
        ],
    },
    {
        "name_fr": "Climatisation et électroménager",
        "name_en": "AC & Appliances",
        "subcategories": [
            {"name_fr": "Installation climatisation", "name_en": "AC installation"},
            {"name_fr": "Réparation électroménager",  "name_en": "Appliance repair"},
            {"name_fr": "Entretien climatisation",    "name_en": "AC maintenance"},
        ],
    },
]

EXPECTED_NAMES = {sub["name_fr"] for cat in CATALOG for sub in cat["subcategories"]}


def _col_exists(conn, table, column):
    try:
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name=:t AND column_name=:c"
        ), {"t": table, "c": column})
        return result.fetchone() is not None
    except Exception:
        return False


def upgrade():
    conn = op.get_bind()

    # ── Ensure bilingual columns exist ────────────────────────────────────────
    for col, tbl, dtype in [
        ("name_fr",  "service_categories",    "VARCHAR(300)"),
        ("name_en",  "service_categories",    "VARCHAR(300)"),
        ("is_active","service_categories",    "BOOLEAN DEFAULT true"),
        ("name_fr",  "service_subcategories", "VARCHAR(300)"),
        ("name_en",  "service_subcategories", "VARCHAR(300)"),
        ("name_fr",  "services",              "VARCHAR(300)"),
        ("name_en",  "services",              "VARCHAR(300)"),
    ]:
        if not _col_exists(conn, tbl, col):
            conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS {col} {dtype}"))

    # ── Check if already seeded correctly ────────────────────────────────────
    existing = {
        row[0]
        for row in conn.execute(text("SELECT name FROM services")).fetchall()
        if row[0]
    }
    if existing == EXPECTED_NAMES:
        # Catalog already matches — nothing to do
        return

    # ── Nullify client_bookings.service_id (preserves all booking rows) ──────
    try:
        conn.execute(text(
            "UPDATE client_bookings SET service_id = NULL WHERE service_id IS NOT NULL"
        ))
    except Exception:
        pass  # column may not exist yet

    # ── Clear FK-dependent tables ─────────────────────────────────────────────
    for tbl in ("ratings", "appointments", "service_providers"):
        try:
            conn.execute(text(f"DELETE FROM {tbl}"))
        except Exception:
            pass  # table may not exist

    # ── Wipe catalog ──────────────────────────────────────────────────────────
    conn.execute(text("DELETE FROM services"))
    conn.execute(text("DELETE FROM service_subcategories"))
    conn.execute(text("DELETE FROM service_categories"))

    # Reset sequences
    for tbl in ("service_categories", "service_subcategories", "services"):
        try:
            conn.execute(text(
                f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), 1, false)"
            ))
        except Exception:
            pass

    # ── Insert catalog ────────────────────────────────────────────────────────
    for cat_data in CATALOG:
        conn.execute(text(
            "INSERT INTO service_categories (name, name_fr, name_en, is_active) "
            "VALUES (:name, :fr, :en, true)"
        ), {"name": cat_data["name_fr"], "fr": cat_data["name_fr"], "en": cat_data["name_en"]})

        cat_id = conn.execute(text(
            "SELECT id FROM service_categories WHERE name = :n ORDER BY id DESC LIMIT 1"
        ), {"n": cat_data["name_fr"]}).scalar()

        for sub in cat_data["subcategories"]:
            conn.execute(text(
                "INSERT INTO service_subcategories (name, name_fr, name_en, category_id) "
                "VALUES (:name, :fr, :en, :cat_id)"
            ), {"name": sub["name_fr"], "fr": sub["name_fr"], "en": sub["name_en"], "cat_id": cat_id})

            sub_id = conn.execute(text(
                "SELECT id FROM service_subcategories "
                "WHERE name = :n AND category_id = :c ORDER BY id DESC LIMIT 1"
            ), {"n": sub["name_fr"], "c": cat_id}).scalar()

            conn.execute(text(
                "INSERT INTO services "
                "(name, name_fr, name_en, description, is_active, is_priority, featured, subcategory_id) "
                "VALUES (:name, :fr, :en, '', true, false, false, :sub_id)"
            ), {"name": sub["name_fr"], "fr": sub["name_fr"], "en": sub["name_en"], "sub_id": sub_id})


def downgrade():
    # Data migrations are not reversible — downgrade is a no-op
    pass
