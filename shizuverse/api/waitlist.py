from flask import Blueprint, request, jsonify
from shizuverse.models import db
from shizuverse.models.waitlist import Waitlist

waitlist_bp = Blueprint("waitlist", __name__)


@waitlist_bp.route("", methods=["POST"])
def join_waitlist():
    data    = request.get_json(silent=True) or {}
    commune = (data.get("commune") or "").strip()
    phone   = (data.get("phone") or "").strip()

    if not commune or not phone:
        return jsonify({"error": "commune and phone are required"}), 400

    entry = Waitlist(commune=commune, phone=phone)
    db.session.add(entry)
    db.session.commit()
    return jsonify({"success": True, "id": entry.id}), 201
