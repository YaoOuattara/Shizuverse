# seeds.py
import os, csv, logging, argparse, pathlib
from sqlalchemy import inspect
from shizuverse.app import create_app_flask_app
from shizuverse.models import db, Service, ServiceCategory, ServiceSubcategory

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger("seeds")

ROOT = pathlib.Path(__file__).parent
CSV_PRIORITIZED = ROOT / "data/services/prioritized_services.csv"
CSV_NONPRIORITIZED = ROOT / "data/services/non_prioritized_services.csv"

DEFAULT_SUBCATEGORY = "Général"

def _norm(s):
    s = (s or "").strip()
    return s if s and s.upper() not in {"N/A", "NA", "-", "NULL"} else ""

def _is_priority(row):
    # Accepts either priority_level (PRIORITAIRE/ NON PRIORITAIRE) or priority (true/1/etc)
    lvl = _norm(row.get("priority_level"))
    if lvl:
        return lvl.upper().startswith("PRIORIT")
    raw = _norm(row.get("priority"))
    return raw.lower() in {"1", "true", "yes", "prioritaire"}

def must_have_tables():
    need = {"service_categories","service_subcategories","services"}
    have = set(inspect(db.engine).get_table_names())
    missing = need - have
    if missing:
        raise SystemExit(f"❌ Missing tables {missing}. Run `flask db upgrade` first.")

def seed_csv(csv_path: pathlib.Path):
    if not csv_path.is_file():
        log.error("CSV not found: %s", csv_path)
        return 0, 0

    added = skipped = 0
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            category_name = _norm(row.get("category"))
            subcat_name   = _norm(row.get("subcategory")) or DEFAULT_SUBCATEGORY
            service_name  = _norm(row.get("service_name"))
            desc          = _norm(row.get("description")) or None
            professional  = _norm(row.get("professional_required")) or None
            is_priority   = _is_priority(row)

            if not (category_name and subcat_name and service_name):
                skipped += 1
                log.warning("skip (missing required fields): %s", row)
                continue

            # ensure category
            cat = ServiceCategory.query.filter_by(name=category_name).first()
            if not cat:
                cat = ServiceCategory(name=category_name)
                db.session.add(cat)
                db.session.flush()

            # ensure subcategory (by category)
            sub = ServiceSubcategory.query.filter_by(name=subcat_name, category_id=cat.id).first()
            if not sub:
                sub = ServiceSubcategory(name=subcat_name, category_id=cat.id)
                db.session.add(sub)
                db.session.flush()

            # ensure service
            existing = Service.query.filter_by(name=service_name, subcategory_id=sub.id).first()
            if existing:
                skipped += 1
                continue

            svc = Service(
                name=service_name,
                description=desc,
                professional_required=professional,
                is_active=True,
                is_priority=is_priority,
                featured=False,
                subcategory_id=sub.id,
            )
            db.session.add(svc)
            added += 1

    db.session.commit()
    log.info("✅ %s → added=%d, skipped=%d", csv_path.name, added, skipped)
    return added, skipped

def feature_sample(n=8):
    ids = [r.id for r in Service.query.order_by(Service.id).limit(n).all()]
    if not ids:
        log.info("No services yet to feature.")
        return 0
    Service.query.filter(Service.id.in_(ids)).update(
        {"featured": True, "is_active": True},
        synchronize_session=False,
    )
    db.session.commit()
    log.info("🌟 Marked %d services as featured + active", len(ids))
    return len(ids)

def main():
    parser = argparse.ArgumentParser(description="Seed services into the DB.")
    parser.add_argument("--csv", choices=["prioritized","non-prioritized"], help="Pick a CSV to seed")
    args = parser.parse_args()

    app = create_app_flask_app()
    with app.app_context():
        must_have_tables()
        total_added = total_skipped = 0

        if args.csv == "prioritized":
            a,s = seed_csv(CSV_PRIORITIZED); total_added+=a; total_skipped+=s
        elif args.csv == "non-prioritized":
            a,s = seed_csv(CSV_NONPRIORITIZED); total_added+=a; total_skipped+=s
        else:
            log.info("No CSV selected. Use --csv prioritized|non-prioritized")

        feature_sample(8)
        log.info("DONE. totals added=%d, skipped=%d", total_added, total_skipped)

if __name__ == "__main__":
    main()

