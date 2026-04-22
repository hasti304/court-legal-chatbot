"""Admin dashboard login: email + password → JWT. Legacy X-Admin-Key remains optional."""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
import jwt
from fastapi import HTTPException

try:
    from redis import Redis
    from redis.exceptions import RedisError
except Exception:  # pragma: no cover - optional dependency fallback
    Redis = None  # type: ignore

    class RedisError(Exception):
        pass

try:
    from .config_service import ADMIN_EMAIL, ADMIN_EXPORT_KEY, ADMIN_JWT_EXPIRE_MINUTES, ADMIN_JWT_SECRET
except ImportError:
    from services.config_service import (  # type: ignore
        ADMIN_EMAIL,
        ADMIN_EXPORT_KEY,
        ADMIN_JWT_EXPIRE_MINUTES,
        ADMIN_JWT_SECRET,
    )


def _admin_email_normalized() -> str:
    return (ADMIN_EMAIL or "").strip()


_REDIS_CLIENT: Optional[Redis] = None
_REDIS_INIT_ATTEMPTED = False
_SESSION_KEY = "cal:admin:session_version"
_LOCAL_SESSION_VERSION = secrets.token_hex(16)


def _redis_client() -> Optional[Redis]:
    global _REDIS_CLIENT, _REDIS_INIT_ATTEMPTED
    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT
    if _REDIS_INIT_ATTEMPTED:
        return None
    _REDIS_INIT_ATTEMPTED = True
    url = (os.getenv("REDIS_URL") or "").strip()
    if not url:
        return None
    if Redis is None:
        return None
    try:
        client = Redis.from_url(url, decode_responses=True, socket_timeout=2, socket_connect_timeout=2)
        client.ping()
        _REDIS_CLIENT = client
        return _REDIS_CLIENT
    except Exception:
        return None


def _read_session_version() -> str:
    client = _redis_client()
    if client is None:
        return _LOCAL_SESSION_VERSION
    try:
        value = (client.get(_SESSION_KEY) or "").strip()
        if value:
            return value
        new_value = secrets.token_hex(16)
        client.set(_SESSION_KEY, new_value)
        return new_value
    except RedisError:
        return _LOCAL_SESSION_VERSION


def _rotate_session_version() -> str:
    global _LOCAL_SESSION_VERSION
    new_value = secrets.token_hex(16)
    client = _redis_client()
    if client is None:
        _LOCAL_SESSION_VERSION = new_value
        return _LOCAL_SESSION_VERSION
    try:
        client.set(_SESSION_KEY, new_value)
        return new_value
    except RedisError:
        _LOCAL_SESSION_VERSION = new_value
        return _LOCAL_SESSION_VERSION


def _jwt_secret() -> str:
    if ADMIN_JWT_SECRET:
        return ADMIN_JWT_SECRET
    if ADMIN_EXPORT_KEY:
        return ADMIN_EXPORT_KEY
    return ""


def admin_login_configured() -> bool:
    if not _admin_email_normalized():
        return False
    if (os.getenv("ADMIN_PASSWORD_HASH") or "").strip():
        return True
    if (os.getenv("ADMIN_PASSWORD") or "").strip():
        return True
    return False


def _verify_password(plain: str) -> bool:
    h = (os.getenv("ADMIN_PASSWORD_HASH") or "").strip()
    expected_plain = (os.getenv("ADMIN_PASSWORD") or "").strip()
    if h:
        try:
            if bcrypt.checkpw(
                (plain or "").encode("utf-8"),
                h.encode("utf-8"),
            ):
                return True
        except Exception:
            # Treat an invalid hash as non-match and continue with plain fallback below.
            pass
    # Always allow explicit ADMIN_PASSWORD fallback when present.
    # This prevents lockouts when a stale hash is left in env but ops is using plain password.
    if expected_plain:
        return hmac_compare(plain, expected_plain)
    return False


def hmac_compare(a: str, b: str) -> bool:
    import hmac

    return hmac.compare_digest((a or "").encode("utf-8"), (b or "").encode("utf-8"))


def issue_admin_token(email: str) -> tuple[str, int]:
    secret = _jwt_secret()
    if not secret:
        raise ValueError("ADMIN_JWT_SECRET or ADMIN_EXPORT_KEY must be set to issue admin tokens")
    exp_minutes = max(15, min(int(ADMIN_JWT_EXPIRE_MINUTES or 480), 24 * 60))
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=exp_minutes)
    payload: dict[str, Any] = {
        "sub": email.strip().lower(),
        "role": "admin",
        "sv": _read_session_version(),
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    token = jwt.encode(payload, secret, algorithm="HS256")
    return token, exp_minutes * 60


def decode_admin_token(token: str) -> Optional[dict]:
    secret = _jwt_secret()
    if not secret or not token:
        return None
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def admin_request_authorized(request) -> bool:
    """True if Authorization Bearer is a valid admin JWT for the configured admin email."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False
    payload = decode_admin_token(auth[7:].strip())
    if not payload or payload.get("role") != "admin":
        return False
    sub = (payload.get("sub") or "").strip().lower()
    token_session_version = str(payload.get("sv") or "").strip()
    if not token_session_version:
        return False
    return bool(sub) and sub == _admin_email_normalized() and token_session_version == _read_session_version()


def logout_admin_session() -> None:
    _rotate_session_version()


def try_login(email: str, password: str) -> tuple[str, int]:
    if not admin_login_configured():
        raise HTTPException(
            status_code=503,
            detail="Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH, or set ADMIN_PASSWORD.",
        )
    if (email or "").strip().lower() != _admin_email_normalized():
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not _verify_password(password or ""):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    try:
        token, ttl = issue_admin_token(email)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return token, ttl
