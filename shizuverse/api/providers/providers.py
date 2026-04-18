# Public provider endpoints — no auth required

from flask import Blueprint, jsonify
from shizuverse.models import db
from shizuverse.models.service_provider import ServiceProvider
from shizuverse.models.review import Review

providers_bp = Blueprint('public_providers', __name__)


@providers_bp.route('/<int:provider_id>', methods=['GET'])
def get_public_provider(provider_id):
    """
    GET /api/providers/<provider_id>
    Returns the public profile of a provider.
    Only returns data if the provider is approved, listed, and active.
    No auth required.
    """
    sp = ServiceProvider.query.get_or_404(provider_id)

    # Gate: only show approved + listed + active providers
    if sp.verification_status != 'approved' or sp.listed_status != 'listed' or sp.provider_status != 'active':
        return jsonify({'error': 'Provider not available'}), 404

    # Collect all services offered by this user (across all ServiceProvider rows)
    all_sp = ServiceProvider.query.filter_by(user_id=sp.user_id).all()
    service_names = [row.service.name for row in all_sp if row.service]

    # Compute average rating from approved (or unmoderated) reviews
    reviews = Review.query.filter(
        Review.provider_id == provider_id,
        db.or_(Review.moderation_status == 'approved', Review.moderation_status == None)
    ).all()
    review_count = len(reviews)
    average_rating = round(sum(r.rating for r in reviews) / review_count, 2) if review_count > 0 else None

    return jsonify({
        'id': sp.id,
        'user_id': sp.user_id,
        'name': sp.company_name or '',
        'bio': sp.bio or '',
        'zone': sp.address or '',
        'services': service_names,
        'average_rating': average_rating,
        'review_count': review_count,
        'verification_status': sp.verification_status,
    })


@providers_bp.route('/<int:provider_id>/reviews', methods=['GET'])
def get_provider_reviews(provider_id):
    """
    GET /api/providers/<provider_id>/reviews
    Returns published reviews for a provider.
    Only returns reviews where moderation_status is 'approved' or NULL.
    No auth required.
    """
    # Ensure provider exists and is publicly visible
    sp = ServiceProvider.query.get_or_404(provider_id)
    if sp.verification_status != 'approved' or sp.listed_status != 'listed' or sp.provider_status != 'active':
        return jsonify({'error': 'Provider not available'}), 404

    reviews = Review.query.filter(
        Review.provider_id == provider_id,
        db.or_(Review.moderation_status == 'approved', Review.moderation_status == None)
    ).order_by(Review.created_at.desc()).all()

    result = [
        {
            'id': r.id,
            'client_name': r.client_name,
            'rating': r.rating,
            'comment': r.text or '',
            'created_at': r.created_at.isoformat() if r.created_at else '',
        }
        for r in reviews
    ]
    return jsonify(result)
