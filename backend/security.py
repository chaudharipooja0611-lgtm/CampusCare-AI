import collections
import datetime
import functools
import threading
import time

import jwt
from flask import request, g
from config import Config
from db import query
from utils import ApiError

USER_SQL = """SELECT u.id, u.name, u.email, u.role, u.department_id, u.created_at,
              d.name AS department_name FROM users u
              LEFT JOIN departments d ON d.id = u.department_id """


def get_user(user_id):
    return query(USER_SQL + "WHERE u.id = %s", (user_id,), one=True)


def make_token(user):
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {"sub": str(user["id"]), "role": user["role"], "iat": now,
               "exp": now + datetime.timedelta(hours=Config.JWT_HOURS)}
    return jwt.encode(payload, Config.SECRET_KEY, algorithm="HS256")


def _user_from_request():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        data = jwt.decode(header[7:], Config.SECRET_KEY, algorithms=["HS256"])
        return get_user(int(data["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError):
        return None


def optional_user():
    return _user_from_request()


def login_required(*roles):
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            user = _user_from_request()
            if not user:
                raise ApiError("Authentication required. Please log in again.", 401)
            if roles and user["role"] not in roles:
                raise ApiError("You do not have permission to perform this action", 403)
            g.user = user
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ---- simple in-memory sliding-window rate limiter (per client IP + endpoint) ----
_hits = collections.defaultdict(collections.deque)
_lock = threading.Lock()


def rate_limit(max_calls, window_seconds):
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            key = (request.remote_addr, request.endpoint)
            now = time.monotonic()
            with _lock:
                q = _hits[key]
                while q and now - q[0] > window_seconds:
                    q.popleft()
                if len(q) >= max_calls:
                    raise ApiError("Too many requests. Please wait a moment and try again.", 429)
                q.append(now)
            return fn(*args, **kwargs)
        return wrapper
    return decorator
