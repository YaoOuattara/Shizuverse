from flask import Blueprint, request, jsonify
from shizuverse.models import db, Service, ServiceSubcategory, ServiceCategory
from .controller import appointments_payload

services_bp = Blueprint("services", __name__)

def _svc_to_dict(s: Service):
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

    # featured=true|false
    feat = request.args.get("featured")
    if feat is not None:
        val = feat.lower() in {"1", "true", "yes"}
        q = q.filter(Service.featured == val)

    # only active by default unless include_inactive=true
    if request.args.get("include_inactive", "false").lower() not in {"1", "true", "yes"}:
        q = q.filter(Service.is_active.is_(True))

    # eager-ish join for names & stable sort
    q = (
        q.join(ServiceSubcategory, Service.subcategory_id == ServiceSubcategory.id)
         .join(ServiceCategory, ServiceSubcategory.category_id == ServiceCategory.id)
         .order_by(Service.is_priority.desc(), Service.id.asc())
    )

    items = [_svc_to_dict(s) for s in q.all()]
    return jsonify({"count": len(items), "items": items})

@services_bp.route("/categories", methods=["GET"])
def list_categories():
    from sqlalchemy import inspect as sa_inspect, text
    inspector = sa_inspect(db.engine)
    cat_cols = {c['name'] for c in inspector.get_columns('service_categories')}
    sub_cols = {c['name'] for c in inspector.get_columns('service_subcategories')}

    q = ServiceCategory.query
    if 'is_active' in cat_cols:
        q = q.filter(text('is_active = true'))
    cats = q.order_by(ServiceCategory.id).all()

    result = []
    for c in cats:
        subs = ServiceSubcategory.query.filter_by(category_id=c.id).all()
        sub_list = []
        for s in subs:
            svc = Service.query.filter_by(subcategory_id=s.id, is_active=True).first()
            sub_list.append({
                "id": s.id,
                "name": s.name,
                "name_fr": db.session.execute(
                    text("SELECT name_fr FROM service_subcategories WHERE id=:id"), {"id": s.id}
                ).scalar() if 'name_fr' in sub_cols else s.name,
                "name_en": db.session.execute(
                    text("SELECT name_en FROM service_subcategories WHERE id=:id"), {"id": s.id}
                ).scalar() if 'name_en' in sub_cols else s.name,
                "service_id": svc.id if svc else None,
            })
        result.append({
            "id": c.id,
            "name": c.name,
            "name_fr": db.session.execute(
                text("SELECT name_fr FROM service_categories WHERE id=:id"), {"id": c.id}
            ).scalar() if 'name_fr' in cat_cols else c.name,
            "name_en": db.session.execute(
                text("SELECT name_en FROM service_categories WHERE id=:id"), {"id": c.id}
            ).scalar() if 'name_en' in cat_cols else c.name,
            "description": c.description or "",
            "subcategories": sub_list,
        })
    return jsonify(result)


@services_bp.route("/appointments/", methods=["GET"])
def list_appointments():
    return jsonify(appointments_payload())

