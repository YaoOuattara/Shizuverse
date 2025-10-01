# scripts/seed_services.py

import csv
import os
from models import db, ServiceCategory, ServiceSubcategory, Service
from app import create_app

app = create_app()

CSV_FILE = "data/Re-Prioritized_Services.csv"  # Adjust if your path differs

def seed_services():
    with app.app_context():
        with open(CSV_FILE, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            
            for row in reader:
                category_name = row['category'].strip().upper()
                subcategory_name = row['subcategory'].strip().upper()
                service_name = row['service_name'].strip().capitalize()
                description = row['description'].strip()
                professional = row['professional_required'].strip().capitalize()
                is_priority = row.get('priority', '').strip().lower() == 'yes'  # Optional 'priority' column

                # ✅ Create or get category
                category = ServiceCategory.query.filter_by(name=category_name).first()
                if not category:
                    category = ServiceCategory(name=category_name)
                    db.session.add(category)
                    db.session.commit()

                # ✅ Create or get subcategory
                subcategory = ServiceSubcategory.query.filter_by(name=subcategory_name, category_id=category.id).first()
                if not subcategory:
                    subcategory = ServiceSubcategory(name=subcategory_name, category_id=category.id)
                    db.session.add(subcategory)
                    db.session.commit()

                # ✅ Check for existing service
                existing_service = Service.query.filter_by(name=service_name, subcategory_id=subcategory.id).first()
                if not existing_service:
                    service = Service(
                        name=service_name,
                        description=description,
                        professional_required=professional,
                        is_active=True,
                        is_priority=is_priority,
                        subcategory_id=subcategory.id
                    )
                    db.session.add(service)

        db.session.commit()
        print("✅ Services successfully seeded.")

if __name__ == "__main__":
    seed_services()
