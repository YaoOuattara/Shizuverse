# shizuverse/api/services.py

from flask import Blueprint, request, jsonify
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import or_

from shizuverse.models import db
from shizuverse.models.service_models import Service, ServiceCategory, ServiceSubcategory

services_bp = Blueprint("services", __name__)

def _base_query():
    # Start with active services only
    q = Service.query.filter(Service.is_active.is_(True))
    return q

@services_bp.route("/", methods=["GET"])
def list_services():
    """
    GET /api/services?featured=true&category=PLUMBING&q=leak&limit=50&offset=0
    """
    try:
        q = _base_query()

        # Optional: featured filter
        if request.args.get("featured") == "true" and hasattr(Service, "featured"):
            q = q.filter(Service.featured.is_(True))

        # Optional: category name (case-insensitive)
        category = request.args.get("category")
        if category:
            q = (
                q.join(ServiceSubcategory, Service.subcategory_id == ServiceSubcategory.id)
                 .join(ServiceCategory, ServiceSubcategory.category_id == ServiceCategory.id)
                 .filter(ServiceCategory.name.ilike(category))
            )

        # Optional: simple search across name/description
        search = request.args.get("q")
        if search:
            like = f"%{search}%"
            q = q.filter(or_(Service.name.ilike(like), Service.description.ilike(like)))

        # Pagination
        try:
            limit = max(1, min(int(request.args.get("limit", 50)), 100))
        except ValueError:
            limit = 50
        try:
            offset = max(0, int(request.args.get("offset", 0)))
        except ValueError:
            offset = 0

        items = q.offset(offset).limit(limit).all()

        return jsonify([
            {
                "id": s.id,
                "name": s.name,
                "description": s.description,
                "is_active": s.is_active,
                "featured": bool(getattr(s, "featured", False)),
                "subcategory_id": s.subcategory_id,
            }
            for s in items
        ]), 200

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Failed to list services", "detail": str(e)}), 500


@services_bp.route("/<int:service_id>", methods=["GET"])
def get_service(service_id: int):
    """
    GET /api/services/<id>
    """
    try:
        s = Service.query.get_or_404(service_id)
        return jsonify({
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "is_active": s.is_active,
            "featured": bool(getattr(s, "featured", False)),
            "subcategory_id": s.subcategory_id,
        }), 200
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": "Failed to fetch service", "detail": str(e)}), 500
