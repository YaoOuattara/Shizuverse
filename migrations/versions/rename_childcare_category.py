"""Rename Nounou et baby-sitting to Garde d'enfants, replace subcategories

Revision ID: rename_childcare_category
Revises: update_catalog_v2
Create Date: 2026-04-20 18:00:00.000000

Changes:
  1. Rename category "Nounou et baby-sitting" → "Garde d'enfants" (name_fr)
     / "Childcare" (name_en / name)
  2. Replace all subcategories in that category with exactly 3:
       - Nounou à domicile
       - Baby-sitting
       - Accompagnement scolaire
  3. Remove any old subcategories (+ their service rows) not in that list
  All operations are idempotent — safe to run multiple times.
"""
from alembic import op
from sqlalchemy import text

revision = 'rename_childcare_category'
down_revision = 'update_catalog_v2'
branch_labels = None
depends_on = None

# Desired subcategories (name used as both `name` and `name_fr` field)
DESIRED_SUBS = [
    {"name_fr": "Nounou à domicile",       "name_en": "Home Nanny"},
    {"name_fr": "Baby-sitting",            "name_en": "Babysitting"},
    {"name_fr": "Accompagnement scolaire", "name_en": "After-school Care"},
]

BASE_PRICE = 8000   # same indicative price as before


def _find_childcare_category(conn):
    """Return (id,) row for the childcare category, however it is currently named."""
    # Match on current name (already renamed) OR old name (not yet renamed)
    row = conn.execute(text("""
        SELECT id FROM service_categories
        WHERE  name_fr = 'Garde d''enfants'
           OR  name_fr ILIKE '%nounou%baby%'
           OR  name_fr ILIKE '%nounou%sitting%'
           OR  name    ILIKE '%nounou%'
        ORDER BY id
        LIMIT 1
    """)).fetchone()
    return row


def upgrade():
    conn = op.get_bind()

    # ── 1. Locate the category ────────────────────────────────────────────────
    cat_row = _find_childcare_category(conn)
    if cat_row is None:
        raise RuntimeError(
            "Could not find childcare category. "
            "Check that the baseline seeder has run."
        )
    cat_id = cat_row[0]

    # ── 2. Rename category ────────────────────────────────────────────────────
    conn.execute(text("""
        UPDATE service_categories
        SET    name    = 'Childcare',
               name_fr = 'Garde d''enfants',
               name_en = 'Childcare'
        WHERE  id = :cat_id
          AND  name_fr != 'Garde d''enfants'
    """), {"cat_id": cat_id})

    # ── 3. Collect desired name_fr values ─────────────────────────────────────
    desired_names_fr = [s["name_fr"] for s in DESIRED_SUBS]

    # ── 4. Delete services for subcategories NOT in the desired list ──────────
    conn.execute(text("""
        DELETE FROM services
        WHERE  subcategory_id IN (
            SELECT id FROM service_subcategories
            WHERE  category_id = :cat_id
              AND  name_fr NOT IN :desired
              AND  name    NOT IN :desired
        )
    """), {"cat_id": cat_id, "desired": tuple(desired_names_fr)})

    # ── 5. Delete those subcategories ─────────────────────────────────────────
    conn.execute(text("""
        DELETE FROM service_subcategories
        WHERE  category_id = :cat_id
          AND  name_fr NOT IN :desired
          AND  name    NOT IN :desired
    """), {"cat_id": cat_id, "desired": tuple(desired_names_fr)})

    # ── 6. Upsert desired subcategories + service rows ────────────────────────
    for sub in DESIRED_SUBS:
        # Find or create subcategory
        existing_sub = conn.execute(text("""
            SELECT id FROM service_subcategories
            WHERE  category_id = :cat_id
              AND  (name_fr = :fr OR name = :fr)
        """), {"cat_id": cat_id, "fr": sub["name_fr"]}).fetchone()

        if existing_sub:
            sub_id = existing_sub[0]
            # Ensure name_en is up to date
            conn.execute(text("""
                UPDATE service_subcategories
                SET    name_fr = :fr, name_en = :en
                WHERE  id = :sub_id
            """), {"fr": sub["name_fr"], "en": sub["name_en"], "sub_id": sub_id})
        else:
            conn.execute(text("""
                INSERT INTO service_subcategories (name, name_fr, name_en, category_id)
                VALUES (:name, :fr, :en, :cat_id)
            """), {
                "name":   sub["name_fr"],
                "fr":     sub["name_fr"],
                "en":     sub["name_en"],
                "cat_id": cat_id,
            })
            sub_id = conn.execute(text("""
                SELECT id FROM service_subcategories
                WHERE  category_id = :cat_id
                  AND  name_fr = :fr
                ORDER BY id DESC LIMIT 1
            """), {"cat_id": cat_id, "fr": sub["name_fr"]}).scalar()

        # Find or create service row for this subcategory
        existing_svc = conn.execute(text("""
            SELECT 1 FROM services
            WHERE  subcategory_id = :sub_id
        """), {"sub_id": sub_id}).fetchone()

        if not existing_svc:
            conn.execute(text("""
                INSERT INTO services
                    (name, name_fr, name_en, description,
                     is_active, is_priority, featured,
                     base_price, subcategory_id)
                VALUES
                    (:name, :fr, :en, '',
                     true, false, false,
                     :price, :sub_id)
            """), {
                "name":   sub["name_fr"],
                "fr":     sub["name_fr"],
                "en":     sub["name_en"],
                "price":  BASE_PRICE,
                "sub_id": sub_id,
            })
        else:
            # Ensure base_price and names are current
            conn.execute(text("""
                UPDATE services
                SET    name_fr    = :fr,
                       name_en    = :en,
                       base_price = :price,
                       is_active  = true
                WHERE  subcategory_id = :sub_id
            """), {
                "fr":     sub["name_fr"],
                "en":     sub["name_en"],
                "price":  BASE_PRICE,
                "sub_id": sub_id,
            })


def downgrade():
    pass
