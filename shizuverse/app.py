import os
import logging
from dotenv import load_dotenv

if os.getenv("RENDER") is None:
    load_dotenv()

ENV = os.getenv("ENV", "local")
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = os.getenv("REMOTE_DATABASE_URL") if ENV == "production" else os.getenv("LOCAL_DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

os.environ["DATABASE_URL"] = DATABASE_URL

from gevent import monkey
monkey.patch_all()

from flask import Flask, render_template, redirect, url_for
from flask_cors import CORS
from flask_login import LoginManager, current_user
from flask_babel import Babel
from sqlalchemy import text, inspect
from sqlalchemy.exc import SQLAlchemyError
from flask_socketio import SocketIO
from flask_migrate import Migrate
from flasgger import Swagger
from shizuverse.models import db, User
from shizuverse.models.service_models import Service, ServiceCategory, ServiceSubcategory
from shizuverse.routes.socket_chat import create_socket_instance, socket_chat_bp
from shizuverse.api import api_bp as api_blueprint
from shizuverse.routes import all_blueprints, auth_bp

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s")
logger = logging.getLogger(__name__)


def create_app():
    app = Flask(__name__, template_folder="templates", static_folder="static")
    Swagger(app)

    _secret = os.environ.get("SECRET_KEY", "")
    if os.getenv("ENV") == "production" and (not _secret or _secret == "dev-secret-key"):
        import sys
        print("FATAL: SECRET_KEY not set or using default. Refusing to start.", file=sys.stderr)
        sys.exit(1)
    app.config["SECRET_KEY"] = _secret or "dev-secret-key"

    # Admin auth is a single shared password (no admin row in DB). In production
    # it MUST be set explicitly — never fall back to a guessable default.
    if os.getenv("ENV") == "production" and not os.environ.get("ADMIN_PASSWORD"):
        import sys
        print("FATAL: ADMIN_PASSWORD not set. Refusing to start.", file=sys.stderr)
        sys.exit(1)
    app.config["SESSION_COOKIE_SECURE"] = True
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["BABEL_DEFAULT_LOCALE"] = os.getenv("BABEL_DEFAULT_LOCALE", "fr")
    app.config["TEMPLATES_AUTO_RELOAD"] = True
    app.config["DEBUG"] = os.getenv("DEBUG", "True") == "True"
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_size": 10, "pool_recycle": 3600, "pool_pre_ping": True, "pool_timeout": 30}

    db.init_app(app)
    Migrate(app, db)

    from flask_migrate import upgrade as flask_db_upgrade
    try:
        with app.app_context():
            flask_db_upgrade()
    except Exception as e:
        app.logger.error(f"Migration failed on startup: {e}")
        # App continues to start — existing schema still works

    # One-time: normalize any malformed phone_number values left by old double-prefix bug
    try:
        with app.app_context():
            from shizuverse.models.service_provider import ServiceProvider
            from shizuverse.api.admin import normalize_phone
            changed = 0
            for sp in ServiceProvider.query.all():
                if sp.phone_number:
                    normed = normalize_phone(sp.phone_number)
                    if normed != sp.phone_number:
                        sp.phone_number = normed
                        changed += 1
            if changed:
                db.session.commit()
                app.logger.info(f"[startup] Normalized {changed} ServiceProvider phone_number(s)")
    except Exception as e:
        app.logger.warning(f"[startup] Phone normalization skipped: {e}")

    # One-time: remove synthetic @shizu.ci emails from provider User records
    try:
        with app.app_context():
            cleaned = (
                User.query
                .filter(User.user_type == 'provider')
                .filter(User.email.like('%@shizu.ci'))
                .all()
            )
            for u in cleaned:
                u.email = None
            if cleaned:
                db.session.commit()
                app.logger.info(f"[startup] Cleared synthetic email from {len(cleaned)} provider User(s)")
    except Exception as e:
        app.logger.warning(f"[startup] Provider email cleanup skipped: {e}")
    _extra = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
    ALLOWED_ORIGINS = [
        "https://shizu.pro",
        "https://www.shizu.pro",
        "https://client-sigma-gilt.vercel.app",
        "https://client-git-frontend-yao-ouattaras-projects.vercel.app",
    ] + _extra
    if os.getenv("ENV") != "production":
        ALLOWED_ORIGINS += ["http://localhost:3000", "http://127.0.0.1:3000"]
    CORS(app, origins=ALLOWED_ORIGINS)
    Babel(app)

    from shizuverse.limiter import limiter
    limiter.init_app(app)

    @app.errorhandler(429)
    def ratelimit_handler(e):
        from flask import jsonify as _jsonify
        return _jsonify({"error": "Trop de tentatives. Réessayez dans quelques minutes."}), 429

    @app.errorhandler(500)
    def internal_error(e):
        app.logger.error(f"Internal server error: {e}", exc_info=True)
        from flask import jsonify as _jsonify
        return _jsonify({"error": "Internal server error"}), 500

    @app.errorhandler(404)
    def not_found(e):
        from flask import jsonify as _jsonify
        return _jsonify({"error": "Not found"}), 404

    @app.errorhandler(Exception)
    def unhandled_exception(e):
        app.logger.error(f"Unhandled exception: {e}", exc_info=True)
        from flask import jsonify as _jsonify
        return _jsonify({"error": "Internal server error"}), 500

    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id)) if user_id else None

    socketio = SocketIO(app, async_mode="gevent", cors_allowed_origins=ALLOWED_ORIGINS, logger=True, engineio_logger=True)
    create_socket_instance(socketio)

    # client/provider are legacy Replit server-rendered blueprints (Appointment
    # model + Jinja templates), unused by the Next.js frontend. Disabled here
    # (not deleted) — remove from this set to re-enable in one line.
    SKIP_NAMES = {"auth", "socket_chat", "chat", "client", "provider"}
    from shizuverse.routes.admin import admin_bp
    app.register_blueprint(admin_bp)
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(socket_chat_bp, url_prefix="/chat")
    app.register_blueprint(api_blueprint, url_prefix="/api")
    for blueprint, prefix in all_blueprints:
        if blueprint.name not in SKIP_NAMES:
            app.register_blueprint(blueprint, url_prefix=prefix)

    @app.route("/")
    def home():
        if current_user.is_authenticated:
            return redirect(url_for(f"{current_user.user_type}.dashboard"))
        try:
            featured_services = (
                Service.query.filter_by(featured=True, is_active=True)
                .join(ServiceSubcategory, Service.subcategory_id == ServiceSubcategory.id)
                .join(ServiceCategory, ServiceSubcategory.category_id == ServiceCategory.id)
                .limit(8).all()
            )
        except SQLAlchemyError as e:
            logger.error("Failed to fetch featured services: %s", e)
            featured_services = []
        testimonials = [
            {"name": "Sarah M.", "image": url_for("static", filename="img/testimonials/user1.jpg"), "rating": 5, "comment": "Excellent service!"},
            {"name": "John D.", "image": url_for("static", filename="img/testimonials/user2.jpg"), "rating": 5, "comment": "Very reliable platform."},
            {"name": "Emma R.", "image": url_for("static", filename="img/testimonials/user3.jpg"), "rating": 4, "comment": "Great experience overall."},
        ]
        return render_template("index.html", featured_services=featured_services, testimonials=testimonials)

    @app.route("/health")
    def health():
        try:
            db.session.execute(text("SELECT 1"))
            db.session.commit()
            return {"status": "healthy", "database": "connected"}
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}, 500

    @app.route("/diag/schema")
    def diag_schema():
        try:
            insp = inspect(db.engine)
            cols = [c["name"] for c in insp.get_columns("services")]
            return {"service_columns": cols}
        except Exception as e:
            return {"error": str(e)}, 500

    @app.route("/internal/anomalies/run", methods=["POST"])
    def internal_anomalies_run():
        """Cron-triggered anomaly check. Protected by a shared secret header
        (X-CRON-SECRET == env CRON_SECRET), NOT the admin JWT — an external
        pinger can't hold a short-lived token.

        Root-level route with no lazy warm-up: hitting it wakes a sleeping
        Render dyno and runs the full detect → alert → persist cycle.
        """
        import hmac
        import os as _os
        from flask import request as _request, jsonify as _jsonify

        secret = _os.environ.get("CRON_SECRET", "")
        provided = _request.headers.get("X-CRON-SECRET", "")
        if not secret or not hmac.compare_digest(provided, secret):
            return _jsonify({"error": "unauthorized"}), 401

        from shizuverse.utils.anomaly_detector import run_anomaly_check
        result = run_anomaly_check()
        return _jsonify({
            "detected": result.get("detected", 0),
            "alert_sent": result.get("alert_sent", False),
        })

    return app, socketio


_app, _socketio = create_app()
app = _app


def create_app_flask_app():
    return _app


# ── CLI command: flask --app shizuverse.app:app reset-cats ────────────────────

import click

_RESET_DATA = {
    19: {
        "label": "Elderly Care / Aide aux seniors",
        "entries": [
            ("Assistance à domicile",      "Home assistance"),
            ("Accompagnement seniors",     "Senior companionship"),
            ("Aide aux repas et hygiène",  "Meal and hygiene support"),
        ],
    },
    21: {
        "label": "Climatisation & Electromenager",
        "entries": [
            ("Installation de climatiseur",     "AC installation"),
            ("Entretien et nettoyage de clim",  "AC maintenance"),
            ("Réparation d'électroménager",     "Appliance repair"),
            ("Dépannage TV et électronique",    "TV and electronics repair"),
        ],
    },
}


@app.cli.command("reset-cats")
def reset_cats_command():
    """Delete and recreate subcategories/services for categories 19 and 21."""
    for category_id, data in _RESET_DATA.items():
        cat = ServiceCategory.query.get(category_id)
        if cat is None:
            click.echo(f"  SKIP  category id={category_id} — not found in DB")
            continue

        sub_ids = [
            s.id for s in ServiceSubcategory.query.filter_by(category_id=category_id).all()
        ]
        svc_deleted = 0
        if sub_ids:
            svc_deleted = Service.query.filter(
                Service.subcategory_id.in_(sub_ids)
            ).delete(synchronize_session="fetch")

        sub_deleted = ServiceSubcategory.query.filter_by(
            category_id=category_id
        ).delete(synchronize_session="fetch")
        db.session.flush()

        created = []
        for sub_name, svc_name in data["entries"]:
            sub = ServiceSubcategory(name=sub_name, category_id=category_id)
            db.session.add(sub)
            db.session.flush()

            svc = Service(
                name=svc_name,
                subcategory_id=sub.id,
                is_active=True,
                is_priority=False,
                featured=False,
                professional_required="",
            )
            db.session.add(svc)
            db.session.flush()
            created.append((sub.id, sub_name, svc.id, svc_name))

        db.session.commit()

        click.echo(
            f"  OK  id={category_id} ({data['label']}) — "
            f"deleted {svc_deleted} service(s), {sub_deleted} subcategory/ies; "
            f"recreated {len(created)}"
        )
        for sub_id, sub_name, svc_id, svc_name in created:
            click.echo(f"        sub_id={sub_id} '{sub_name}' → svc_id={svc_id} '{svc_name}'")

    click.echo("\n  --- Verification ---")
    for category_id in sorted(_RESET_DATA):
        cat = ServiceCategory.query.get(category_id)
        click.echo(f"\n  [category_id={category_id}] {cat.name if cat else 'NOT FOUND'}")
        for sub in ServiceSubcategory.query.filter_by(category_id=category_id).all():
            for svc in Service.query.filter_by(subcategory_id=sub.id).all():
                click.echo(
                    f"    sub_id={sub.id:<5} '{sub.name}'"
                    f"  →  svc_id={svc.id:<5} '{svc.name}'  is_active={svc.is_active}"
                )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    _socketio.run(_app, host="0.0.0.0", port=port, debug=True)
