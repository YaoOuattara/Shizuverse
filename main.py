#!/usr/bin/env python3
"""
Main entry point for the Shizu Flask application
Handles environment-based setup and starts the dev server
"""

import os
import logging
from datetime import datetime
from app import create_app

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create the application instance
app_socket = create_app()

if not app_socket:
    logger.error("Application failed to initialize.")
    exit(1)

app, socketio = app_socket

if __name__ == "__main__":
    try:
        port = int(os.environ.get('PORT', 3000))
        logger.info(f"Starting development server on port {port}")
        socketio.run(
            app,
            host='0.0.0.0',
            port=port,
            debug=app.config.get("DEBUG", False)
        )
    except Exception as e:
        logger.exception(f"Error starting server: {str(e)}")
        raise

