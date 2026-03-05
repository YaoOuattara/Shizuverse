# shizuverse/api/services.py

from flask import Blueprint, request, jsonify
from shizuverse.models import db, Service, ServiceSubcategory, ServiceCategory

services_bp = Blueprint("services_api", __name__)

def _svc(s: Service):
    sub = s.subcategory
    cat = sub.category if sub else None
    return {
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "professional_required": s.professional_required,
        "is_active": s.is_active,
        "is_priority": s.is_priority,
        "featured": s.featured,
        "subcategory": sub.name if sub else None,
        "category": cat.name if cat else None,
    }

@services_bp.route("/", methods=["GET"])
def list_services():
    q = Service.query

    # featured filter
    feat = request.args.get("featured")
    if feat is not None:
        val = feat.lower() in {"1","true","yes"}
        q = q.filter(Service.featured == val)

    # include_inactive=false by default
    if request.args.get("include_inactive", "false").lower() not in {"1","true","yes"}:
        q = q.filter(Service.is_active.is_(True))

    q = (
        q.join(ServiceSubcategory, Service.subcategory_id == ServiceSubcategory.id)
         .join(ServiceCategory, ServiceSubcategory.category_id == ServiceCategory.id)
         .order_by(Service.is_priority.desc(), Service.id.asc())
    )
    items = [_svc(s) for s in q.all()]
    return jsonify({"count": len(items), "items": items})
