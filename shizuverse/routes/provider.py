from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from flask_babel import _
from shizuverse.models import ServiceProvider, Service, db

provider_bp = Blueprint('provider', __name__)

@provider_bp.route('/dashboard')
@login_required
def dashboard():
    if current_user.user_type != 'provider':
        flash(_('Access denied.'))
        return redirect(url_for('auth.login'))

    provider = ServiceProvider.query.filter_by(user_id=current_user.id).first()
    services = Service.query.filter_by(provider_id=provider.id).all()
    return render_template('provider/dashboard.html', provider=provider, services=services)
