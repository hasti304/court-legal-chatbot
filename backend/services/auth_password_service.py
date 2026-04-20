import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

try:
    from ..models.intake import Intake
    from ..models.password_reset import PasswordResetToken
    from .config_service import (
        FRONTEND_BASE_URL,
        RESET_PASSWORD_DEV_RETURN_TOKEN,
        RESET_PASSWORD_TTL_MINUTES,
    )
    from .magic_link_service import find_intake_for_email, hash_token
    from .transactional_email import send_transactional_email
except ImportError:
    from models.intake import Intake  # type: ignore
    from models.password_reset import PasswordResetToken  # type: ignore
    from services.config_service import (  # type: ignore
        FRONTEND_BASE_URL,
        RESET_PASSWORD_DEV_RETURN_TOKEN,
        RESET_PASSWORD_TTL_MINUTES,
    )
    from services.magic_link_service import find_intake_for_email, hash_token  # type: ignore
    from services.transactional_email import send_transactional_email  # type: ignore


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(data: str) -> bytes:
    padded = data + "=" * ((4 - (len(data) % 4)) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def hash_password(plain_password: str) -> str:
    pwd = (plain_password or "").encode("utf-8")
    if len(pwd) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    salt = os.urandom(16)
    rounds = 210_000
    digest = hashlib.pbkdf2_hmac("sha256", pwd, salt, rounds)
    return f"pbkdf2_sha256${rounds}${_b64(salt)}${_b64(digest)}"


def verify_password(plain_password: str, stored_hash: str) -> bool:
    try:
        algo, rounds_s, salt_s, hash_s = str(stored_hash or "").split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        rounds = int(rounds_s)
        salt = _unb64(salt_s)
        expected = _unb64(hash_s)
        got = hashlib.pbkdf2_hmac("sha256", (plain_password or "").encode("utf-8"), salt, rounds)
        return hmac.compare_digest(got, expected)
    except Exception:
        return False


def login_with_password(payload, db: Session) -> dict:
    email = str(payload.email).strip().lower()
    password = str(payload.password or "")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    intake = find_intake_for_email(db, email)
    if not intake or not getattr(intake, "password_hash", None):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not verify_password(password, intake.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return {"intake_id": intake.id, "email": intake.email}


def request_password_reset(payload, db: Session) -> dict:
    email = str(payload.email).strip().lower()
    intake = find_intake_for_email(db, email)
    if not intake:
        return {"status": "sent"}

    plain = secrets.token_urlsafe(32)
    token_hash = hash_token(plain)
    now = utc_now()
    expires = now + timedelta(minutes=RESET_PASSWORD_TTL_MINUTES)

    try:
        db.add(
            PasswordResetToken(
                email=email,
                token_hash=token_hash,
                created_at=now,
                expires_at=expires,
                consumed_at=None,
            )
        )
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    base = (FRONTEND_BASE_URL or "").rstrip("/") or "http://localhost:5173"
    reset_url = f"{base}/?reset_token={plain}"
    subject = "Reset your password — Chicago Advocate Legal, NFP"
    text = (
        "You requested a password reset for the CAL legal resource navigator.\n\n"
        f"Use this link to reset your password (expires in {RESET_PASSWORD_TTL_MINUTES} minutes):\n"
        f"{reset_url}\n\n"
        "If you did not request this, you can ignore this email."
    )
    html = (
        "<p>You requested a password reset for the CAL legal resource navigator.</p>"
        f"<p><a href=\"{reset_url}\">Reset password</a> (expires in {RESET_PASSWORD_TTL_MINUTES} minutes)</p>"
        "<p>If you did not request this, you can ignore this email.</p>"
    )
    sent = send_transactional_email(email, subject, text, html)
    if not sent:
        print(f"Password reset link for {email}: {reset_url}")

    result: dict = {"status": "sent"}
    if RESET_PASSWORD_DEV_RETURN_TOKEN:
        result["dev_reset_link"] = reset_url
    return result


def reset_password(payload, db: Session) -> dict:
    raw = str(payload.token or "").strip()
    new_password = str(payload.new_password or "")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if not raw:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

    th = hash_token(raw)
    now = utc_now()
    try:
        row = (
            db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.token_hash == th,
                PasswordResetToken.consumed_at.is_(None),
                PasswordResetToken.expires_at > now,
            )
            .first()
        )
        if not row:
            raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

        intake = find_intake_for_email(db, row.email)
        if not intake:
            row.consumed_at = now
            db.add(row)
            db.commit()
            raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

        intake.password_hash = hash_password(new_password)
        row.consumed_at = now
        db.add(intake)
        db.add(row)
        db.commit()
        return {"status": "ok"}
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
