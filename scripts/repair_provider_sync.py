#!/usr/bin/env python3
"""Réparation one-shot : lignes ServiceProvider désynchronisées (legacy T-20).

Avant le fix _sync_provider_rows (2ec041c, 19/07), approuver un prestataire ne
touchait QUE la ligne cliquée — les lignes sœurs (autres services de la même
personne) restaient 'submitted'. Ce script répare ces données legacy : pour
chaque user_id ayant AU MOINS UNE ligne 'approved', toutes les sœurs sont
alignées sur le canonical approuvé (verification_status, listed_status,
provider_status, verified, reviewed_at).

⚠️ DRY-RUN PAR DÉFAUT. N'écrit RIEN sans le flag explicite --execute.
Chaque changement est loggé : user_id, ligne, champ, avant → après.

Usage :
    # 1) Inventaire seul (aucune écriture) :
    python scripts/repair_provider_sync.py

    # 2) Réparer réellement (après revue de l'inventaire) :
    python scripts/repair_provider_sync.py --execute
"""
import argparse
import sys

# Champs de STATUT alignés sur le canonical (T-20 : le statut est par PERSONNE).
SYNC_FIELDS = ("verification_status", "listed_status", "provider_status",
               "verified", "reviewed_at")


def _load():
    from shizuverse.app import app
    from shizuverse.models import db
    from shizuverse.models.service_provider import ServiceProvider
    return app, db, ServiceProvider


def main():
    ap = argparse.ArgumentParser(
        description="Aligne les lignes sœurs d'un prestataire approuvé (dry-run par défaut).")
    ap.add_argument("--execute", action="store_true",
                    help="Écrit réellement en base. Sans ce flag : dry-run.")
    args = ap.parse_args()

    app, db, ServiceProvider = _load()

    with app.app_context():
        rows = ServiceProvider.query.order_by(
            ServiceProvider.user_id, ServiceProvider.id).all()
        by_user = {}
        for r in rows:
            by_user.setdefault(r.user_id, []).append(r)

        mode = "EXÉCUTION" if args.execute else "DRY-RUN"
        total_changes = 0
        touched_users = 0

        for user_id, user_rows in sorted(by_user.items()):
            approved = [r for r in user_rows if r.verification_status == "approved"]
            if not approved or len(user_rows) == 1:
                continue
            # Canonical = la ligne approuvée la plus ancienne (id le plus bas) —
            # celle que l'admin a réellement validée.
            canonical = approved[0]
            user_changes = 0
            for r in user_rows:
                if r.id == canonical.id:
                    continue
                for field in SYNC_FIELDS:
                    before = getattr(r, field)
                    after = getattr(canonical, field)
                    if before != after:
                        print(f"  user_id={user_id} sp_id={r.id} "
                              f"(service_id={r.service_id}) {field}: "
                              f"{before!r} → {after!r}")
                        if args.execute:
                            setattr(r, field, after)
                        user_changes += 1
            if user_changes:
                touched_users += 1
                total_changes += user_changes
                print(f"  ↳ user_id={user_id} : {user_changes} champ(s) "
                      f"(canonical sp_id={canonical.id}, "
                      f"'{canonical.company_name}')")

        print(f"\n{mode} — {touched_users} prestataire(s) désynchronisé(s), "
              f"{total_changes} champ(s) à aligner.")

        if not args.execute:
            print("Aucune écriture (dry-run). Relancer avec --execute pour réparer.")
            return

        db.session.commit()
        print("Écrit. Vérifiez au Render Shell :")
        print("  SELECT user_id, id, service_id, verification_status, "
              "listed_status, provider_status FROM service_providers "
              "ORDER BY user_id, id;")


if __name__ == "__main__":
    sys.exit(main())
