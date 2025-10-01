import csv
import os
from app import create_app
from models import db, ServiceCategory, ServiceSubcategory, Service

app = create_app()

def seed_services_from_csv(csv_path):
    """Seed services from CSV with detailed logging"""
    
    full_path = os.path.join(os.path.dirname(__file__), csv_path)
    print(f"Reading CSV from: {full_path}")
    
    if not os.path.exists(full_path):
        print(f"ERROR: CSV file not found at {full_path}")
        return
    
    with app.app_context():
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                headers = reader.fieldnames
                print(f"CSV Headers: {headers}")
                
                rows = list(reader)
                print(f"Total rows in CSV: {len(rows)}")
                
                processed = 0
                skipped = 0
                
                for idx, row in enumerate(rows, 1):
                    try:
                        # Extract data
                        category_name = row.get('category', '').strip()
                        subcategory_name = row.get('subcategory', '').strip()
                        service_name = row.get('service_name', '').strip()
                        description = row.get('description', '').strip()
                        professional = row.get('professional_required', '').strip()
                        is_priority = row.get('priority', '').strip().lower() in ['true', '1', 'yes']
                        
                        print(f"\nRow {idx}:")
                        print(f"  Category: {category_name}")
                        print(f"  Subcategory: {subcategory_name}")
                        print(f"  Service: {service_name}")
                        
                        if not all([category_name, subcategory_name, service_name]):
                            print(f"  SKIP: Missing required fields")
                            skipped += 1
                            continue
                        
                        # Get or create category
                        category = ServiceCategory.query.filter_by(name=category_name).first()
                        if not category:
                            category = ServiceCategory(
                                name=category_name,
                                description=f"{category_name} services"
                            )
                            db.session.add(category)
                            db.session.flush()
                            print(f"  Created category: {category_name}")
                        
                        # Get or create subcategory
                        subcategory = ServiceSubcategory.query.filter_by(
                            name=subcategory_name,
                            category_id=category.id
                        ).first()
                        
                        if not subcategory:
                            subcategory = ServiceSubcategory(
                                name=subcategory_name,
                                category_id=category.id
                            )
                            db.session.add(subcategory)
                            db.session.flush()
                            print(f"  Created subcategory: {subcategory_name}")
                        
                        # Check if service exists
                        existing = Service.query.filter_by(
                            name=service_name,
                            subcategory_id=subcategory.id
                        ).first()
                        
                        if existing:
                            print(f"  SKIP: Service already exists")
                            skipped += 1
                            continue
                        
                        # Create service
                        service = Service(
                            name=service_name,
                            description=description,
                            professional_required=professional,
                            is_priority=is_priority,
                            is_active=True,
                            subcategory_id=subcategory.id
                        )
                        db.session.add(service)
                        processed += 1
                        print(f"  CREATED service")
                        
                    except Exception as e:
                        print(f"  ERROR processing row {idx}: {e}")
                        skipped += 1
                
                # Commit all changes
                db.session.commit()
                print(f"\n✓ Seeding complete!")
                print(f"  Processed: {processed}")
                print(f"  Skipped: {skipped}")
                print(f"  Total in DB: {Service.query.count()}")
                
        except Exception as e:
            db.session.rollback()
            print(f"\n✗ Seeding failed: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    csv_path = 'services/Re-Prioritized_Services.csv'
    seed_services_from_csv(csv_path)
