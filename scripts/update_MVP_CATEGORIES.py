# scripts/update_MVP_CATEGORIES.py
#
# Applies three targeted changes to MVP service categories:
#   1. Rename category id=17 → name="Nounou & Baby-sitting",
#      name_en="Nounou & Baby-sitting", name_fr="Nounou et baby-sitting"
#   2. Replace category id=19 (Catering) → "Elderly Care / Aide aux seniors"
#      with subcategories + one service each (service ids 39, 40, 41)
#   3. Add new category "Climatisation & Electromenager" (id=21)
#      with subcategories + one service each (service ids 42, 43, 44, 45)
#
# Bilingual fields (name_en, name_fr) are not ORM-mapped — updated via raw SQL.
#
# Run from project root:
#   python scripts/update_MVP_CATEGORIES.py

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from shizuverse.app import create_app
from shizuverse.models import db
from shizuverse.models.service_models import ServiceCategory, ServiceSubcategory, Service

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


def _set_bilingual(category_id, name_en, name_fr):
    """Raw SQL update for unmapped bilingual columns."""
    db.session.execute(
        text("UPDATE service_categories SET name_en=:en, name_fr=:fr WHERE id=:id"),
        {"en": name_en, "fr": name_fr, "id": category_id},
    )


def _insert_service(service_id, name, subcategory_id):
    """Raw SQL insert for a service with an explicit id."""
    db.session.execute(
        text(
            "INSERT INTO services "
            "(id, name, is_active, professional_required, subcategory_id, is_priority, featured) "
            "VALUES (:id, :name, :is_active, :prof, :sub_id, :is_priority, :featured)"
        ),
        {
            "id": service_id,
            "name": name,
            "is_active": True,
            "prof": "",
            "sub_id": subcategory_id,
            "is_priority": False,
            "featured": False,
        },
    )


def rename_category(category_id, name, name_en, name_fr, summary):
    cat = ServiceCategory.query.get(category_id)
    if cat is None:
        summary.append(f"  SKIP  id={category_id} — not found in DB")
        return
    old_name = cat.name
    cat.name = name
    db.session.flush()
    _set_bilingual(category_id, name_en, name_fr)
    summary.append(
        f"  OK    id={category_id} renamed: '{old_name}' → "
        f"name='{name}', name_en='{name_en}', name_fr='{name_fr}'"
    )


def replace_category(category_id, name, name_en, name_fr,
                     subcategory_names, service_ids, summary):
    cat = ServiceCategory.query.get(category_id)
    if cat is None:
        summary.append(f"  SKIP  id={category_id} — not found in DB")
        return
    old_name = cat.name

    # Delete services referencing these subcategories before deleting subcategories
    Service.query.filter(
        Service.subcategory_id.in_(
            [s.id for s in ServiceSubcategory.query.filter_by(category_id=category_id).all()]
        )
    ).delete(synchronize_session="fetch")

    # Wipe existing subcategories
    ServiceSubcategory.query.filter_by(category_id=category_id).delete()
    cat.name = name
    db.session.flush()

    _set_bilingual(category_id, name_en, name_fr)

    # Create one subcategory + one service per entry
    for sub_name, svc_id in zip(subcategory_names, service_ids):
        sub = ServiceSubcategory(name=sub_name, category_id=category_id)
        db.session.add(sub)
        db.session.flush()
        _insert_service(svc_id, sub_name, sub.id)

    summary.append(
        f"  OK    id={category_id} replaced: '{old_name}' → "
        f"name='{name}', name_en='{name_en}', name_fr='{name_fr}' | "
        f"{len(subcategory_names)} subcategories, services {service_ids}"
    )


def add_category(name, name_en, name_fr, subcategory_names, service_ids, summary):
    existing = ServiceCategory.query.filter_by(name=name).first()
    if existing:
        summary.append(f"  SKIP  '{name}' already exists (id={existing.id})")
        return

    cat = ServiceCategory(name=name)
    db.session.add(cat)
    db.session.flush()

    _set_bilingual(cat.id, name_en, name_fr)

    # Create one subcategory + one service per entry
    for sub_name, svc_id in zip(subcategory_names, service_ids):
        sub = ServiceSubcategory(name=sub_name, category_id=cat.id)
        db.session.add(sub)
        db.session.flush()
        _insert_service(svc_id, sub_name, sub.id)

    summary.append(
        f"  OK    Added '{name}' (id={cat.id}), "
        f"name_en='{name_en}', name_fr='{name_fr}' | "
        f"{len(subcategory_names)} subcategories, services {service_ids}"
    )


def print_summary(summary):
    print("\n" + "=" * 60)
    print("  UPDATE MVP CATEGORIES — VERIFICATION SUMMARY")
    print("=" * 60)
    for line in summary:
        print(line)

    print("\n  --- Current category snapshot ---")
    for cat in ServiceCategory.query.order_by(ServiceCategory.id).all():
        sub_count = ServiceSubcategory.query.filter_by(category_id=cat.id).count()
        print(f"  [{cat.id:>3}] {cat.name}  ({sub_count} subcategory/ies)")
    print("=" * 60)


def run():
    result = create_app()
    app = result[0] if isinstance(result, tuple) else result
    with app.app_context():
        summary = []

        # 1. Rename id=17
        rename_category(
            17,
            name="Nounou & Baby-sitting",
            name_en="Nounou & Baby-sitting",
            name_fr="Nounou et baby-sitting",
            summary=summary,
        )

        # 2. Replace id=19 (Catering → Elderly Care)
        replace_category(
            19,
            name="Elderly Care / Aide aux seniors",
            name_en="Elderly Care",
            name_fr="Aide aux seniors",
            subcategory_names=ELDERLY_SUBCATEGORIES,
            service_ids=[39, 40, 41],
            summary=summary,
        )

        # 3. Add new category (expected id=21)
        add_category(
            name="Climatisation & Electromenager",
            name_en="AC & Appliances",
            name_fr="Climatisation et électroménager",
            subcategory_names=CLIM_SUBCATEGORIES,
            service_ids=[42, 43, 44, 45],
            summary=summary,
        )

        db.session.commit()
        print_summary(summary)


if __name__ == "__main__":
    run()
