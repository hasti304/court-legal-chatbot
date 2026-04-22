"""Admin dashboard login: email + password → JWT. Legacy X-Admin-Key remains optional."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
import jwt
from fastapi import HTTPException

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
    if os.getenv("ADMIN_ALLOW_PLAIN_PASSWORD", "").strip().lower() in ("1", "true", "yes") and (
        os.getenv("ADMIN_PASSWORD") or ""
    ).strip():
        return True
    return False


def _verify_password(plain: str) -> bool:
    h = (os.getenv("ADMIN_PASSWORD_HASH") or "").strip()
    allow_plain = os.getenv("ADMIN_ALLOW_PLAIN_PASSWORD", "").strip().lower() in ("1", "true", "yes")
    if h:
        try:
            if bcrypt.checkpw(
                (plain or "").encode("utf-8"),
                h.encode("utf-8"),
            ):
                return True
        except Exception:
            # Treat an invalid hash as non-match and allow explicit dev fallback below.
            pass
    if allow_plain:
        expected = (os.getenv("ADMIN_PASSWORD") or "").strip()
        if not expected:
            return False
        return hmac_compare(plain, expected)
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
    return bool(sub) and sub == _admin_email_normalized()


def try_login(email: str, password: str) -> tuple[str, int]:
    if not admin_login_configured():
        raise HTTPException(
            status_code=503,
            detail="Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH (or ADMIN_ALLOW_PLAIN_PASSWORD + ADMIN_PASSWORD for local dev only).",
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
