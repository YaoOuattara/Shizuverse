import os
import csv
import logging
import argparse
from datetime import datetime

from shizuverse.app import create_app
from shizuverse.models import db
from shizuverse.models.service_models import ServiceCategory, ServiceSubcategory, Service

# SubmittedService is optional; import if present
try:
    from shizuverse.models.submitted_service import SubmittedService
except Exception:
    SubmittedService = None  # type: ignore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s",
)
logger = logging.getLogger(__name__)

SKIPPED_LOG_FILE = "skipped_services.log"
SKIPPED_CSV_FILE = "skipped_services.csv"


def seed_services_from_csv(csv_path: str) -> None:
    if not os.path.exists(csv_path):
        logger.error("CSV file not found: %s", csv_path)
        return

    added, skipped = 0, 0
    with open(csv_path, newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            category_name = (row.get("category") or "").strip()
            subcategory_name = (row.get("subcategory") or "").strip()
            service_name = (row.get("service_name") or "").strip()
            description = (row.get("description") or "").strip()
            professional_required = (row.get("professional_required") or "").strip()
            is_priority = (row.get("priority") or "").strip().lower() in {"1", "true", "yes", "prioritaire"}

            if not category_name or not subcategory_name or not service_name:
                skipped += 1
                _log_skipped(row)
                continue

            # Ensure category
            category = ServiceCategory.query.filter_by(name=category_name).first()
            if not category:
                category = ServiceCategory(name=category_name)
                db.session.add(category)
                db.session.flush()

            # Ensure subcategory
            subcat = ServiceSubcategory.query.filter_by(name=subcategory_name, category_id=category.id).first()
            if not subcat:
                subcat = ServiceSubcategory(name=subcategory_name, category_id=category.id)
                db.session.add(subcat)
                db.session.flush()

            # Ensure service (unique on name+subcategory)
            existing = Service.query.filter_by(name=service_name, subcategory_id=subcat.id).first()
            if existing:
                continue

            svc = Service(
                name=service_name,
                description=description,
                professional_required=professional_required,
                is_active=True,
                is_priority=is_priority,
                featured=False,
                subcategory_id=subcat.id,
            )
            db.session.add(svc)
            added += 1

    db.session.commit()
    logger.info("✅ Seeded %d new services, skipped %d from %s", added, skipped, os.path.basename(csv_path))


def _log_skipped(row: dict) -> None:
    with open(SKIPPED_LOG_FILE, "a", encoding="utf-8") as logf:
        logf.write(f"{datetime.now()} | Skipped: {row}\n")

    file_exists = os.path.isfile(SKIPPED_CSV_FILE)
    with open(SKIPPED_CSV_FILE, "a", newline="", encoding="utf-8") as skipfile:
        writer = csv.DictWriter(skipfile, fieldnames=row.keys())
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)


def seed_submissions() -> None:
    if not SubmittedService:
        logger.info("SubmittedService model not available; skipping submissions seeding.")
        return

    approved = SubmittedService.query.filter_by(status="approved").all()
    if not approved:
        logger.info("✅ No approved submissions to seed.")
        return

    added, skipped = 0, 0
    for sub in approved:
        if not sub.subcategory:
            _log_skipped({"reason": "missing subcategory", "id": sub.id})
            skipped += 1
            continue

        # Ensure category
        category = ServiceCategory.query.filter_by(name=sub.category.strip()).first()
        if not category:
            category = ServiceCategory(name=sub.category.strip())
            db.session.add(category)
            db.session.flush()

        # Ensure subcategory
        subcat = ServiceSubcategory.query.filter_by(name=sub.subcategory.strip(), category_id=category.id).first()
        if not subcat:
            subcat = ServiceSubcategory(name=sub.subcategory.strip(), category_id=category.id)
            db.session.add(subcat)
            db.session.flush()

        # Ensure service
        existing = Service.query.filter_by(name=sub.service_name.strip(), subcategory_id=subcat.id).first()
        if existing:
            sub.status = "seeded"
            skipped += 1
            continue

        svc = Service(
            name=sub.service_name.strip(),
            description=sub.description,
            professional_required=sub.professional_required,
            is_active=True,
            is_priority=False,
            featured=False,
            subcategory_id=subcat.id,
        )
        db.session.add(svc)
        sub.status = "seeded"
        added += 1

    db.session.commit()
    logger.info("✅ Seeded %d new services from submissions, skipped %d", added, skipped)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed services into the database.")
    parser.add_argument("--csv", choices=["prioritized", "non-prioritized"], help="Seed services from CSV file")
    parser.add_argument("--submissions", action="store_true", help="Seed approved submissions")
    args = parser.parse_args()

    app, _ = create_app()
    with app.app_context():
        if args.csv == "prioritized":
            seed_services_from_csv("data/services/prioritized_services.csv")
        elif args.csv == "non-prioritized":
            seed_services_from_csv("data/services/non_prioritized_services.csv")

        if args.submissions:
            seed_submissions()

