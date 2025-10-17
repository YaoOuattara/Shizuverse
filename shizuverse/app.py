import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# --- Top Level: Env Config ---
from dotenv import load_dotenv
import logging

# --- Smart environment loading ---
# Load .env ONLY when running locally. Render injects its own env vars.
if os.getenv("RENDER") is None:
    load_dotenv()
    logging.info("Loaded local .env file")
else:
    logging.info("Running on Render — skipping .env loading")

# --- Determine environment and pick the correct DB ---
ENV = os.getenv('ENV', 'local')

# Prefer Render's DATABASE_URL if available
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    # Fallback to local or remote .env-based vars if missing
    if ENV == 'production':
        DATABASE_URL = os.getenv('REMOTE_DATABASE_URL')
    else:
        DATABASE_URL = os.getenv('LOCAL_DATABASE_URL')

if not DATABASE_URL:
    logging.error("DATABASE_URL is not set")
    sys.exit(1)

# Normalize URI scheme if needed
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Set globally for SQLAlchemy and Flask
os.environ['DATABASE_URL'] = DATABASE_URL

# --- Gevent Monkey Patch Early ---
from gevent import monkey
monkey.patch_all()

# --- Imports ---
from flask import Flask, jsonify, render_template, request, redirect, url_for
from flask_cors import CORS
from flask_login import LoginManager, current_user
from flask_babel import Babel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from flask_socketio import SocketIO
from flask_migrate import Migrate
from flasgger import Swagger

# --- Local Modules ---
from routes.socket_chat import create_socket_instance, socket_chat_bp
from api import api_bp as api_blueprint

# --- Logging ---
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
)
logger = logging.getLogger(__name__)


def create_app():
    logger.info("Starting Flask app creation")

    try:
        from models import User, db, Service, ServiceCategory
        from routes import all_blueprints, auth_bp
        logger.info("Modules imported successfully")
    except ImportError as e:
        logger.error(f"Import error: {e}")
        return None

    app = Flask(__name__, template_folder='templates', static_folder='static')

    Swagger(app)

    # --- Flask Config ---
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    app.config['BABEL_DEFAULT_LOCALE'] = os.getenv('BABEL_DEFAULT_LOCALE', 'fr')
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    app.config['DEBUG'] = os.getenv('DEBUG', 'True') == 'True'

    # --- Database Config ---
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ['DATABASE_URL']
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_size': 10,
        'pool_recycle': 3600,
        'pool_pre_ping': True,
        'pool_timeout': 30,
    }

    # --- Init Extensions ---
    db.init_app(app)
    Migrate(app, db)
    CORS(app)
    Babel(app)

    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id)) if user_id else None

    socketio = SocketIO(app, async_mode='gevent', cors_allowed_origins="*", logger=True, engineio_logger=True)
    create_socket_instance(socketio)

    # --- Register Blueprints ---
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(socket_chat_bp, url_prefix='/chat')
    app.register_blueprint(api_blueprint, url_prefix='/api')

    for blueprint, prefix in all_blueprints:
        if blueprint.name not in ['auth', 'socket_chat']:
            app.register_blueprint(blueprint, url_prefix=prefix)

    # --- Routes ---
    @app.route('/')
    def home():
        if current_user.is_authenticated:
            return redirect(url_for(f'{current_user.user_type}.dashboard'))

        try:
            featured_services = Service.query.filter_by(featured=True, available=True).join(
                ServiceCategory, Service.category_id == ServiceCategory.id
            ).limit(8).all()
            logger.info(f"Fetched {len(featured_services)} featured services")
        except SQLAlchemyError as e:
            logger.error(f"Failed to fetch featured services: {e}")
            featured_services = []

        testimonials = [
            {'name': 'Sarah M.', 'image': url_for('static', filename='img/testimonials/user1.jpg'), 'rating': 5,
             'comment': 'Excellent service! The booking process was seamless.'},
            {'name': 'John D.', 'image': url_for('static', filename='img/testimonials/user2.jpg'), 'rating': 5,
             'comment': 'Very reliable platform. Found a great handyman.'},
            {'name': 'Emma R.', 'image': url_for('static', filename='img/testimonials/user3.jpg'), 'rating': 4,
             'comment': 'Great experience overall. Will definitely use again!'}
        ]
        return render_template('index.html', featured_services=featured_services, testimonials=testimonials)

    @app.route('/health')
    def health():
        try:
            db.session.execute(text('SELECT 1'))
            db.session.commit()
            return {'status': 'healthy', 'database': 'connected'}
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {'status': 'unhealthy', 'error': str(e)}, 500

    return app, socketio


if __name__ == '__main__':
    result = create_app()
    if not result:
        logger.error("App failed to initialize")
        sys.exit(1)

    app, socketio = result
    port = int(os.environ.get('PORT', 5050))
    logger.info(f"Running server on port {port}")
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
else:
    # ✅ Expose Flask app for Gunicorn (Render)
    result = create_app()
    if not result:
        raise RuntimeError("Flask app failed to initialize on import.")
    app, socketio = result


# For Flask CLI (e.g. flask db upgrade)
def create_app_flask_app():
    app, _ = create_app()
    return app
              
              
              
              
