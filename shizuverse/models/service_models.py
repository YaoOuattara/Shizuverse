# shizuverse/models/service_models.py
from shizuverse.models import db


class ServiceCategory(db.Model):
    __tablename__ = "service_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(255))

    subcategories = db.relationship(
        "ServiceSubcategory",
        backref="category",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ServiceCategory {self.name}>"


class ServiceSubcategory(db.Model):
    __tablename__ = "service_subcategories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)

    category_id = db.Column(db.Integer, db.ForeignKey("service_categories.id"), nullable=False)

    services = db.relationship(
        "Service",
        backref="subcategory",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ServiceSubcategory {self.name}>"


class Service(db.Model):
    __tablename__ = "services"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text)
    professional_required = db.Column(db.String(100))

    # Flags used by API/homepage logic
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    is_priority = db.Column(db.Boolean, default=False, nullable=False, index=True)
    featured = db.Column(db.Boolean, default=False, nullable=False, index=True)

    # Indicative base price in XOF (FCFA)
    base_price = db.Column(db.Integer, nullable=True)

    # Classification
    subcategory_id = db.Column(db.Integer, db.ForeignKey("service_subcategories.id"), nullable=False)

    def __repr__(self) -> str:
        return f"<Service {self.name}>"
