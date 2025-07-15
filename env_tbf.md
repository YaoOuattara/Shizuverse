
# OpenAI API
OPENAI_API_KEY=your-openai-api-key

# Babel default locale
BABEL_DEFAULT_LOCALE=fr

# Toggle between environments
ENV=local  # or set to 'production' when ready

# Local DB (used when ENV=local)
LOCAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/shizu_db

# Remote Neon DB (used when ENV=production)
REMOTE_DATABASE_URL=postgresql://neondb_owner:npg_SqFb7WtOIkg8@ep-green-sun-a55chftc-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Flask settings
SECRET_KEY=your-secret-key
DEBUG=True
FLASK_APP=app.py
