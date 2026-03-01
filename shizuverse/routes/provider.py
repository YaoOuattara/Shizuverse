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
# Services are linked via the service_providers junction table.
# ServiceProvider has no standalone profile — use current_user directly.
services = current_user.services.all()
return render_template('provider/dashboard.html', provider=current_user, services=serv
