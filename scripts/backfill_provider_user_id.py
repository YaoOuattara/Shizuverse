#!/usr/bin/env python3
"""Backfill one-shot : ClientBooking.provider_user_id depuis provider_phone.

La colonne est posée à l'assignation depuis ce lot, mais les réservations
antérieures ne portent que provider_phone — une chaîne. Ce script résout ce
lien UNE fois, pour que plus jamais l'agrégation financière n'ait à deviner.

RÉSOLUTION : provider_phone normalisé → ServiceProvider.phone_number normalisé
→ user_id. Normalisation DES DEUX CÔTÉS : les réservations antérieures à T-22
peuvent porter « 07 07 05 01 54 » là où la table prestataire porte
« +2250707050154 ». Une égalité de chaînes brutes en manquerait la moitié.

ON NE DEVINE JAMAIS (T-23). Un téléphone qui ne correspond à personne, ou qui
correspond à PLUSIEURS user_id différents, est laissé à None, loggé, et
rapporté en fin de run. Un rattachement financier faux coûte plus cher qu'un
rattachement absent.

T-20 : une personne possède plusieurs lignes ServiceProvider (une par service),
toutes avec le même user_id. Plusieurs lignes pour un même téléphone n'est donc
PAS une ambiguïté — c'est le cas nominal. L'ambiguïté, c'est plusieurs user_id
DISTINCTS.

⚠️ DRY-RUN PAR DÉFAUT. N'écrit RIEN sans le flag explicite --execute.
Après écriture, le script RELIT la base et sort en code 1 s'il reste le moindre
désalignement : il ne doit pas pouvoir annoncer un succès qu'il n'a pas obtenu.

Usage :
    python scripts/backfill_provider_user_id.py            # inventaire seul
    python scripts/backfill_provider_user_id.py --execute  # écrit (après revue)
"""
import argparse
import sys
from collections import defaultdict


def _resolve_phone_to_user_ids(providers, normalize_phone):
    """{téléphone normalisé: {user_id, …}} — l'ensemble, pour voir l'ambiguïté."""
    index = defaultdict(set)
    for sp in providers:
        if not sp.phone_number:
            continue
        canonical = normalize_phone(sp.phone_number.strip())
        if canonical:
            index[canonical].add(sp.user_id)
    return index


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true',
                        help="écrit réellement (sinon : inventaire seul)")
    args = parser.parse_args()

    from shizuverse.app import create_app
    from shizuverse.models import db, ClientBooking
    from shizuverse.models.service_provider import ServiceProvider
    from shizuverse.utils.phone import normalize_phone

    app = create_app()
    if isinstance(app, tuple):          # create_app peut renvoyer (app, socketio)
        app = app[0]

    with app.app_context():
        providers = ServiceProvider.query.all()
        index = _resolve_phone_to_user_ids(providers, normalize_phone)

        bookings = ClientBooking.query.filter(
            ClientBooking.provider_user_id.is_(None),
            ClientBooking.provider_phone.isnot(None),
        ).all()

        planned, unmatched, ambiguous = [], [], []
        for b in bookings:
            canonical = normalize_phone((b.provider_phone or '').strip())
            user_ids = index.get(canonical, set())
            if len(user_ids) == 1:
                planned.append((b, next(iter(user_ids)), canonical))
            elif not user_ids:
                unmatched.append((b, canonical))
            else:
                ambiguous.append((b, canonical, sorted(user_ids)))

        print(f"\n{'=' * 70}")
        print(f"Réservations sans provider_user_id mais avec un téléphone : {len(bookings)}")
        print(f"  résolues sans ambiguïté : {len(planned)}")
        print(f"  aucun prestataire        : {len(unmatched)}")
        print(f"  PLUSIEURS user_id        : {len(ambiguous)}")
        print('=' * 70)

        for b, user_id, canonical in planned:
            print(f"  #{b.id:<5} {canonical:<16} → user_id={user_id}"
                  f"   ({b.provider_name or '—'})")
        for b, canonical in unmatched:
            print(f"  #{b.id:<5} {canonical or '(vide)':<16} → AUCUN prestataire "
                  f"— laissé à None ({b.provider_name or '—'})")
        for b, canonical, user_ids in ambiguous:
            print(f"  #{b.id:<5} {canonical:<16} → AMBIGU {user_ids} "
                  f"— laissé à None, à trancher à la main")

        if not args.execute:
            print(f"\nDRY-RUN — rien n'a été écrit. Relancez avec --execute.\n")
            return 0

        if not planned:
            print("\nRien à écrire.\n")
            return 0

        for b, user_id, _ in planned:
            b.provider_user_id = user_id
        db.session.commit()
        print(f"\n{len(planned)} réservation(s) mise(s) à jour.")

        # ── Auto-vérification : on RELIT la base ────────────────────────────
        # Un script de réparation qui se contente d'annoncer son intention peut
        # mentir (transaction annulée, contrainte, session périmée). On revérifie.
        db.session.expire_all()
        failures = []
        for b, expected, _ in planned:
            fresh = db.session.get(ClientBooking, b.id)
            if fresh.provider_user_id != expected:
                failures.append((b.id, expected, fresh.provider_user_id))

        # Et aucun des cas non résolus ne doit avoir été rempli au passage.
        for b, _ in unmatched:
            fresh = db.session.get(ClientBooking, b.id)
            if fresh.provider_user_id is not None:
                failures.append((b.id, None, fresh.provider_user_id))
        for b, _, _ in ambiguous:
            fresh = db.session.get(ClientBooking, b.id)
            if fresh.provider_user_id is not None:
                failures.append((b.id, None, fresh.provider_user_id))

        if failures:
            print("\n❌ VÉRIFICATION ÉCHOUÉE — désalignement résiduel :")
            for bid, expected, got in failures:
                print(f"   #{bid} : attendu {expected}, lu {got}")
            return 1

        print("✅ Vérification post-commit : toutes les valeurs relues sont conformes.")
        if unmatched or ambiguous:
            print(f"\n⚠️  {len(unmatched) + len(ambiguous)} réservation(s) restent sans "
                  f"identifiant — non devinées, à traiter à la main.")
        print()
        return 0


if __name__ == '__main__':
    sys.exit(main())
