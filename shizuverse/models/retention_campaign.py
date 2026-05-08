from shizuverse.models import db
from datetime import datetime, date


class RetentionCampaign(db.Model):
    __tablename__ = 'retention_campaigns'

    id            = db.Column(db.Integer, primary_key=True)
    client_phone  = db.Column(db.String(30), nullable=False, index=True)
    message_sent  = db.Column(db.Text, nullable=True)
    sent_at       = db.Column(db.DateTime, default=datetime.utcnow)
    campaign_date = db.Column(db.Date, default=date.today)
    opted_out     = db.Column(db.Boolean, default=False, nullable=False, server_default='false')
