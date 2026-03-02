from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash
from flask_login import login_required, current_user
from flask_babel import _
from shizuverse.models import Service, Appointment, ServiceProvider, Notification, db
from datetime import datetime

client_bp = Blueprint('client', __name__)

@client_bp.route('/dashboard')
@login_required
def dashboard():
    if current_user.user_type != 'client':
        flash(_('Access denied.'))
        return redirect(url_for('auth.login'))

    upcoming = Appointment.query.filter_by(client_id=current_user.id).order_by(Appointment.appointment_date).limit(5).all()
    return render_template('client/dashboard.html', upcoming_appointments=upcoming)
