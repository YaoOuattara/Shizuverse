from flask import jsonify
from shizuverse.models.service_models import Service
from shizuverse.api.services.services import services_bp  # re-export for app blueprint registration

def get_appointments():
    services = Service.query.limit(10).all()
    return jsonify({
        "services": [
            {
                "id": service.id,
                "title": service.title,
                "category": service.category.name if service.category else None,
                "available": service.available
            }
            for service in services
        ]
    })

