# Monkey patch at the very top before any other imports
from gevent import monkey
monkey.patch_all()

import os
import sys
import logging
from flask import Flask, jsonify, render_template, request, redirect, url_for
from flask_cors import CORS
from flask_login import LoginManager, current_user
from flask_babel import Babel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from flask_socketio import SocketIO

# Local imports (inside app context to avoid circular import on test/migration runs)
from routes.socket_chat import create_socket_instance, socket_chat_bp

# Logging
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
        from blueprints.dashboard import dashboard
        logger.info("Modules imported successfully")
    except ImportError as e:
        logger.error(f"Import error: {e}")
        return None

    app = Flask(
        __name__,
        template_folder='templates',
        static_folder='static'
    )

    # Config
    app.config.update(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'dev-secret-key'),
        BABEL_DEFAULT_LOCALE='fr',
        TEMPLATES_AUTO_RELOAD=True,
        DEBUG=True
    )

    # Database Config
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        logger.error("DATABASE_URL is not set")
        return None

    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    app.config.update({
        'SQLALCHEMY_DATABASE_URI': db_url,
        'SQLALCHEMY_TRACK_MODIFICATIONS': False,
        'SQLALCHEMY_ENGINE_OPTIONS': {
            'pool_size': 10,
            'pool_recycle': 3600,
            'pool_pre_ping': True,
            'pool_timeout': 30,
        }
    })

    # Extensions
    db.init_app(app)
    CORS(app)
    babel = Babel(app)

    # Login manager
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id)) if user_id else None

    # Socket.IO
    socketio = SocketIO(
        app,
        async_mode='gevent',
        cors_allowed_origins="*",
        logger=True,
        engineio_logger=True,
    )
    create_socket_instance(socketio)

    # Blueprints
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(socket_chat_bp, url_prefix='/chat')

    for blueprint, prefix in all_blueprints:
        if blueprint.name not in ['auth', 'socket_chat']:
            app.register_blueprint(blueprint, url_prefix=prefix)

    app.register_blueprint(dashboard, url_prefix='/dashboard')

    @app.route('/')
    def home():
        if current_user.is_authenticated:
            if current_user.user_type == 'client':
                return redirect(url_for('client.dashboard'))
            return redirect(url_for('provider.dashboard'))

        try:
            featured_services = Service.query.filter_by(
                featured=True,
                available=True
            ).join(ServiceCategory, Service.category_id == ServiceCategory.id).limit(8).all()
            logger.info(f"Fetched {len(featured_services)} featured services")
        except SQLAlchemyError as e:
            logger.error(f"Failed to fetch featured services: {e}")
            featured_services = []

        testimonials = [
            {
                'name': 'Sarah M.',
                'image': url_for('static', filename='img/testimonials/user1.jpg'),
                'rating': 5,
                'comment': 'Excellent service! The booking process was seamless.'
            },
            {
                'name': 'John D.',
                'image': url_for('static', filename='img/testimonials/user2.jpg'),
                'rating': 5,
                'comment': 'Very reliable platform. Found a great handyman.'
            },
            {
                'name': 'Emma R.',
                'image': url_for('static', filename='img/testimonials/user3.jpg'),
                'rating': 4,
                'comment': 'Great experience overall. Will definitely use again!'
            }
        ]
        return render_template('index.html',
                               featured_services=featured_services,
                               testimonials=testimonials)

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
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Running server on port {port}")
    socketio.run(app, host='0.0.0.0', port=port)

