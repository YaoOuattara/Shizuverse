"""Migration validation utility to ensure proper ordering and dependencies."""
import logging
from collections import defaultdict
import os
from flask import current_app
from sqlalchemy import create_engine, inspect

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MigrationValidator:
    def __init__(self, migrations_dir="migrations/versions"):
        self.migrations_dir = migrations_dir
        self.migration_chain = defaultdict(str)

    def validate_tables(self):
        try:
            engine = create_engine(current_app.config['SQLALCHEMY_DATABASE_URI'])
            inspector = inspect(engine)

            required = {
                'user': {'id', 'email', 'password_hash'},
                'role': {'id', 'name'},
                'roles_users': {'user_id', 'role_id'}
            }

            for table, fields in required.items():
                if not inspector.has_table(table):
                    return False
                cols = {col['name'] for col in inspector.get_columns(table)}
                if not fields.issubset(cols):
                    return False

            return True
        except Exception as e:
            logger.error(f"Validation failed: {e}")
            return False
