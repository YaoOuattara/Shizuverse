#!/usr/bin/env python3
"""Réparation one-shot : lignes ServiceProvider désynchronisées (legacy T-20).

RÈGLE : alignement PAR CHAMP « vers le haut » — jamais de copie aveugle d'une
ligne canonical (une canonical peut elle-même porter des champs dégradés :
verified=False, reviewed_at=None… et les copier DÉCLASSERAIT les sœurs).

Pour chaque user_id ayant AU MOINS UNE ligne 'approved' :
  - verification_status → 'approved' partout (l'approbation est par PERSONNE)
  - verified            → True partout
  - listed_status       → 'listed' si au moins une sœur est listée
  - provider_status     → 'active' si au moins une sœur est active
  - reviewed_at / submitted_at → plus ANCIENNE valeur non nulle (l'historique
    se propage, ne s'efface jamais)
  - reviewed_by         → première valeur non nulle
  - champs PROFIL (photos, docs, bio, momo, rccm, service_rates…) →
    coalesce non-nul, en préférant la ligne modifiée le plus récemment
  - RÈGLE GÉNÉRALE : None n'écrase JAMAIS une valeur. Si un champ est nul sur
    TOUTES les sœurs, il reste nul (et c'est signalé : donnée réellement
    perdue, à re-saisir).

⚠️ DRY-RUN PAR DÉFAUT. N'écrit RIEN sans le flag explicite --execute.
Chaque changement est loggé : user_id, ligne, champ, avant → après.

Usage :
    python scripts/repair_provider_sync.py            # inventaire seul
    python scripts/repair_provider_sync.py --execute  # écrit (après revue)
"""
import argparse
import sys

# Champs profil consolidés par coalesce non-nul (ligne la plus récemment
# modifiée d'abord) — divergence possible quand une ligne a été créée sans
# copie complète (bug corrigé par R2) ou supprimée/recréée.
PROFILE_FIELDS = (
    "company_name", "phone_number", "bio", "address", "account_type",
    "rccm_number", "profile_picture", "profile_photo_url", "id_document_url",
    "experience_text", "experience_photo_url",
    "mobile_money_number", "mobile_money_name", "mobile_money_operator",
    "service_rates",
)


def _load():
    from shizuverse.app import app
    from shizuverse.models import db
    from shizuverse.models.service_provider import ServiceProvider
    return app, db, ServiceProvider


def main():
    ap = argparse.ArgumentParser(
        description="Alignement par champ des lignes sœurs (dry-run par défaut).")
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

            # ── Cible PAR CHAMP, « vers le haut » ────────────────────────────
            targets = {
                "verification_status": "approved",
                "verified": True,
                "listed_status": ("listed"
                                  if any(r.listed_status == "listed" for r in user_rows)
                                  else None),
                "provider_status": ("active"
                                    if any(r.provider_status == "active" for r in user_rows)
                                    else None),
                # Historique : plus ancienne valeur non nulle, jamais effacée.
                "reviewed_at": min((r.reviewed_at for r in user_rows if r.reviewed_at),
                                   default=None),
                "submitted_at": min((r.submitted_at for r in user_rows if r.submitted_at),
                                    default=None),
                "reviewed_by": next((r.reviewed_by for r in user_rows
                                     if r.reviewed_by is not None), None),
            }
            # Profil : coalesce non-nul, ligne la plus récemment modifiée d'abord.
            by_recency = sorted(user_rows,
                                key=lambda r: (r.updated_at or r.created_at
                                               or __import__("datetime").datetime.min),
                                reverse=True)
            for field in PROFILE_FIELDS:
                targets[field] = next(
                    (getattr(r, field) for r in by_recency
                     if getattr(r, field) not in (None, "")), None)

            user_changes = 0
            for r in user_rows:
                for field, target in targets.items():
                    if target is None:
                        continue          # None n'écrase JAMAIS une valeur
                    before = getattr(r, field)
                    if before == target:
                        continue
                    if before not in (None, "") and field in PROFILE_FIELDS:
                        # Deux valeurs non nulles divergentes sur un champ
                        # profil : la plus récente gagne (déjà choisie), mais
                        # on le voit dans le log.
                        pass
                    print(f"  user_id={user_id} sp_id={r.id} "
                          f"(service_id={r.service_id}) {field}: "
                          f"{before!r} → {target!r}")
                    if args.execute:
                        setattr(r, field, target)
                    user_changes += 1

            # Champs profil nuls sur TOUTES les sœurs = donnée réellement perdue.
            fully_empty = [f for f in PROFILE_FIELDS
                           if targets[f] is None
                           and any(getattr(r, f) in (None, "") for r in user_rows)]
            if fully_empty and user_changes:
                print(f"  user_id={user_id} : champs vides sur TOUTES les lignes "
                      f"(perte réelle, à re-saisir) : {', '.join(fully_empty)}")

            if user_changes:
                touched_users += 1
                total_changes += user_changes
                print(f"  ↳ user_id={user_id} : {user_changes} champ(s) alignés "
                      f"({user_rows[0].company_name!r})")

        print(f"\n{mode} — {touched_users} prestataire(s) concerné(s), "
              f"{total_changes} champ(s) à aligner.")

        if not args.execute:
            print("Aucune écriture (dry-run). Relancer avec --execute pour réparer.")
            return

        db.session.commit()
        print("Écrit. Vérifiez au Render Shell :")
        print("  SELECT user_id, id, service_id, verification_status, verified, "
              "listed_status, provider_status, reviewed_at FROM service_providers "
              "ORDER BY user_id, id;")


if __name__ == "__main__":
    sys.exit(main())
