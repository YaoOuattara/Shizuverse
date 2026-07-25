import os
from anthropic import Anthropic


def get_provider_recommendations(booking_id: int) -> list:
    from shizuverse.models.client_booking import ClientBooking
    from shizuverse.models.service_provider import ServiceProvider
    from shizuverse.models.review import Review

    booking = ClientBooking.query.get(booking_id)
    if not booking:
        return []

    commune = (booking.client_location or '').split(',')[0].strip().lower()
    service_name = (booking.service_name or '').lower()
    urgency = booking.urgency or ''

    providers = ServiceProvider.query.filter_by(
        verification_status='approved',
        provider_status='active',
        listed_status='listed',
    ).all()

    # Group by user_id — one user can have multiple service rows
    user_map: dict = {}
    for sp in providers:
        uid = sp.user_id
        if uid not in user_map:
            user_map[uid] = {'representative': sp, 'sp_ids': [], 'services': []}
        user_map[uid]['sp_ids'].append(sp.id)
        if sp.service and sp.service.name:
            user_map[uid]['services'].append(sp.service.name.lower())

    scored = []
    for uid, data in user_map.items():
        sp = data['representative']
        services = list(set(data['services']))
        sp_ids = data['sp_ids']

        # avg_rating across all SP rows for this user
        reviews = Review.query.filter(
            Review.provider_id.in_(sp_ids),
            Review.is_published == True,
        ).all()
        review_count = len(reviews)
        avg_rating = round(sum(r.rating for r in reviews) / review_count, 1) if review_count > 0 else 0.0

        zones = [z.strip().lower() for z in (sp.address or '').split(',') if z.strip()]

        # ── Score components (tracked individually for breakdown) ─────
        zone_match    = bool(commune and any(commune in z or z in commune for z in zones))
        service_match = bool(service_name and any(service_name in s or s in service_name for s in services))
        rating_bonus  = round((avg_rating / 5.0) * 20, 1) if avg_rating else 0.0
        urgency_bonus = urgency == 'urgent_2h'

        score = 0.0
        if zone_match:    score += 40
        if service_match: score += 30
        score += rating_bonus
        if urgency_bonus: score += 10

        # Zero-reason label: explain why a provider has no real match
        no_match = not zone_match and not service_match
        if no_match:
            reasons = []
            if not zone_match:    reasons.append('Hors zone')
            if not service_match: reasons.append('Service non proposé')
            zero_reason = ' · '.join(reasons)
        else:
            zero_reason = None

        scored.append({
            'sp':           sp,
            'services':     services,
            'avg_rating':   avg_rating,
            'review_count': review_count,
            'score':        round(score),
            'zones':        zones,
            'zone_match':   zone_match,
            'service_match': service_match,
            'rating_bonus': rating_bonus,
            'urgency_bonus': urgency_bonus,
            'zero_reason':  zero_reason,
        })

    scored.sort(key=lambda x: x['score'], reverse=True)
    top3 = scored[:3]

    results = []
    api_key = os.environ.get('ANTHROPIC_API_KEY', '')

    try:
        client = Anthropic(api_key=api_key)
        for item in top3:
            sp = item['sp']
            name = sp.company_name or f"Prestataire #{sp.id}"

            # Skip AI call for providers with no zone/service match — use zero_reason label instead
            if item['zero_reason']:
                ai_recommendation = ''
            else:
                try:
                    msg = client.messages.create(
                        model='claude-haiku-4-5-20251001',
                        max_tokens=120,
                        system=(
                            "Tu es l'assistant de matching Shizu. En une phrase, explique pourquoi "
                            "ce prestataire est ou n'est pas idéal pour cette mission. "
                            "Mentionne la zone, le service, ou la disponibilité. "
                            "Sois direct et utile pour l'admin."
                        ),
                        messages=[{
                            'role': 'user',
                            'content': (
                                f"Mission: {booking.service_name} à {booking.client_location} "
                                f"(urgence: {booking.urgency or 'normale'}, "
                                f"préférence: {booking.time_preference or 'flexible'}, "
                                f"budget: {booking.amount_xof or '?'} FCFA).\n"
                                f"Prestataire: {name}, "
                                f"note: {item['avg_rating']}/5 ({item['review_count']} avis), "
                                f"zones: {', '.join(item['zones']) or 'non renseignées'}, "
                                f"services: {', '.join(item['services']) or 'non renseignés'}, "
                                f"zone match: {'oui' if item['zone_match'] else 'non'}, "
                                f"service match: {'oui' if item['service_match'] else 'non'}, "
                                f"score: {item['score']}/100."
                            ),
                        }],
                    )
                    ai_recommendation = msg.content[0].text.strip()
                except Exception:
                    ai_recommendation = f"{name} est disponible pour cette mission."

            results.append({
                'provider_id':      sp.id,
                'name':             name,
                'score':            item['score'],
                'ai_recommendation': ai_recommendation,
                'rating':           item['avg_rating'],
                'zones':            item['zones'],
                'phone':            sp.phone_number or '',
                'profile_photo_url': sp.profile_photo_url or '',
                'zero_reason':      item['zero_reason'],
                'score_breakdown': {
                    'zone':         item['zone_match'],
                    'service':      item['service_match'],
                    'rating_bonus': item['rating_bonus'],
                    'urgency':      item['urgency_bonus'],
                },
            })
    # Tolerated degradation (documented, out of the 503 lot's scope): if the AI
    # enrichment fails, recommendations fall back to score-only entries without
    # signalling. A DB outage never reaches here — the caller endpoint 500/503s
    # before this runs.
    except Exception:
        for item in top3:
            sp = item['sp']
            name = sp.company_name or f"Prestataire #{sp.id}"
            results.append({
                'provider_id':      sp.id,
                'name':             name,
                'score':            item['score'],
                'ai_recommendation': '',
                'rating':           item['avg_rating'],
                'zones':            item['zones'],
                'phone':            sp.phone_number or '',
                'profile_photo_url': sp.profile_photo_url or '',
                'zero_reason':      item['zero_reason'],
                'score_breakdown': {
                    'zone':         item['zone_match'],
                    'service':      item['service_match'],
                    'rating_bonus': item['rating_bonus'],
                    'urgency':      item['urgency_bonus'],
                },
            })

    return results
