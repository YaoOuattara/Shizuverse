from flask import Blueprint, request, jsonify
from sqlalchemy.orm import contains_eager
from sqlalchemy import text, inspect as sa_inspect
from shizuverse.models import db, Service, ServiceSubcategory, ServiceCategory

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
    # Explicit JOINs + contains_eager populates relationships without extra queries
    q = (
        Service.query
        .join(ServiceSubcategory, Service.subcategory_id == ServiceSubcategory.id)
        .join(ServiceCategory, ServiceSubcategory.category_id == ServiceCategory.id)
        .options(
            contains_eager(Service.subcategory)
            .contains_eager(ServiceSubcategory.category)
        )
    )

    feat = request.args.get("featured")
    if feat is not None:
        q = q.filter(Service.featured == (feat.lower() in {"1", "true", "yes"}))

    if request.args.get("include_inactive", "false").lower() not in {"1", "true", "yes"}:
        q = q.filter(Service.is_active.is_(True))

    q = q.order_by(Service.is_priority.desc(), Service.id.asc())
    items = [_svc_to_dict(s) for s in q.all()]
    return jsonify({"count": len(items), "items": items})


@services_bp.route("/categories", methods=["GET"])
def list_categories():
    inspector = sa_inspect(db.engine)
    cat_cols = {c['name'] for c in inspector.get_columns('service_categories')}
    sub_cols = {c['name'] for c in inspector.get_columns('service_subcategories')}

    # Column expressions — fall back to .name if i18n columns absent
    cat_fr = "sc.name_fr" if 'name_fr' in cat_cols else "sc.name"
    cat_en = "sc.name_en" if 'name_en' in cat_cols else "sc.name"
    sub_fr = "ss.name_fr" if 'name_fr' in sub_cols else "ss.name"
    sub_en = "ss.name_en" if 'name_en' in sub_cols else "ss.name"
    active_clause = "AND sc.is_active = true" if 'is_active' in cat_cols else ""

    # Single query: all categories + subcategories + one service_id per subcategory
    rows = db.session.execute(text(f"""
        SELECT
            sc.id          AS cat_id,
            sc.name        AS cat_name,
            {cat_fr}       AS cat_name_fr,
            {cat_en}       AS cat_name_en,
            sc.description AS cat_desc,
            ss.id          AS sub_id,
            ss.name        AS sub_name,
            {sub_fr}       AS sub_name_fr,
            {sub_en}       AS sub_name_en,
            MIN(svc.id)    AS service_id
        FROM service_categories sc
        LEFT JOIN service_subcategories ss ON ss.category_id = sc.id
        LEFT JOIN services svc
               ON svc.subcategory_id = ss.id AND svc.is_active = true
        WHERE 1=1 {active_clause}
        GROUP BY sc.id, sc.name, {cat_fr}, {cat_en}, sc.description,
                 ss.id, ss.name, {sub_fr}, {sub_en}
        ORDER BY sc.id, ss.id
    """)).mappings().all()

    # Assemble nested structure from flat rows
    cats: dict = {}
    for row in rows:
        cid = row["cat_id"]
        if cid not in cats:
            cats[cid] = {
                "id": cid,
                "name": row["cat_name"],
                "name_fr": row["cat_name_fr"],
                "name_en": row["cat_name_en"],
                "description": row["cat_desc"] or "",
                "subcategories": [],
            }
        if row["sub_id"] is not None:
            cats[cid]["subcategories"].append({
                "id": row["sub_id"],
                "name": row["sub_name"],
                "name_fr": row["sub_name_fr"],
                "name_en": row["sub_name_en"],
                "service_id": row["service_id"],
            })

    return jsonify(list(cats.values()))
