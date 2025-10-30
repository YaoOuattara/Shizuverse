# shizuverse/app.py
import os
import logging
from dotenv import load_dotenv

# ── Load .env locally (Render injects env vars) ────────────────────────────────
if os.getenv("RENDER") is None:
    load_dotenv()
    logging.info("Loaded local .env file")
else:
    logging.info("Running on Render — skipping .env loading")

# ── Resolve DATABASE_URL ───────────────────────────────────────────────────────
ENV = os.getenv("ENV", "local")
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = os.getenv("REMOTE_DATABASE_URL") if ENV == "production" else os.getenv("LOCAL_DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

# Normalize scheme for SQLAlchemy
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Export so Flask/SQLAlchemy pick it up uniformly
os.environ["DATABASE_URL"] = DATABASE_URL

# ── Gevent monkey patch early (for SocketIO) ───────────────────────────────────
from gevent import monkey  # noqa: E402
monkey.patch_all()

# ── Flask stack imports ────────────────────────────────────────────────────────
from flask import Flask, render_template, redirect, url_for  # noqa: E402
from flask_cors import CORS  # noqa: E402
from flask_login import LoginManager, current_user  # noqa: E402
from flask_babel import Babel  # noqa: E402
from sqlalchemy import text, inspect  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402
from flask_socketio import SocketIO  # noqa: E402
from flask_migrate import Migrate  # noqa: E402
from flasgger import Swagger  # noqa: E402

# ── Local modules (package-absolute imports) ───────────────────────────────────
from shizuverse.models import db, User  # noqa: E402
from shizuverse.models.service_models import Service, ServiceCategory, ServiceSubcategory  # noqa: E402
from shizuverse.routes.socket_chat import create_socket_instance, socket_chat_bp  # noqa: E402
from shizuverse.api import api_bp as api_blueprint  # noqa: E402
from shizuverse.routes import all_blueprints, auth_bp  # noqa: E402

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s",
)
logger = logging.getLogger(__name__)


def create_app():
    """Application factory that returns (app, socketio)."""
    app = Flask(__name__, template_folder="templates", static_folder="static")
    Swagger(app)

    # Core config
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-key")
    app.config["BABEL_DEFAULT_LOCALE"] = os.getenv("BABEL_DEFAULT_LOCALE", "fr")
    app.config["TEMPLATES_AUTO_RELOAD"] = True
    app.config["DEBUG"] = os.getenv("DEBUG", "True") == "True"

    # Database
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_size": 10,
        "pool_recycle": 3600,
        "pool_pre_ping": True,
        "pool_timeout": 30,
    }

    # Init extensions
    db.init_app(app)
    Migrate(app, db)
    CORS(app)
    Babel(app)

    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id)) if user_id else None

    socketio = SocketIO(app, async_mode="gevent", cors_allowed_origins="*", logger=True, engineio_logger=True)
    create_socket_instance(socketio)

    # Blueprints
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(socket_chat_bp, url_prefix="/chat")
    app.register_blueprint(api_blueprint, url_prefix="/api")
    for blueprint, prefix in all_blueprints:
        if blueprint.name not in ["auth", "socket_chat"]:
            app.register_blueprint(blueprint, url_prefix=prefix)

    # ── Routes ────────────────────────────────────────────────────────────────
    @app.route("/")
    def home():
        if current_user.is_authenticated:
            return redirect(url_for(f"{current_user.user_type}.dashboard"))

        try:
            # Simple & safe featured query
            featured_services = (
                Service.query.filter_by(featured=True, is_active=True)
                .join(ServiceSubcategory, Service.subcategory_id == ServiceSubcategory.id)
                .join(ServiceCategory, ServiceSubcategory.category_id == ServiceCategory.id)
                .limit(8)
                .all()
            )
            logger.info("Fetched %d featured services", len(featured_services))
        except SQLAlchemyError as e:
            logger.error("Failed to fetch featured services: %s", e)
            featured_services = []

        testimonials = [
            {"name": "Sarah M.", "image": url_for("static", filename="img/testimonials/user1.jpg"), "rating": 5,
             "comment": "Excellent service! The booking process was seamless."},
            {"name": "John D.", "image": url_for("static", filename="img/testimonials/user2.jpg"), "rating": 5,
             "comment": "Very reliable platform. Found a great handyman."},
            {"name": "Emma R.", "image": url_for("static", filename="img/testimonials/user3.jpg"), "rating": 4,
             "comment": "Great experience overall. Will definitely use again!"},
        ]
        return render_template("index.html", featured_services=featured_services, testimonials=testimonials)

    @app.route("/health")
    def health():
        try:
            db.session.execute(text("SELECT 1"))
            db.session.commit()
            return {"status": "healthy", "database": "connected"}
        except Exception as e:
            logger.error("Health check failed: %s", e)
            return {"status": "unhealthy", "error": str(e)}, 500

    @app.route("/diag/schema")
    def diag_schema():
        """Quick check to confirm 'services' table columns on this DB."""
        try:
            insp = inspect(db.engine)
            cols = [c["name"] for c in insp.get_columns("services")]
            return {"service_columns": cols}
        except Exception as e:
            return {"error": str(e)}, 500

    return app, socketio


# ── Create once and export for Gunicorn & CLI ──────────────────────────────────
_app, _socketio = create_app()
app = _app  # Gunicorn entrypoint: shizuverse.app:app

def create_app_flask_app():
    """Flask CLI factory: --app shizuverse.app:create_app_flask_app"""
    return _app


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    _socketio.run(_app, host="0.0.0.0", port=port, debug=True)
