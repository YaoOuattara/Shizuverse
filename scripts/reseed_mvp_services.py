"""
scripts/reseed_mvp_services.py
──────────────────────────────
Wipes the service catalog and reseeds with exactly 26 MVP services.

Tables WIPED (rows deleted, schema untouched):
  - services
  - service_subcategories
  - service_categories
  - service_providers   (NOT NULL FK to services — rows deleted; re-create after reseed)
  - appointments        (NOT NULL FK to services — old booking model)
  - ratings             (NOT NULL FK to services)

Tables PRESERVED:
  - client_bookings     (nullable FK — service_id set to NULL, all booking rows kept)
  - users + all other tables (untouched)

Usage:
  python scripts/reseed_mvp_services.py
"""

from sqlalchemy import text
from shizuverse.app import create_app
from shizuverse.models import db

# ── Catalog data ───────────────────────────────────────────────────────────────
# Each subcategory becomes one Service row (1:1 pattern).
# name_fr is the authoritative display name.

CATALOG = [
    {
        "name_fr": "Ménage et nettoyage",
        "name_en": "Cleaning & Housekeeping",
        "subcategories": [
            {"name_fr": "Nettoyage général",   "name_en": "General cleaning"},
            {"name_fr": "Grand nettoyage",      "name_en": "Deep clean"},
            {"name_fr": "Repassage et lavage",  "name_en": "Ironing & laundry"},
            {"name_fr": "Nettoyage de vitres",  "name_en": "Window cleaning"},
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
            {"name_fr": "Garde à domicile",       "name_en": "Home childcare"},
            {"name_fr": "Baby-sitting ponctuel",  "name_en": "Occasional babysitting"},
            {"name_fr": "Aide aux devoirs",       "name_en": "Homework help"},
        ],
    },
    {
        "name_fr": "Beauté à domicile",
        "name_en": "Beauty at Home",
        "subcategories": [
            {"name_fr": "Coiffure",              "name_en": "Hairdressing"},
            {"name_fr": "Manucure et pédicure",  "name_en": "Manicure & pedicure"},
            {"name_fr": "Maquillage",            "name_en": "Makeup"},
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
            {"name_fr": "Installation climatisation",  "name_en": "AC installation"},
            {"name_fr": "Réparation électroménager",   "name_en": "Appliance repair"},
            {"name_fr": "Entretien climatisation",     "name_en": "AC maintenance"},
        ],
    },
]


def reseed(app):
    with app.app_context():
        # ── 1. Verify tables exist ─────────────────────────────────────────────
        from sqlalchemy import inspect as sa_inspect
        inspector = sa_inspect(db.engine)
        tables = set(inspector.get_table_names())
        required = {"service_categories", "service_subcategories", "services"}
        missing = required - tables
        if missing:
            raise SystemExit(f"❌  Missing tables: {missing}. Run `flask db upgrade` first.")

        cat_cols  = {c["name"] for c in inspector.get_columns("service_categories")}
        sub_cols  = {c["name"] for c in inspector.get_columns("service_subcategories")}
        svc_cols  = {c["name"] for c in inspector.get_columns("services")}

        print("⚙️   Starting reseed …")

        # ── 2. Add bilingual columns if absent ────────────────────────────────
        for col, tbl, existing in [
            ("name_fr", "service_categories",    cat_cols),
            ("name_en", "service_categories",    cat_cols),
            ("is_active","service_categories",   cat_cols),
            ("name_fr", "service_subcategories", sub_cols),
            ("name_en", "service_subcategories", sub_cols),
            ("name_fr", "services",              svc_cols),
            ("name_en", "services",              svc_cols),
        ]:
            if col not in existing:
                dtype = "BOOLEAN DEFAULT true" if col == "is_active" else "VARCHAR(300)"
                db.session.execute(
                    text(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS {col} {dtype}")
                )
                print(f"   + added column {tbl}.{col}")
        db.session.commit()

        # ── 3. Nullify client_bookings.service_id (preserves all booking rows) ─
        if "client_bookings" in tables:
            result = db.session.execute(
                text("UPDATE client_bookings SET service_id = NULL WHERE service_id IS NOT NULL")
            )
            print(f"   client_bookings: {result.rowcount} rows unlinked (rows kept)")

        # ── 4. Clear FK-dependent tables ──────────────────────────────────────
        for tbl in ("ratings", "appointments", "service_providers"):
            if tbl in tables:
                result = db.session.execute(text(f"DELETE FROM {tbl}"))
                print(f"   {tbl}: {result.rowcount} rows deleted")

        # ── 5. Wipe catalog ───────────────────────────────────────────────────
        for tbl in ("services", "service_subcategories", "service_categories"):
            result = db.session.execute(text(f"DELETE FROM {tbl}"))
            print(f"   {tbl}: {result.rowcount} rows deleted")

        # Reset sequences so IDs start from 1
        for tbl in ("service_categories", "service_subcategories", "services"):
            try:
                db.session.execute(
                    text(f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), 1, false)")
                )
            except Exception:
                pass  # non-Postgres or sequence not found — ignore

        db.session.commit()
        print("✅  Catalog wiped.")

        # ── 6. Reseed ─────────────────────────────────────────────────────────
        total_cats = total_subs = total_svcs = 0

        for cat_data in CATALOG:
            # Insert category
            db.session.execute(
                text(
                    "INSERT INTO service_categories (name, name_fr, name_en, is_active) "
                    "VALUES (:name, :fr, :en, true)"
                ),
                {"name": cat_data["name_fr"], "fr": cat_data["name_fr"], "en": cat_data["name_en"]},
            )
            cat_id = db.session.execute(
                text("SELECT id FROM service_categories WHERE name = :n ORDER BY id DESC LIMIT 1"),
                {"n": cat_data["name_fr"]},
            ).scalar()
            total_cats += 1

            for sub_data in cat_data["subcategories"]:
                # Insert subcategory
                db.session.execute(
                    text(
                        "INSERT INTO service_subcategories (name, name_fr, name_en, category_id) "
                        "VALUES (:name, :fr, :en, :cat_id)"
                    ),
                    {
                        "name": sub_data["name_fr"],
                        "fr":   sub_data["name_fr"],
                        "en":   sub_data["name_en"],
                        "cat_id": cat_id,
                    },
                )
                sub_id = db.session.execute(
                    text(
                        "SELECT id FROM service_subcategories "
                        "WHERE name = :n AND category_id = :c ORDER BY id DESC LIMIT 1"
                    ),
                    {"n": sub_data["name_fr"], "c": cat_id},
                ).scalar()
                total_subs += 1

                # Insert one Service per subcategory
                # name_fr / name_en columns guaranteed to exist — added in step 2 above
                db.session.execute(
                    text(
                        "INSERT INTO services "
                        "(name, description, is_active, is_priority, featured, "
                        " subcategory_id, name_fr, name_en) "
                        "VALUES (:name, '', true, false, false, :sub_id, :fr, :en)"
                    ),
                    {
                        "name":   sub_data["name_fr"],
                        "fr":     sub_data["name_fr"],
                        "en":     sub_data["name_en"],
                        "sub_id": sub_id,
                    },
                )
                total_svcs += 1

        db.session.commit()

        # ── 7. Verify ─────────────────────────────────────────────────────────
        print(f"\n✅  Reseed complete.")
        print(f"   categories : {total_cats}")
        print(f"   subcategories: {total_subs}")
        print(f"   services   : {total_svcs}")
        print()

        rows = db.session.execute(
            text(
                "SELECT c.name_fr, COUNT(s.id) AS svc_count "
                "FROM service_categories c "
                "JOIN service_subcategories sc ON sc.category_id = c.id "
                "JOIN services s ON s.subcategory_id = sc.id "
                "WHERE s.is_active = true "
                "GROUP BY c.id, c.name_fr ORDER BY c.id"
            )
        ).fetchall()
        for row in rows:
            print(f"   {row[0]}: {row[1]} services")


if __name__ == "__main__":
    result = create_app()
    app = result[0] if isinstance(result, tuple) else result
    reseed(app)
