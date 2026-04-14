# scripts/diag_categories.py
#
# Prints all services belonging to category_id 19 and 21,
# showing id, name, is_active, subcategory_id.
#
# Run from project root:
#   python scripts/diag_categories.py

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from shizuverse.app import create_app
from shizuverse.models import db

TARGET_CATEGORY_IDS = (19, 21)


def run():
    result = create_app()
    app = result[0] if isinstance(result, tuple) else result
    with app.app_context():
        rows = db.session.execute(
            text(
                "SELECT s.id, s.name, s.is_active, s.subcategory_id, "
                "       ss.name AS sub_name, ss.category_id "
                "FROM services s "
                "JOIN service_subcategories ss ON s.subcategory_id = ss.id "
                "WHERE ss.category_id IN :cat_ids "
                "ORDER BY ss.category_id, ss.id, s.id"
            ),
            {"cat_ids": TARGET_CATEGORY_IDS},
        ).fetchall()

        print("\n" + "=" * 70)
        print("  DIAG — services in category_id 19 and 21")
        print("=" * 70)
        print(f"  {'svc_id':<8} {'is_active':<10} {'sub_id':<8} {'cat_id':<8} {'name'}")
        print("  " + "-" * 68)
        current_cat = None
        for r in rows:
            if r.category_id != current_cat:
                current_cat = r.category_id
                print(f"\n  [category_id={current_cat}]  subcategory: {r.sub_name!r}")
            print(f"  {r.id:<8} {str(r.is_active):<10} {r.subcategory_id:<8} {r.category_id:<8} {r.name}")
        if not rows:
            print("  (no rows found)")
        print("\n" + "=" * 70)


if __name__ == "__main__":
    run()
