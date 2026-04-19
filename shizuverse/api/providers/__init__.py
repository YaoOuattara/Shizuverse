from flask import Blueprint

users_bp = Blueprint('providers', __name__)

@users_bp.route('/', methods=['GET'])
def index():
    return {"message": "Providers service is active"}

