from shizuverse.app import create_app
from shizuverse.models import db
from shizuverse.models.service_models import ServiceCategory, ServiceSubcategory, Service
from datetime import datetime

result = create_app()
app = result[0] if isinstance(result, tuple) else result

MVP_DATA = [
    {
        "name_en": "Cleaning", "name_fr": "Ménage et nettoyage",
        "subcategories": [
            {"name_en": "Regular cleaning", "name_fr": "Ménage régulier"},
            {"name_en": "Deep clean", "name_fr": "Grand nettoyage"},
            {"name_en": "Laundry & ironing", "name_fr": "Lessive et repassage"},
            {"name_en": "Post-construction clean", "name_fr": "Nettoyage après travaux"},
        ]
    },
    {
        "name_en": "Plumbing", "name_fr": "Plomberie",
        "subcategories": [
            {"name_en": "Leak repair", "name_fr": "Réparation de fuite"},
            {"name_en": "Drain unblocking", "name_fr": "Débouchage"},
            {"name_en": "Installation", "name_fr": "Installation sanitaire"},
        ]
    },
    {
        "name_en": "Electrical", "name_fr": "Électricité",
        "subcategories": [
            {"name_en": "Repairs", "name_fr": "Dépannage électrique"},
            {"name_en": "Installation", "name_fr": "Installation électrique"},
            {"name_en": "Troubleshooting", "name_fr": "Diagnostic panne"},
        ]
    },
    {
        "name_en": "Handyman", "name_fr": "Bricolage",
        "subcategories": [
            {"name_en": "Furniture assembly", "name_fr": "Montage de meubles"},
            {"name_en": "Wall fixing", "name_fr": "Fixation murale"},
            {"name_en": "Painting & finishing", "name_fr": "Peinture et finitions"},
            {"name_en": "General repairs", "name_fr": "Petites réparations"},
        ]
    },
    {
        "name_en": "Childcare", "name_fr": "Garde d'enfants",
        "subcategories": [
            {"name_en": "Babysitting", "name_fr": "Garde ponctuelle"},
            {"name_en": "Regular care", "name_fr": "Garde régulière"},
            {"name_en": "Homework help", "name_fr": "Soutien scolaire"},
        ]
    },
    {
        "name_en": "Beauty at Home", "name_fr": "Beauté à domicile",
        "subcategories": [
            {"name_en": "Hair", "name_fr": "Coiffure"},
            {"name_en": "Nails & skin", "name_fr": "Manucure et soins"},
            {"name_en": "Massage & wellness", "name_fr": "Massage et bien-être"},
        ]
    },
    {
        "name_en": "Catering & Cooking", "name_fr": "Traiteur et cuisine",
        "subcategories": [
            {"name_en": "Daily meal prep", "name_fr": "Cuisine quotidienne"},
            {"name_en": "Event catering", "name_fr": "Traiteur événement"},
            {"name_en": "Pastry & baking", "name_fr": "Pâtisserie"},
        ]
    },
    {
        "name_en": "Garden & Pool", "name_fr": "Jardinage et piscine",
        "subcategories": [
            {"name_en": "Lawn & hedges", "name_fr": "Tonte et taille"},
            {"name_en": "Garden design", "name_fr": "Aménagement paysager"},
            {"name_en": "Pool maintenance", "name_fr": "Entretien piscine"},
        ]
    },
]

with app.app_context():
    from sqlalchemy import inspect, text
    inspector = inspect(db.engine)
    cat_cols = [c['name'] for c in inspector.get_columns('service_categories')]
    sub_cols = [c['name'] for c in inspector.get_columns('service_subcategories')]

    if 'name_fr' not in cat_cols:
        db.session.execute(text('ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS name_fr VARCHAR(200)'))
    if 'name_en' not in cat_cols:
        db.session.execute(text('ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS name_en VARCHAR(200)'))
    if 'is_active' not in cat_cols:
        db.session.execute(text('ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true'))
    if 'name_fr' not in sub_cols:
        db.session.execute(text('ALTER TABLE service_subcategories ADD COLUMN IF NOT EXISTS name_fr VARCHAR(200)'))
    if 'name_en' not in sub_cols:
        db.session.execute(text('ALTER TABLE service_subcategories ADD COLUMN IF NOT EXISTS name_en VARCHAR(200)'))
    db.session.commit()

    # Deactivate all existing categories before upserting
    db.session.execute(text('UPDATE service_categories SET is_active = false'))
    db.session.commit()

    for cat_data in MVP_DATA:
        cat = ServiceCategory.query.filter_by(name=cat_data['name_en']).first()
        if not cat:
            cat = ServiceCategory(name=cat_data['name_en'])
            db.session.add(cat)
        cat.name = cat_data['name_en']
        if hasattr(cat, 'name_en'):
            setattr(cat, 'name_en', cat_data['name_en'])
        if hasattr(cat, 'name_fr'):
            setattr(cat, 'name_fr', cat_data['name_fr'])
        if hasattr(cat, 'is_active'):
            setattr(cat, 'is_active', True)
        db.session.flush()

        # Inline UPDATE for columns SQLAlchemy may not track dynamically
        db.session.execute(text(
            'UPDATE service_categories SET name_en=:en, name_fr=:fr, is_active=true WHERE id=:id'
        ), {'en': cat_data['name_en'], 'fr': cat_data['name_fr'], 'id': cat.id})

        for sub_data in cat_data['subcategories']:
            sub = ServiceSubcategory.query.filter_by(
                name=sub_data['name_en'], category_id=cat.id
            ).first()
            if not sub:
                sub = ServiceSubcategory(name=sub_data['name_en'], category_id=cat.id)
                db.session.add(sub)
            sub.name = sub_data['name_en']
            db.session.flush()

            db.session.execute(text(
                'UPDATE service_subcategories SET name_en=:en, name_fr=:fr WHERE id=:id'
            ), {'en': sub_data['name_en'], 'fr': sub_data['name_fr'], 'id': sub.id})

            # Create one Service per subcategory if none exists
            svc = Service.query.filter_by(subcategory_id=sub.id).first()
            if not svc:
                svc = Service(
                    name=sub_data['name_en'],
                    description='',
                    subcategory_id=sub.id,
                    is_active=True,
                    is_priority=False,
                    featured=False,
                    professional_required='',
                )
                db.session.add(svc)

    db.session.commit()

    # Verify
    cats = db.session.execute(text(
        "SELECT id, name, name_fr FROM service_categories WHERE is_active = true ORDER BY id"
    )).fetchall()
    print(f'Active categories: {len(cats)}')
    for c in cats:
        subs = ServiceSubcategory.query.filter_by(category_id=c.id).all()
        print(f'  [{c.id}] {c.name} / {c.name_fr}  ({len(subs)} subcategories)')
