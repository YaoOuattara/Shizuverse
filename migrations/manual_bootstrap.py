"""Manual DB initializer for Replit CLI or local dev"""
from flask import Flask
from flask_migrate import Migrate
from models import db

app = Flask(__name__)
app.config.from_mapping({
    "SQLALCHEMY_DATABASE_URI": "sqlite:///instance/shizu.sqlite",
    "SQLALCHEMY_TRACK_MODIFICATIONS": False,
    "SECRET_KEY": "dev"
})

db.init_app(app)
migrate = Migrate(app, db)

with app.app_context():
    db.create_all()
    print("Database initialized.")
