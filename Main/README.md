# Main Entrypoint: `main.py`

## Purpose
Starts the Shizu backend Flask server. This script ensures:
- Flask-SocketIO is correctly initialized.
- Logging is captured from the start.
- The app runs in either dev or production mode depending on configuration.

## Key Responsibilities
- Import `create_app` from `app.py`.
- Launch the app with `socketio.run()`.
- Use environment variables for dynamic port configuration.

## Run Command
```bash
python3 main.py
