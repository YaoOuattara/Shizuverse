#!/usr/bin/env python3
"""Vérification manuelle de la connexion à la base — aucun secret en dur.

Ce fichier a porté l'URL Neon COMPLÈTE (identifiant + mot de passe) en clair,
committée dans a8d27a1 le 2025-07-15 et poussée sur origin/main comme sur
origin/staging. Les identifiants sont donc à considérer compromis et à faire
tourner depuis la console Neon : les retirer d'ici ne les retire PAS de
l'historique git, où ils restent lisibles par quiconque a accès au dépôt.

La lecture suit la même convention que shizuverse/app.py : DATABASE_URL, sinon
REMOTE_DATABASE_URL / LOCAL_DATABASE_URL selon ENV. Rien n'est deviné et rien
n'a de valeur par défaut — sans variable, on sort en erreur plutôt que de
tenter une connexion silencieuse vers on ne sait quoi.

Usage :
    python test_db_connection.py
"""
import os
import sys

from dotenv import load_dotenv

load_dotenv()

ENV = os.getenv("ENV", "local")
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = (os.getenv("REMOTE_DATABASE_URL") if ENV == "production"
                    else os.getenv("LOCAL_DATABASE_URL"))

if not DATABASE_URL:
    print("❌ Aucune URL de base : posez DATABASE_URL (ou LOCAL_DATABASE_URL / "
          "REMOTE_DATABASE_URL selon ENV) dans votre .env.")
    sys.exit(2)

import psycopg2

try:
    conn = psycopg2.connect(DATABASE_URL)
    # On n'affiche JAMAIS DATABASE_URL : elle porte le mot de passe. Le nom de
    # la base et l'utilisateur suffisent à confirmer qu'on a joint la bonne.
    with conn.cursor() as cur:
        cur.execute("SELECT current_database(), current_user")
        database, user = cur.fetchone()
    conn.close()
    print(f"✅ Connexion réussie — base « {database} », utilisateur « {user} ».")
except Exception as e:
    print("❌ Échec de la connexion à la base :")
    print(e)
    sys.exit(1)
