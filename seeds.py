import os
import csv
import logging
import argparse
from datetime import datetime

from app import create_app
from models import db
from models.service_models import ServiceCategory, ServiceSubcategory, Service
from models.submitted_service import SubmittedService

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s"
)
logger = logging.getLogger(__name__)

# Skipped services export
SKIPPED_LOG_FILE = "skipped_services.log"
SKIPPED_CSV_FILE = "skipped_services.csv"


def seed_services_from_csv(csv_path):
    """Seed services from CSV into DB"""
    if not os.path.exists(csv_path):
        logger.error(f"CSV file not found: {csv_path}")
        return

    with open(csv_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        added, skipped = 0, 0

        for row in reader:
            category_name = row.get('category', '').strip()
            subcategory_name = row.get('subcategory', '').strip()
            service_name = row.get('service_name', '').strip()
            description = row.get('description', '').strip()
            professional_required = row.get('professional_required', '').strip()
            is_priority = row.get('priority', '').strip().lower() in ['1', 'true', 'yes', 'prioritaire']

            # ✅ Skip if subcategory or required field missing
            if not category_name or not subcategory_name or not service_name:
                skipped += 1
                logger.warning(f"⚠️ Skipping row due to missing data: {row}")

                # Save to skipped_services.log
                with open(SKIPPED_LOG_FILE, "a", encoding="utf-8") as logf:
                    logf.write(f"{datetime.now()} | Skipped: {row}\n")

                # Save to skipped_services.csv
                file_exists = os.path.isfile(SKIPPED_CSV_FILE)
                with open(SKIPPED_CSV_FILE, "a", newline='', encoding="utf-8") as skipfile:
                    writer = csv.DictWriter(skipfile, fieldnames=row.keys())
                    if not file_exists:
                        writer.writeheader()
                    writer.writerow(row)
                continue

            # ✅ Ensure category
            category = ServiceCategory.query.filter_by(name=category_name).first()
            if not category:
                category = ServiceCategory(name=category_name)
                db.session.add(category)
                db.session.flush()

            # ✅ Ensure subcategory
            subcategory = ServiceSubcategory.query.filter_by(
                name=subcategory_name, category_id=category.id
            ).first()
            if not subcategory:
                subcategory = ServiceSubcategory(name=subcategory_name, category_id=category.id)
                db.session.add(subcategory)
                db.session.flush()

            # ✅ Ensure service
            existing = Service.query.filter_by(name=service_name, subcategory_id=subcategory.id).first()
            if not existing:
                service = Service(
                    name=service_name,
                    description=description,
                    professional_required=professional_required,
                    is_active=True,
                    is_priority=is_priority,
                    subcategory_id=subcategory.id
                )
                db.session.add(service)
                added += 1

        db.session.commit()
        logger.info(f"✅ Seeded {added} new services, skipped {skipped} from {os.path.basename(csv_path)}")


def seed_submissions():
    """Move approved submissions into the main services table."""
    approved = SubmittedService.query.filter_by(status="approved").all()
    if not approved:
        logger.info("✅ No approved submissions to seed.")
        return

    added, skipped = 0, 0

    for sub in approved:
        if not sub.subcategory:  # skip if subcategory missing
            logger.warning(f"⚠️ Skipping submission {sub.id} due to missing subcategory")
            skipped += 1
            continue

        # Ensure category exists
        category = ServiceCategory.query.filter_by(name=sub.category.strip()).first()
        if not category:
            category = ServiceCategory(name=sub.category.strip())
            db.session.add(category)
            db.session.flush()

        # Ensure subcategory exists
        subcat = ServiceSubcategory.query.filter_by(
            name=sub.subcategory.strip(), category_id=category.id
        ).first()
        if not subcat:
            subcat = ServiceSubcategory(name=sub.subcategory.strip(), category_id=category.id)
            db.session.add(subcat)
            db.session.flush()

        # Ensure service doesn’t already exist
        existing = Service.query.filter_by(
            name=sub.service_name.strip(), subcategory_id=subcat.id
        ).first()

        if not existing:
            service = Service(
                name=sub.service_name.strip(),
                description=sub.description,
                professional_required=sub.professional_required,
                is_active=True,
                is_priority=False,
                subcategory_id=subcat.id,
            )
            db.session.add(service)
            sub.status = "seeded"  # update status
            added += 1
        else:
            logger.info(f"ℹ️ Service already exists: {sub.service_name}")
            sub.status = "seeded"
            skipped += 1

    db.session.commit()
    logger.info(f"✅ Seeded {added} new services, skipped {skipped}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed services into the database.")
    parser.add_argument("--csv", choices=["prioritized", "non-prioritized"], help="Seed services from CSV file")
    parser.add_argument("--submissions", action="store_true", help="Seed approved submissions")
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        if args.csv == "prioritized":
            seed_services_from_csv("data/services/prioritized_services.csv")
        elif args.csv == "non-prioritized":
            seed_services_from_csv("data/services/non_prioritized_services.csv")

        if args.submissions:
            seed_submissions()
