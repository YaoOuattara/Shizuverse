#!/usr/bin/env python3
"""
seed_prix_categories.py — applique les fourchettes de prix INDICATIVES sur
les catégories existantes (ServiceCategory), de façon idempotente.

- UPDATE only : ne crée jamais de catégorie, ne touche à rien d'autre.
- Résolution robuste par nom : matche sur name / name_en / name_fr
  (insensible à la casse) car ServiceCategory.name est en anglais et le
  français vit dans name_fr.
- Rejouable : réécrit les 3 champs à chaque exécution, résultat déterministe.
- Les catégories absentes de la DB sont signalées et sautées (pas d'erreur).

Ces prix sont l'AFFICHAGE indicatif ; ils ne contraignent jamais le
amount_xof verrouillé par l'admin.

Usage (Render shell ou local) :
    python scripts/seed_prix_categories.py
"""

from shizuverse.app import create_app
from shizuverse.models import db
from shizuverse.models.service_models import ServiceCategory

_result = create_app()
app = _result[0] if isinstance(_result, tuple) else _result


# Chaque cible : libellé lisible + candidats de match (lowercase, EN + FR) +
# le prix à appliquer. mode="range" | "floor" | "quote".
TARGETS = [
    {"label": "Ménage et nettoyage",            "match": ["cleaning", "ménage", "menage", "nettoyage"],
     "mode": "range", "price_min": 5000,  "price_max": 15000},
    {"label": "Jardinage et piscine",           "match": ["garden & pool", "garden", "jardinage", "piscine"],
     "mode": "range", "price_min": 10000, "price_max": 25000},
    {"label": "Garde d'enfants",                "match": ["childcare", "garde d'enfants", "garde d’enfants", "nounou", "baby"],
     "mode": "range", "price_min": 5000,  "price_max": 12000},
    {"label": "Beauté à domicile",              "match": ["beauty", "beauté", "beaute"],
     "mode": "range", "price_min": 5000,  "price_max": 20000},
    {"label": "Aide aux seniors",               "match": ["senior", "aide aux seniors", "seniors"],
     "mode": "range", "price_min": 10000, "price_max": 25000},
    {"label": "Plomberie",                      "match": ["plumbing", "plomberie"],
     "mode": "floor", "price_min": 10000, "price_max": None},
    {"label": "Électricité",                    "match": ["electrical", "électricité", "electricite", "electric"],
     "mode": "floor", "price_min": 15000, "price_max": None},
    {"label": "Bricolage & Réparations",        "match": ["handyman", "bricolage", "réparations", "reparations"],
     "mode": "quote"},
    {"label": "Climatisation & électroménager", "match": ["climatisation", "électroménager", "electromenager", "ac ", "hvac", "appliance"],
     "mode": "quote"},
    {"label": "Peinture & Rénovation",          "match": ["peinture", "rénovation", "renovation", "painting"],
     "mode": "quote"},
]


def _names(cat):
    vals = [cat.name]
    for attr in ("name_en", "name_fr"):
        v = getattr(cat, attr, None)
        if v:
            vals.append(v)
    return [v.lower() for v in vals if v]


def _resolve(cat, cats):
    """Retourne la catégorie dont un des noms matche un des candidats."""
    for c in cats:
        names = _names(c)
        for cand in cat["match"]:
            cand = cand.strip().lower()
            if any(cand in n or n in cand for n in names):
                return c
    return None


def main():
    with app.app_context():
        cats = ServiceCategory.query.all()
        applied, skipped = [], []

        for t in TARGETS:
            c = _resolve(t, cats)
            if c is None:
                skipped.append(t["label"])
                continue

            if t["mode"] == "quote":
                c.is_quote_based = True
                c.price_min = None
                c.price_max = None
                shown = "Sur devis"
            else:  # range | floor
                c.is_quote_based = False
                c.price_min = t["price_min"]
                c.price_max = t.get("price_max")
                if c.price_max is not None:
                    shown = f"{c.price_min} – {c.price_max} FCFA"
                else:
                    shown = f"À partir de {c.price_min} FCFA"

            applied.append((t["label"], c.name, shown))

        db.session.commit()

        print()
        print("=" * 64)
        print("  SEED PRIX CATÉGORIES (idempotent — UPDATE only)")
        print("=" * 64)
        for label, real_name, shown in applied:
            print(f"  ✅ {label:<32} [{real_name}]  →  {shown}")
        for label in skipped:
            print(f"  ⏭️  {label:<32} (absente en DB, sautée)")
        print("-" * 64)
        print(f"  Appliquées: {len(applied)}   Sautées: {len(skipped)}")
        print("=" * 64)


if __name__ == "__main__":
    main()
