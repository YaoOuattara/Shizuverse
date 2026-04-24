"""Add Peinture & Renovation category with 3 subcategories

Revision ID: add_peinture_renovation_cat
Revises: update_catalog_v2
Create Date: 2026-04-24 00:00:00.000000

Changes:
  1. Add category "Peinture & Rénovation" (idempotent)
  2. Add subcategories: Peinture intérieure, Peinture extérieure, Petite rénovation
  3. Insert corresponding service rows, all is_active=True
"""
from alembic import op
from sqlalchemy import text

revision = 'add_peinture_renovation_cat'
down_revision = 'update_catalog_v2'
branch_labels = None
depends_on = None

CATEGORY = {
    "name_fr": "Peinture & Rénovation",
    "name_en": "Painting & Renovation",
    "subcategories": [
        {"name_fr": "Peinture intérieure",  "name_en": "Interior painting"},
        {"name_fr": "Peinture extérieure",  "name_en": "Exterior painting"},
        {"name_fr": "Petite rénovation",    "name_en": "Minor renovation"},
    ],
}
BASE_PRICE = 20000


def upgrade():
    conn = op.get_bind()

    # ── 1. Insert category (idempotent) ───────────────────────────────────────
    existing_cat = conn.execute(text(
        "SELECT id FROM service_categories WHERE name = :n"
    ), {"n": CATEGORY["name_fr"]}).fetchone()

    if existing_cat:
        cat_id = existing_cat[0]
    else:
        conn.execute(text(
            "INSERT INTO service_categories (name, name_fr, name_en, is_active) "
            "VALUES (:name, :fr, :en, true)"
        ), {
            "name": CATEGORY["name_fr"],
            "fr":   CATEGORY["name_fr"],
            "en":   CATEGORY["name_en"],
        })
        cat_id = conn.execute(text(
            "SELECT id FROM service_categories WHERE name = :n ORDER BY id DESC LIMIT 1"
        ), {"n": CATEGORY["name_fr"]}).scalar()

    # ── 2. Insert subcategories and services (idempotent) ─────────────────────
    for sub in CATEGORY["subcategories"]:
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

        exists_svc = conn.execute(text(
            "SELECT 1 FROM services WHERE name = :n AND subcategory_id = :s"
        ), {"n": sub["name_fr"], "s": sub_id}).fetchone()

        if not exists_svc:
            conn.execute(text(
                "INSERT INTO services "
                "(name, name_fr, name_en, description, is_active, is_priority, "
                " featured, subcategory_id, base_price) "
                "VALUES (:name, :fr, :en, '', true, false, false, :sub_id, :price)"
            ), {
                "name":   sub["name_fr"],
                "fr":     sub["name_fr"],
                "en":     sub["name_en"],
                "sub_id": sub_id,
                "price":  BASE_PRICE,
            })


def downgrade():
    pass
