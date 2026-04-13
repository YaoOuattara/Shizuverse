# scripts/update_MVP_CATEGORIES.py
#
# Applies three targeted changes to MVP service categories:
#   1. Rename category id=17 → "Nounou & Baby-sitting / Nounou et baby-sitting"
#   2. Replace category id=19 (Catering) → "Elderly Care / Aide aux seniors"
#      with subcategories: home assistance, senior companionship, meal and hygiene support
#   3. Add new category "Climatisation & Electromenager"
#      with subcategories: AC installation, AC maintenance, appliance repair,
#                          TV and electronics repair
#
# Run from project root:
#   python scripts/update_MVP_CATEGORIES.py

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from shizuverse.app import create_app
from shizuverse.models import db
from shizuverse.models.service_models import ServiceCategory, ServiceSubcategory

ELDERLY_SUBCATEGORIES = [
    "Home assistance",
    "Senior companionship",
    "Meal and hygiene support",
]

CLIM_SUBCATEGORIES = [
    "AC installation",
    "AC maintenance",
    "Appliance repair",
    "TV and electronics repair",
]


def rename_category(category_id, new_name, summary):
    cat = ServiceCategory.query.get(category_id)
    if cat is None:
        summary.append(f"  SKIP  id={category_id} — not found in DB")
        return
    old_name = cat.name
    cat.name = new_name
    db.session.flush()
    summary.append(f"  OK    id={category_id} renamed: '{old_name}' → '{new_name}'")


def replace_category(category_id, new_name, subcategory_names, summary):
    cat = ServiceCategory.query.get(category_id)
    if cat is None:
        summary.append(f"  SKIP  id={category_id} — not found in DB")
        return
    old_name = cat.name

    # Wipe existing subcategories (cascade deletes their services too)
    ServiceSubcategory.query.filter_by(category_id=category_id).delete()
    cat.name = new_name
    db.session.flush()

    for sub_name in subcategory_names:
        sub = ServiceSubcategory(name=sub_name, category_id=category_id)
        db.session.add(sub)

    db.session.flush()
    summary.append(
        f"  OK    id={category_id} replaced: '{old_name}' → '{new_name}' "
        f"with {len(subcategory_names)} subcategories: {subcategory_names}"
    )


def add_category(name, subcategory_names, summary):
    existing = ServiceCategory.query.filter_by(name=name).first()
    if existing:
        summary.append(f"  SKIP  '{name}' already exists (id={existing.id})")
        return

    cat = ServiceCategory(name=name)
    db.session.add(cat)
    db.session.flush()

    for sub_name in subcategory_names:
        sub = ServiceSubcategory(name=sub_name, category_id=cat.id)
        db.session.add(sub)

    db.session.flush()
    summary.append(
        f"  OK    Added '{name}' (id={cat.id}) "
        f"with {len(subcategory_names)} subcategories: {subcategory_names}"
    )


def print_summary(summary):
    print("\n" + "=" * 60)
    print("  UPDATE MVP CATEGORIES — VERIFICATION SUMMARY")
    print("=" * 60)
    for line in summary:
        print(line)

    # Full snapshot of all categories + subcategory counts
    print("\n  --- Current category snapshot ---")
    for cat in ServiceCategory.query.order_by(ServiceCategory.id).all():
        sub_count = ServiceSubcategory.query.filter_by(category_id=cat.id).count()
        print(f"  [{cat.id:>3}] {cat.name}  ({sub_count} subcategory/ies)")
    print("=" * 60)


def run():
    app = create_app()
    with app.app_context():
        summary = []

        # 1. Rename id=17
        rename_category(
            17,
            "Nounou & Baby-sitting / Nounou et baby-sitting",
            summary,
        )

        # 2. Replace id=19 (Catering → Elderly Care)
        replace_category(
            19,
            "Elderly Care / Aide aux seniors",
            ELDERLY_SUBCATEGORIES,
            summary,
        )

        # 3. Add new category
        add_category(
            "Climatisation & Electromenager",
            CLIM_SUBCATEGORIES,
            summary,
        )

        db.session.commit()
        print_summary(summary)


if __name__ == "__main__":
    run()
