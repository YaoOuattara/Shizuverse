# scripts/reset_categories_19_21.py
#
# Cleanly resets subcategories and services for categories 19 and 21.
#
#   1. Delete all services whose subcategory belongs to category 19 or 21
#   2. Delete all subcategories belonging to category 19 or 21
#   3. Recreate subcategories + one service each (auto-generated IDs)
#
# Safe to run multiple times (idempotent).
#
# Run from project root:
#   python scripts/reset_categories_19_21.py

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from shizuverse.app import create_app
from shizuverse.models import db
from shizuverse.models.service_models import ServiceCategory, ServiceSubcategory, Service

# (subcategory_name_en, service_name) pairs per category
CATEGORY_DATA = {
    19: {
        "label": "Elderly Care / Aide aux seniors",
        "entries": [
            ("Assistance à domicile",          "Home assistance"),
            ("Accompagnement seniors",          "Senior companionship"),
            ("Aide aux repas et hygiène",       "Meal and hygiene support"),
        ],
    },
    21: {
        "label": "Climatisation & Electromenager",
        "entries": [
            ("Installation de climatiseur",          "AC installation"),
            ("Entretien et nettoyage de clim",       "AC maintenance"),
            ("Réparation d'électroménager",          "Appliance repair"),
            ("Dépannage TV et électronique",         "TV and electronics repair"),
        ],
    },
}


def reset_category(category_id, data, summary):
    cat = ServiceCategory.query.get(category_id)
    if cat is None:
        summary.append(f"  SKIP  category id={category_id} — not found in DB")
        return

    # ── 1. delete services ────────────────────────────────────────────
    sub_ids = [
        s.id for s in ServiceSubcategory.query.filter_by(category_id=category_id).all()
    ]
    svc_deleted = 0
    if sub_ids:
        svc_deleted = Service.query.filter(
            Service.subcategory_id.in_(sub_ids)
        ).delete(synchronize_session="fetch")

    # ── 2. delete subcategories ───────────────────────────────────────
    sub_deleted = ServiceSubcategory.query.filter_by(
        category_id=category_id
    ).delete(synchronize_session="fetch")
    db.session.flush()

    # ── 3. recreate ───────────────────────────────────────────────────
    created = []
    for sub_name, svc_name in data["entries"]:
        sub = ServiceSubcategory(name=sub_name, category_id=category_id)
        db.session.add(sub)
        db.session.flush()

        svc = Service(
            name=svc_name,
            subcategory_id=sub.id,
            is_active=True,
            is_priority=False,
            featured=False,
            professional_required="",
        )
        db.session.add(svc)
        db.session.flush()
        created.append((sub.id, sub_name, svc.id, svc_name))

    summary.append(
        f"  OK    id={category_id} ({data['label']}) — "
        f"deleted {svc_deleted} service(s), {sub_deleted} subcategory/ies; "
        f"recreated {len(created)}"
    )
    for sub_id, sub_name, svc_id, svc_name in created:
        summary.append(f"          sub_id={sub_id} '{sub_name}' → svc_id={svc_id} '{svc_name}'")


def print_summary(summary):
    print("\n" + "=" * 70)
    print("  RESET CATEGORIES 19 & 21 — SUMMARY")
    print("=" * 70)
    for line in summary:
        print(line)

    print("\n  --- Verification: current subcategories & services ---")
    for cat_id in sorted(CATEGORY_DATA):
        cat = ServiceCategory.query.get(cat_id)
        label = cat.name if cat else "NOT FOUND"
        print(f"\n  [category_id={cat_id}] {label}")
        subs = ServiceSubcategory.query.filter_by(category_id=cat_id).all()
        for sub in subs:
            svcs = Service.query.filter_by(subcategory_id=sub.id).all()
            for svc in svcs:
                print(
                    f"    sub_id={sub.id:<5} '{sub.name}'"
                    f"  →  svc_id={svc.id:<5} '{svc.name}'  is_active={svc.is_active}"
                )
    print("=" * 70)


def run():
    result = create_app()
    app = result[0] if isinstance(result, tuple) else result
    with app.app_context():
        summary = []

        for category_id, data in CATEGORY_DATA.items():
            reset_category(category_id, data, summary)

        db.session.commit()
        print_summary(summary)


if __name__ == "__main__":
    run()
