#!/usr/bin/env python3
"""
seed_prix_categories.py — applique les fourchettes de prix INDICATIVES sur
les catégories existantes (ServiceCategory), de façon idempotente.

Match par ID (stable) — PAS par nom : les noms réels en DB diffèrent du
catalogue seed (ex. "Childcare", "Climatisation ET électroménager") et un
match par nom sautait ces catégories silencieusement.

Garanties :
- UPDATE only : ne crée jamais de catégorie, ne renomme jamais.
- Ne touche QUE price_min / price_max / is_quote_based.
- Idempotent : réécrit les 3 champs, résultat déterministe à chaque run.
- Échoue BRUYAMMENT (sys.exit non nul, aucun commit) si un id est absent.

Ces prix sont l'AFFICHAGE indicatif ; ils ne contraignent jamais le
amount_xof verrouillé par l'admin.

Usage (Render shell ou local) :
    python scripts/seed_prix_categories.py
"""

import sys

from shizuverse.app import create_app
from shizuverse.models import db
from shizuverse.models.service_models import ServiceCategory

_result = create_app()
app = _result[0] if isinstance(_result, tuple) else _result


# Cibles par ID (stable). mode = "range" | "floor" | "quote".
# label = nom attendu, affiché à titre indicatif (jamais écrit en DB).
TARGETS = [
    {"id": 1,  "label": "Ménage et nettoyage",            "mode": "range", "price_min": 5000,  "price_max": 15000},
    {"id": 7,  "label": "Jardinage et piscine",           "mode": "range", "price_min": 10000, "price_max": 25000},
    {"id": 5,  "label": "Childcare",                      "mode": "range", "price_min": 5000,  "price_max": 12000},
    {"id": 6,  "label": "Beauté à domicile",              "mode": "range", "price_min": 5000,  "price_max": 20000},
    {"id": 9,  "label": "Aide aux seniors",               "mode": "range", "price_min": 10000, "price_max": 25000},
    {"id": 2,  "label": "Plomberie",                      "mode": "floor", "price_min": 10000, "price_max": None},
    {"id": 3,  "label": "Électricité",                    "mode": "floor", "price_min": 15000, "price_max": None},
    {"id": 4,  "label": "Bricolage & Réparations",        "mode": "quote"},
    {"id": 8,  "label": "Climatisation et électroménager", "mode": "quote"},
    {"id": 10, "label": "Peinture & Rénovation",          "mode": "quote"},
]


def _apply(cat, t):
    """Mute la catégorie selon le mode. Retourne (mode, min, max) appliqués."""
    if t["mode"] == "quote":
        cat.is_quote_based = True
        cat.price_min = None
        cat.price_max = None
    else:  # range | floor
        cat.is_quote_based = False
        cat.price_min = t["price_min"]
        cat.price_max = t.get("price_max")
    return t["mode"], cat.price_min, cat.price_max


def main():
    with app.app_context():
        # ── 1. Validation stricte : tous les ids doivent exister AVANT tout write.
        missing = [t["id"] for t in TARGETS if db.session.get(ServiceCategory, t["id"]) is None]
        if missing:
            print("=" * 68)
            print("  ❌ ÉCHEC — catégories introuvables (aucune écriture effectuée) :")
            for mid in missing:
                label = next(t["label"] for t in TARGETS if t["id"] == mid)
                print(f"     id {mid} attendu « {label} » — ABSENT en DB")
            print("=" * 68)
            sys.exit(1)

        # ── 2. Application (transaction unique).
        rows = []
        for t in TARGETS:
            cat = db.session.get(ServiceCategory, t["id"])
            mode, pmin, pmax = _apply(cat, t)
            rows.append((cat.id, cat.name, mode, pmin, pmax))

        db.session.commit()

        # ── 3. Rapport : id | nom | mode | min | max appliqués.
        print()
        print("=" * 68)
        print("  SEED PRIX CATÉGORIES — match par ID (UPDATE only, idempotent)")
        print("=" * 68)
        print(f"  {'id':>3} | {'nom':<30} | {'mode':<6} | {'min':>7} | {'max':>7}")
        print("  " + "-" * 64)
        for cid, name, mode, pmin, pmax in rows:
            disp_name = name if len(name) <= 30 else name[:29] + "…"
            smin = "—" if pmin is None else str(pmin)
            smax = "—" if pmax is None else str(pmax)
            print(f"  {cid:>3} | {disp_name:<30} | {mode:<6} | {smin:>7} | {smax:>7}")
        print("  " + "-" * 64)
        print(f"  {len(rows)} catégories mises à jour.")
        print("=" * 68)


if __name__ == "__main__":
    main()
