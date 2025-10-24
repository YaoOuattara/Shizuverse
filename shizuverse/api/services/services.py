from flask import Blueprint, request, jsonify
from shizuverse.models import db
from shizuverse.models.service_models import Service

services_bp = Blueprint('services', __name__)

@services_bp.route('/', methods=['POST'])
def create_service():
    data = request.json
    new_service = Service(
        provider_id=data['provider_id'],
        description=data.get('description'),
        price_range=data.get('price_range'),
        category_id=data.get('category_id')
    )
    db.session.add(new_service)
    db.session.commit()
    return jsonify({"id": new_service.id}), 201

