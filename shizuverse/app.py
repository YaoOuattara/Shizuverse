# shizuverse/app.py
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
import logging

# Load .env only when NOT on Render
if os.getenv("RENDER") is None:
    load_dotenv()
    logging.info("Loaded local .env file")
else:
    logging.info("Running on Render — skipping .env loading")

# ---- Resolve DB URL (with fallback) ----
ENV = os.getenv("ENV", "local")  # NOTE: key is ENV (all caps)
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    if ENV == "production":
        DATABASE_URL = os.getenv("REMOTE_DATABASE_URL")
    else:
        DATABASE_URL = os.getenv("LOCAL_DATABASE_URL")

if not DATABASE_URL:
    logging.error("DATABASE_URL is not set")
    raise SystemExit(1)

# Normalize postgres scheme
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Expose for SQLAlchemy
os.environ["DATABASE_URL"] = DATABASE_URL

# ---- gevent patch early ----
from gevent import monkey
monkey.patch_all()

# ---- Imports ----
from flask import Flask, jsonify, render_template, request, redirect, url_for
from flask_cors import CORS
from flask_login import LoginManager, current_user
from flask_babel import Babel
from sqlalchemy import text, inspect
from sqlalchemy.exc import SQLAlchemyError
from flask_socketio import SocketIO
from flask_migrate import Migrate
from flasgger import Swagger

# Local modules
from routes.socket_chat import create_socket_instance, socket_chat_bp
from api import api_bp as api_blueprint

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s",
)
logger = logging.getLogger(__name__)


def create_app():
    logger.info("Starting Flask app creation")

    try:
        # IMPORTANT: import the models that define 'featured' from service_models
        from models import db
        from models import User  # noqa
        from models import Service, ServiceCategory, ServiceSubcategory  # noqa
        from routes import all_blueprints, auth_bp
        logger.info("Modules imported successfully")
    except Exception as e:
        logger.exception("Import error while creating app")
        return None

    app = Flask(__name__, template_folder="templates", static_folder="static")

    # Swagger (served at /apidocs)
    Swagger(app)

    # ---- Flask config ----
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-key")
    app.config["BABEL_DEFAULT_LOCALE"] = os.getenv("BABEL_DEFAULT_LOCALE", "fr")
    app.config["TEMPLATES_AUTO_RELOAD"] = True
    app.config["DEBUG"] = os.getenv("DEBUG", "True") == "True"

    # ---- Database ---
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_size": 10,
        "pool_recycle": 3600,
        "pool_pre_ping": True,
        "pool_timeout": 30,
    }

    # ---- Init extensions ----
    db.init_app(app)
    Migrate(app, db)
    CORS(app)
    Babel(app)

    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"

    @login_manager.user_loader
    def load_user(user_id):
        from models import User as _User  # local import to avoid circulars
        return _User.query.get(int(user_id)) if user_id else None

    socketio = SocketIO(app, async_mode="gevent", cors_allowed_origins="*", logger=True, engineio_logger=True)
    create_socket_instance(socketio)

    # ---- Blueprints ----
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(socket_chat_bp, url_prefix="/chat")
    app.register_blueprint(api_blueprint, url_prefix="/api")

    for blueprint, prefix in all_blueprints:
        if blueprint.name not in ["auth", "socket_chat"]:
            app.register_blueprint(blueprint, url_prefix=prefix)

    # ---- Routes ----
    @app.route("/")
    def home():
        """Simple landing page. Grabs featured services if available."""
        if current_user.is_authenticated:
            return redirect(url_for(f"{current_user.user_type}.dashboard"))

        try:
            # IMPORTANT:
            #   - our Service model now has: featured (bool) and is_active (bool)
            #   - the category is reached via Service.subcategory -> ServiceCategory
            from models import Service, ServiceCategory, ServiceSubcategory

            q = (
                Service.query.filter_by(featured=True, is_active=True)
                .join(ServiceSubcategory, Service.subcategory_id == ServiceSubcategory.id)
                .join(ServiceCategory, ServiceSubcategory.category_id == ServiceCategory.id)
                .limit(8)
            )
            featured_services = q.all()
            logger.info("Fetched %d featured services", len(featured_services))
        except SQLAlchemyError as e:
            logger.error("Failed to fetch featured services: %s", e)
            featured_services = []

        testimonials = [
            {
                "name": "Sarah M.",
                "image": url_for("static", filename="img/testimonials/user1.jpg"),
                "rating": 5,
                "comment": "Excellent service! The booking process was seamless.",
            },
            {
                "name": "John D.",
                "image": url_for("static", filename="img/testimonials/user2.jpg"),
                "rating": 5,
                "comment": "Very reliable platform. Found a great handyman.",
            },
            {
                "name": "Emma R.",
                "image": url_for("static", filename="img/testimonials/user3.jpg"),
                "rating": 4,
                "comment": "Great experience overall. Will definitely use again!",
            },
        ]
        return render_template("index.html", featured_services=featured_services, testimonials=testimonials)

    @app.route("/health")
    def health():
        """Checks DB connectivity; returns JSON."""
        try:
            from models import db as _db
            _db.session.execute(text("SELECT 1"))
            _db.session.commit()
            return {"status": "healthy", "database": "connected"}
        except Exception as e:
            logger.error("Health check failed: %s", e)
            return {"status": "unhealthy", "error": str(e)}, 500

    @app.route("/diag/schema")
    def diag_schema():
        """Small diagnostic: lists service table columns (helps confirm 'featured')."""
        try:
            from models import db as _db
            insp = inspect(_db.engine)
            cols = [c["name"] for c in insp.get_columns("services")]
            return {"service_columns": cols}
        except Exception as e:
            return {"error": str(e)}, 500

    return app, socketio


if __name__ == "__main__":
    result = create_app()
    if not result:
        logger.error("App failed to initialize")
        raise SystemExit(1)
    app, socketio = result
    port = int(os.environ.get("PORT", 5050))
    logger.info("Running server on port %s", port)
    socketio.run(app, host="0.0.0.0", port=port, debug=True)
else:
    # Gunicorn import path
    result = create_app()
    if not result:
        raise RuntimeError("Flask app failed to initialize on import.")
    app, socketio = result


# For Flask CLI (e.g. flask db upgrade)
def create_app_flask_app():
    app, _ = create_app()
    return app






# --- inside create_app() ---
try:
    # ✅ absolute imports from the package so metadata is populated
    from shizuverse.models import User, db, Service, ServiceCategory
    from routes import all_blueprints, auth_bp
    logger.info("Modules imported successfully")
except ImportError as e:
    logger.error(f"Import error: {e}")
    return None
