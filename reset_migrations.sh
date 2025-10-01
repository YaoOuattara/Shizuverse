#!/bin/bash

echo "🚨 Starting full Flask-Migrate environment reset..."

# Step 1: Clean Python + Alembic cache
echo "🧹 Deleting old virtual environment, pyc files, and __pycache__..."
deactivate 2>/dev/null || true
rm -rf venv
find . -name "*.pyc" -delete
find . -name "__pycache__" -type d -exec rm -rf {} +

# Step 2: Delete migrations (including bad revision refs)
echo "🗑 Removing existing Alembic migrations..."
rm -rf migrations

# Step 3: Rebuild virtualenv
echo "🛠 Recreating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Step 4: Reinstall dependencies
echo "📦 Installing requirements..."
pip install -r requirements.txt

# Step 5: Export environment variables from .env
echo "🌍 Loading environment variables from .env..."
set -a
source .env
set +a

# Step 6: Initialize migrations
echo "📁 Initializing fresh migrations folder..."
flask db init

# Step 7: Autogenerate new migration (NO custom --rev-id)
echo "🔍 Detecting model changes..."
flask db migrate -m "Initial migration"

# Step 8: Apply migration
echo "🚀 Applying migration to DB..."
flask db upgrade

echo "✅ Done. Flask-Migrate environment reset complete."

