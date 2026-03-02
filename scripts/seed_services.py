# # scripts/seed_services.py
import csv, os
from shizuverse.app import create_app
from shizuverse.models import db, ServiceCategory, ServiceSubcategory, Service

CSV_FILE =
"data/prioritized_services.csv"  # adjust if needed

def seed_services():
    app, _ = create_app()  # create_app returns (app, socketio)
    with app.app_context():
        with open(CSV_FILE, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                category_name = row['category'].strip().upper()
                subcategory_name = row['subcategory'].strip().upper()
                service_name = row['service_name'].strip().capitalize()
                description = (row.get('description') or '').strip()
                professional = (row.get('professional_required') or '').strip().capitalize()
                is_priority = (row.get('priority') or '').strip().lower() == 'yes'

                category = ServiceCategory.query.filter_by(name=category_name).first()
                if not category:
                    category = ServiceCategory(name=category_name)
                    db.session.add(category)
                    db.session.commit()

                subcat = ServiceSubcategory.query.filter_by(
                    name=subcategory_name, category_id=category.id
                ).first()
                if not subcat:
                    subcat = ServiceSubcategory(name=subcategory_name, category_id=category.id)
                    db.session.add(subcat)
                    db.session.commit()

                exists = Service.query.filter_by(name=service_name, subcategory_id=subcat.id).first()
                if not exists:
                    svc = Service(
                        name=service_name,
                        description=description,
                        professional_required=professional,
                        is_active=True,
                        is_priority=is_priority,
                        subcategory_id=subcat.id,
                    )
                    db.session.add(svc)
        db.session.commit()
        print("✅ Services successfully seeded.")

if __name__ == "__main__":
    seed_services()
