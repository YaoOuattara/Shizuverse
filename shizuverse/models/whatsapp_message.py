from . import db
from datetime import datetime

# One table for BOTH directions of the WhatsApp thread.
#   inbound  — a client/provider replies in the thread; the webhook creates the row.
#   outbound — a message we sent; the statusCallback creates it, then updates the
#              same row as Twilio reports sent → delivered → read (or failed).
# The two flows meet on message_sid (Twilio's MessageSid), which is why it is
# UNIQUE: the callback upserts on it instead of inserting duplicates. Reading a
# booking's whole conversation is then one query ordered by received_at.
VALID_DIRECTIONS = ('inbound', 'outbound')

# 'received' is ours (an inbound message has no Twilio delivery status); the
# rest are Twilio's MessageStatus values verbatim. Plain VARCHAR, not a PG enum
# — Twilio adds statuses on its own schedule and enum surgery in production is
# expensive (same reasoning as ClientBooking.payment_status).
VALID_STATUSES = ('received', 'queued', 'sent', 'delivered', 'read', 'failed', 'undelivered')

# Which side of the platform the sender was matched to. 'both' is a REAL case
# (a provider who is also a client — e.g. the test number) and is resolved in
# favour of the provider; it is stored, not silently collapsed, so the ambiguity
# stays visible in the admin. 'none' = unknown number, kept with booking_id NULL
# rather than dropped — an unmatched message is exactly what we must not lose.
#
# DETTE ASSUMÉE — 'outbound' marks a row whose booking came from the sender
# itself (?b= on the statusCallback), i.e. a CERTAIN attachment rather than a
# resolved one. It overlaps with `direction`, which already says 'outbound':
# the two columns partly encode the same fact. What matched_role should really
# express is HOW the attachment was obtained (certainty vs guess), not the
# direction. Kept as the smallest honest change; the vocabulary rework is
# deferred, not forgotten.
VALID_MATCHED_ROLES = ('provider', 'client', 'both', 'none', 'outbound')


class WhatsAppMessage(db.Model):
    __tablename__ = "whatsapp_messages"

    id = db.Column(db.Integer, primary_key=True)

    # Twilio's MessageSid — the join key between the inbound insert and the
    # statusCallback updates. Unique so a retried callback can never duplicate.
    message_sid = db.Column(db.String(64), nullable=False, unique=True, index=True)
    direction   = db.Column(db.String(10), nullable=False)   # see VALID_DIRECTIONS

    # Phones are stored TWICE on purpose: the raw Twilio value (audit trail —
    # what actually arrived, "whatsapp:+225…" prefix stripped and nothing else)
    # and the T-22 normalized form used for matching and indexing. If our
    # normalization ever changes, the raw value lets us re-resolve every row.
    from_phone_raw = db.Column(db.String(40), nullable=True)
    to_phone_raw   = db.Column(db.String(40), nullable=True)
    from_phone     = db.Column(db.String(30), nullable=True, index=True)
    to_phone       = db.Column(db.String(30), nullable=True, index=True)

    # Inbound only. Outbound rows carry template_key instead: the statusCallback
    # never reports the body, and the approved template text is owned by its
    # Twilio Content SID, not by us.
    body      = db.Column(db.Text, nullable=True)
    # Photos/audio are NOT downloaded in this scope; a non-zero count is how the
    # admin knows a message had an attachment they can't see here.
    num_media = db.Column(db.Integer, nullable=False, default=0, server_default='0')

    template_key = db.Column(db.String(80), nullable=True)   # outbound: shizu_*_fr
    status       = db.Column(db.String(20), nullable=False, default='received',
                             server_default='received')      # see VALID_STATUSES
    # Twilio error code on failed/undelivered (63016 = outside the 24h window,
    # 63028 = template variable mismatch…). This is what makes a silent send
    # failure finally visible.
    error_code   = db.Column(db.String(20), nullable=True)

    # Nullable BOTH ways: an unmatched sender still gets a row.
    booking_id   = db.Column(db.Integer, db.ForeignKey("client_bookings.id"), nullable=True, index=True)
    provider_id  = db.Column(db.Integer, db.ForeignKey("service_providers.id"), nullable=True)
    matched_role = db.Column(db.String(10), nullable=False, default='none',
                             server_default='none')          # see VALID_MATCHED_ROLES

    is_read = db.Column(db.Boolean, nullable=False, default=False, server_default='false', index=True)

    received_at       = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    status_updated_at = db.Column(db.DateTime, nullable=True)

    # The full Twilio form payload as JSON. Cheap insurance: if we later need a
    # field we didn't model (ProfileName, WaId, MediaUrl…), it is already here
    # and no message has to be re-received.
    raw_payload = db.Column(db.Text, nullable=True)

    booking  = db.relationship("ClientBooking", backref=db.backref("whatsapp_messages", lazy="dynamic"))
    provider = db.relationship("ServiceProvider", backref=db.backref("whatsapp_messages", lazy="dynamic"))

    def to_dict(self):
        return {
            "id":                self.id,
            "message_sid":       self.message_sid,
            "direction":         self.direction,
            "from_phone":        self.from_phone,
            "to_phone":          self.to_phone,
            "body":              self.body,
            "num_media":         self.num_media,
            "template_key":      self.template_key,
            "status":            self.status,
            "error_code":        self.error_code,
            "booking_id":        self.booking_id,
            "provider_id":       self.provider_id,
            "matched_role":      self.matched_role,
            "is_read":           self.is_read,
            "received_at":       self.received_at.isoformat() if self.received_at else None,
            "status_updated_at": self.status_updated_at.isoformat() if self.status_updated_at else None,
        }

    def __repr__(self):
        return f"<WhatsAppMessage {self.direction} {self.message_sid} {self.status}>"
