# models/service_models.py

from .db import db


class ServiceCategory(db.Model):
    __tablename__ = 'service_categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(255))

    subcategories = db.relationship('ServiceSubcategory', backref='category', cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ServiceCategory {self.name}>"


class ServiceSubcategory(db.Model):
    __tablename__ = 'service_subcategories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)

    category_id = db.Column(db.Integer, db.ForeignKey('service_categories.id'), nullable=False)
    services = db.relationship('Service', backref='subcategory', cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ServiceSubcategory {self.name}>"


class Service(db.Model):
    __tablename__ = 'services'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    professional_required = db.Column(db.String(100), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    is_priority = db.Column(db.Boolean, default=False)

    subcategory_id = db.Column(db.Integer, db.ForeignKey('service_subcategories.id'), nullable=False)

    # ✅ Properly declared FK to ServiceProvider
    provider_id = db.Column(db.Integer, db.ForeignKey("service_providers.id"), nullable=True)

    def __repr__(self):
        return f"<Service {self.name}>"

# ✅ Import to make sure relationships resolve at migration/runtime
from models.service_provider import ServiceProvider
