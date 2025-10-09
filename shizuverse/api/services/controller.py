from flask import jsonify
from shizuverse.models.service import Service

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
