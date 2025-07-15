from flask import jsonify

def get_appointments():
    return jsonify({
        "appointments": [
            {"id": 1, "service": "Haircut", "time": "10:00AM"},
            {"id": 2, "service": "Massage", "time": "1:00PM"}
        ]
    })
