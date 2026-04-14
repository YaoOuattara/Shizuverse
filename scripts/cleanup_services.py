# scripts/cleanup_services.py
#
# Deactivates all services that belong to pre-MVP categories (ids 1-12).
# Services in MVP categories (ids 13-21) are left / forced active.
# Safe to run multiple times (idempotent).
#
# Run from project root:
#   python scripts/cleanup_services.py

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from shizuverse.app import create_app
from shizuverse.models import db
from shizuverse.models.service_models import ServiceCategory, ServiceSubcategory, Service

OLD_CAT_IDS = list(range(1, 13))   # 1-12  (pre-MVP)
MVP_CAT_IDS = list(range(13, 22))  # 13-21 (MVP)


def _subcategory_ids_for(category_ids):
    if not category_ids:
        return []
    rows = db.session.execute(
        text("SELECT id FROM service_subcategories WHERE category_id IN :ids"),
        {"ids": tuple(category_ids)},
    ).fetchall()
    return [r[0] for r in rows]


def run():
    result = create_app()
    app = result[0] if isinstance(result, tuple) else result
    with app.app_context():

        # ── snapshot before ───────────────────────────────────────────
        total_before = Service.query.count()

        # ── 1. deactivate pre-MVP services ────────────────────────────
        old_sub_ids = _subcategory_ids_for(OLD_CAT_IDS)
        if old_sub_ids:
            deactivated = (
                Service.query
                .filter(
                    Service.subcategory_id.in_(old_sub_ids),
                    Service.is_active == True,  # noqa: E712
                )
                .count()
            )
            db.session.execute(
                text("UPDATE services SET is_active = false "
                     "WHERE subcategory_id IN :ids"),
                {"ids": tuple(old_sub_ids)},
            )
        else:
            deactivated = 0

        # ── 2. ensure MVP services are active ─────────────────────────
        mvp_sub_ids = _subcategory_ids_for(MVP_CAT_IDS)
        if mvp_sub_ids:
            db.session.execute(
                text("UPDATE services SET is_active = true "
                     "WHERE subcategory_id IN :ids"),
                {"ids": tuple(mvp_sub_ids)},
            )

        db.session.commit()

        # ── 3. summary ────────────────────────────────────────────────
        active_rows = db.session.execute(
            text(
                "SELECT sc.name, COUNT(s.id) AS cnt "
                "FROM services s "
                "JOIN service_subcategories ss ON s.subcategory_id = ss.id "
                "JOIN service_categories sc ON ss.category_id = sc.id "
                "WHERE s.is_active = true "
                "GROUP BY sc.id, sc.name "
                "ORDER BY sc.id"
            )
        ).fetchall()

        active_total = sum(r.cnt for r in active_rows)

        print("\n" + "=" * 60)
        print("  CLEANUP SERVICES — SUMMARY")
        print("=" * 60)
        print(f"  Total services (before) : {total_before}")
        print(f"  Deactivated             : {deactivated}")
        print(f"  Remaining active        : {active_total}")
        print()
        print("  Active services by category:")
        for row in active_rows:
            print(f"    {row.name:<40}  {row.cnt} service(s)")
        print("=" * 60)


if __name__ == "__main__":
    run()
