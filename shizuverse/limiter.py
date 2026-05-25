import os
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

storage_uri = os.getenv("REDIS_URL", "memory://")

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=storage_uri,
    default_limits=["200 per day", "50 per hour"],
)
