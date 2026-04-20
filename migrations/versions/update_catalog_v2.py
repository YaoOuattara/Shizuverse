"""Catalog v2: remove Aide aux devoirs, add Aide aux seniors, add base_price

Revision ID: update_catalog_v2
Revises: add_available_today_to_providers
Create Date: 2026-04-20 12:00:00.000000

Changes:
  1. Add base_price column to services (idempotent)
  2. Remove subcategory/service "Aide aux devoirs" from Nounou et baby-sitting
  3. Add category "Aide aux seniors" with 3 subcategories (idempotent)
  4. Set indicative base_price per category
"""
from alembic import op
from sqlalchemy import text

revision = 'update_catalog_v2'
down_revision = 'add_available_today_to_providers'
branch_labels = None
depends_on = None

# Base prices keyed by category name (applied to every service in that category)
CATEGORY_PRICES = {
    "Menage et nettoyage":              10000,
    "Plomberie":                        15000,
    "Electricite":                      20000,
    "Bricolage & Reparations":          12000,
    "Nounou et baby-sitting":            8000,
    "Beaute a domicile":                 7000,
    "Jardinage et piscine":             10000,
    "Climatisation et electromenager":  18000,
    "Aide aux seniors":                  8000,
}

# New category to insert
SENIORS_CATEGORY = {
    "name_fr": "Aide aux seniors",
    "name_en": "Senior Care",
    "subcategories": [
        {"name_fr": "Accompagnement senior",    "name_en": "Senior companionship"},
        {"name_fr": "Aide a domicile senior",   "name_en": "Home help for seniors"},
        {"name_fr": "Compagnie et visite",      "name_en": "Companionship & visits"},
    ],
}


def _col_exists(conn, table, column):
    r = conn.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": column})
    return r.fetchone() is not None


def upgrade():
    conn = op.get_bind()

    # ── 1. Add base_price column ───────────────────────────────────────────────
    if not _col_exists(conn, "services", "base_price"):
        conn.execute(text(
            "ALTER TABLE services ADD COLUMN base_price INTEGER"
        ))

    # ── 2. Remove "Aide aux devoirs" ──────────────────────────────────────────
    # Delete service row first (FK child), then the subcategory row
    conn.execute(text(
        "DELETE FROM services WHERE name = 'Aide aux devoirs'"
    ))
    conn.execute(text(
        "DELETE FROM service_subcategories "
        "WHERE name = 'Aide aux devoirs' "
        "AND NOT EXISTS ("
        "  SELECT 1 FROM services WHERE subcategory_id = service_subcategories.id"
        ")"
    ))

    # ── 3. Insert "Aide aux seniors" category (idempotent) ────────────────────
    existing_cat = conn.execute(text(
        "SELECT id FROM service_categories WHERE name = :n"
    ), {"n": SENIORS_CATEGORY["name_fr"]}).fetchone()

    if existing_cat:
        cat_id = existing_cat[0]
    else:
        conn.execute(text(
            "INSERT INTO service_categories (name, name_fr, name_en, is_active) "
            "VALUES (:name, :fr, :en, true)"
        ), {
            "name": SENIORS_CATEGORY["name_fr"],
            "fr":   SENIORS_CATEGORY["name_fr"],
            "en":   SENIORS_CATEGORY["name_en"],
        })
        cat_id = conn.execute(text(
            "SELECT id FROM service_categories WHERE name = :n ORDER BY id DESC LIMIT 1"
        ), {"n": SENIORS_CATEGORY["name_fr"]}).scalar()

    for sub in SENIORS_CATEGORY["subcategories"]:
        existing_sub = conn.execute(text(
            "SELECT id FROM service_subcategories "
            "WHERE name = :n AND category_id = :c"
        ), {"n": sub["name_fr"], "c": cat_id}).fetchone()

        if existing_sub:
            sub_id = existing_sub[0]
        else:
            conn.execute(text(
                "INSERT INTO service_subcategories (name, name_fr, name_en, category_id) "
                "VALUES (:name, :fr, :en, :cat_id)"
            ), {
                "name":   sub["name_fr"],
                "fr":     sub["name_fr"],
                "en":     sub["name_en"],
                "cat_id": cat_id,
            })
            sub_id = conn.execute(text(
                "SELECT id FROM service_subcategories "
                "WHERE name = :n AND category_id = :c ORDER BY id DESC LIMIT 1"
            ), {"n": sub["name_fr"], "c": cat_id}).scalar()

        # Insert service row if not already present
        exists_svc = conn.execute(text(
            "SELECT 1 FROM services WHERE name = :n AND subcategory_id = :s"
        ), {"n": sub["name_fr"], "s": sub_id}).fetchone()

        if not exists_svc:
            conn.execute(text(
                "INSERT INTO services "
                "(name, name_fr, name_en, description, is_active, is_priority, featured, subcategory_id) "
                "VALUES (:name, :fr, :en, '', true, false, false, :sub_id)"
            ), {
                "name":   sub["name_fr"],
                "fr":     sub["name_fr"],
                "en":     sub["name_en"],
                "sub_id": sub_id,
            })

    # ── 4. Set base_price per category (unaccented name match via ILIKE) ──────
    #
    # Category names in the DB use accented French.  We match by ILIKE with
    # accent-insensitive patterns so this works regardless of collation and
    # whether the original seeder wrote "Ménage" or "Menage".
    #
    price_patterns = [
        ("%nage%nettoyage%",   10000),   # Menage et nettoyage
        ("%plomb%",            15000),   # Plomberie
        ("%lectric%",          20000),   # Electricite
        ("%bricolage%",        12000),   # Bricolage & Reparations
        ("%nounou%",            8000),   # Nounou et baby-sitting
        ("%beaut%",             7000),   # Beaute a domicile
        ("%jardinage%",        10000),   # Jardinage et piscine
        ("%climatisation%",    18000),   # Climatisation et electromenager
        ("%seniors%",           8000),   # Aide aux seniors
    ]

    for pattern, price in price_patterns:
        conn.execute(text("""
            UPDATE services
            SET    base_price = :price
            FROM   service_subcategories sub
            JOIN   service_categories    cat ON cat.id = sub.category_id
            WHERE  services.subcategory_id = sub.id
            AND    cat.name ILIKE :pattern
            AND    (services.base_price IS NULL OR services.base_price != :price)
        """), {"price": price, "pattern": pattern})


def downgrade():
    pass
