# wsgi.py

from app import create_app

app, _ = create_app()  # only get the Flask app, ignore socketio
