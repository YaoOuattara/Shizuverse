# Shizu Backend - Models

This folder contains all the SQLAlchemy models for the Shizu platform:

## Structure

- **user.py**: Core user model supporting clients and providers.
- **role.py**: Support for role-based access control.
- **service.py**: Services offered by providers, including availability and metrics.
- **appointment.py**: Appointment and scheduling model.
- **rating.py**: Stores reviews and star ratings.
- **chat.py**: Session and message schema for multilingual chat assistant.
- **achievement.py**: Tracks progress-based achievements for gamification.
- **notification.py**: Stores user and system notifications.

## Notes

- Relationships are managed using `db.relationship` and `db.ForeignKey`.
- Most models have helper methods (`__repr__`, `calculate_*`, `to_dict`) for common logic.
- All datetime fields default to UTC.

## Extending

To add fields or models:
1. Update the model class.
2. Generate a new Alembic migration.
3. Run `flask db upgrade`.