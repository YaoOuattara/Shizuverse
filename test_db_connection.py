import psycopg2
import os

DATABASE_URL = "postgresql://neondb_owner:npg_SqFb7WtOIkg8@ep-green-sun-a55chftc-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

try:
    conn = psycopg2.connect(DATABASE_URL)
    print("✅ Connection to Neon DB succeeded!")
    conn.close()
except Exception as e:
    print("❌ Failed to connect to the database:")
    print(e)

