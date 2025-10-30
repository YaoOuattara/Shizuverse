from datetime import datetime
from shizuverse.models import db

class ServiceProvider(db.Model):
    """
    Association model for a many-to-many between users and services.
    One user can offer many services; one service can be offered by many users.
    """
    __tablename__ = "service_providers"
    __table_args__ = (
        db.UniqueConstraint("user_id", "service_id", name="uq_service_providers_user_service"),
    )

    id = db.Column(db.Integer, primary_key=True)

    # Real FKs so SQLAlchemy can build relationships
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"), nullable=False, index=True)

    # Optional provider profile fields
    company_name = db.Column(db.String(120))
    phone_number = db.Column(db.String(20))
    address = db.Column(db.String(255))
    bio = db.Column(db.Text)
    profile_picture = db.Column(db.String(255))
    verified = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Light, directional relationships. Full M2M is declared on User.services
    user = db.relationship(
        "User",
        backref=db.backref("service_provider_links", cascade="all, delete-orphan")
    )
    service = db.relationship(
        "Service",
        backref=db.backref("provider_links", cascade="all, delete-orphan")
    )

    def __repr__(self) -> str:
        return f"<ServiceProvider user_id={self.user_id} service_id={self.service_id}>"
