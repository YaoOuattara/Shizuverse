#!/bin/zsh

echo "🔄 Bootstrapping Shizu backend..."

# 1. Activate virtual environment
source venv/bin/activate

# 1b. Add current directory to Python path
export PYTHONPATH=$(pwd):$PYTHONPATH

# 2. Load environment variables
if [ -f .env ]; then
    eval $(grep -v '^#' .env | grep -v '^$' | xargs)
    echo "✅ .env variables loaded."
else
    echo "❌ .env file not found!"
    exit 1
fi

# 3. Set up Flask environment
export FLASK_APP=app:create_app_flask_app
export FLASK_ENV=development

# 4. Run migrations
flask db init 2>/dev/null || echo "📦 Migrations already initialized"
flask db migrate -m "Initial migration"
flask db upgrade

# 5. Launch app
echo "🚀 Launching Shizu app on http://localhost:5050 ..."
python app.py

