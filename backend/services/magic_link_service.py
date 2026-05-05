import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import desc
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

try:
    from ..models.intake import Intake
    from ..models.magic_link import MagicLinkToken
    from ..services.config_service import (
        FRONTEND_BASE_URL,
        MAGIC_LINK_DEV_RETURN_TOKEN,
        MAGIC_LINK_TTL_MINUTES,
        dev_auth_links_in_response_allowed,
    )
    from .transactional_email import (
        email_provider_configured,
        email_provider_hint,
        send_transactional_email,
    )
except ImportError:
    from models.intake import Intake  # type: ignore
    from models.magic_link import MagicLinkToken  # type: ignore
    from services.config_service import (  # type: ignore
        FRONTEND_BASE_URL,
        MAGIC_LINK_DEV_RETURN_TOKEN,
        MAGIC_LINK_TTL_MINUTES,
        dev_auth_links_in_response_allowed,
    )
    from services.transactional_email import (  # type: ignore
        email_provider_configured,
        email_provider_hint,
        send_transactional_email,
    )


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def find_intake_for_email(db: Session, email: str) -> Optional[Intake]:
    normalized = (email or "").strip().lower()
    if not normalized:
        return None
    return (
        db.query(Intake)
        .filter(Intake.email == normalized)
        .order_by(desc(Intake.created_at))
        .first()
    )


def _build_magic_url(plain_token: str) -> str:
    base = (FRONTEND_BASE_URL or "").rstrip("/")
    if not base:
        base = "http://localhost:5173"
    # Token is placed in the hash fragment so it survives clients that rewrite query strings.
    return f"{base}/#/?magic_token={plain_token}"


def _send_magic_link_email(to_email: str, magic_url: str) -> bool:
    subject = "Your sign-in link — Chicago Advocate Legal, NFP"
    text = (
        "Hello,\n\n"
        f"Click the link below to sign in (expires in {MAGIC_LINK_TTL_MINUTES} minutes):\n"
        f"{magic_url}\n\n"
        "If you did not request this, you can ignore this email."
    )
    html = (
        "<p>Hello,</p>"
        "<p>Click the link below to sign in to the legal resource navigator. "
        f"This link expires in <strong>{MAGIC_LINK_TTL_MINUTES} minutes</strong>.</p>"
        f'<p><a href="{magic_url}" style="font-size:16px;padding:10px 20px;'
        'background:#1a56db;color:#fff;text-decoration:none;border-radius:6px;">'
        "Sign in</a></p>"
        "<p>If you did not request this, you can safely ignore this email.</p>"
    )
    return send_transactional_email(to_email, subject, text, html)


def request_magic_link(payload, db: Session) -> dict:
    email = str(payload.email).strip().lower()
    intake = find_intake_for_email(db, email)
    if not intake:
        # Anti-enumeration: always return success even when email is unknown.
        return {"status": "sent", "email_sent": True}

    plain = secrets.token_urlsafe(32)
    token_hash = hash_token(plain)
    now = utc_now()
    expires = now + timedelta(minutes=MAGIC_LINK_TTL_MINUTES)

    try:
        row = MagicLinkToken(
            email=email,
            token_hash=token_hash,
            created_at=now,
            expires_at=expires,
            consumed_at=None,
        )
        db.add(row)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    magic_url = _build_magic_url(plain)
    sent = _send_magic_link_email(email, magic_url)
    if not sent:
        print(f"Magic link for {email} (email not sent — check logs): {magic_url}")

    result: dict = {"status": "sent", "email_sent": bool(sent)}
    if not sent:
        if not email_provider_configured():
            result["delivery_hint"] = email_provider_hint()
        else:
            result["delivery_hint"] = (
                "Gmail API is configured but sending failed. Check backend logs for details."
            )
    if MAGIC_LINK_DEV_RETURN_TOKEN and dev_auth_links_in_response_allowed():
        result["dev_magic_link"] = magic_url
    return result


def verify_magic_link(payload, db: Session) -> dict:
    raw = (payload.token or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Invalid or expired link")

    th = hash_token(raw)
    now = utc_now()

    try:
        row = (
            db.query(MagicLinkToken)
            .filter(
                MagicLinkToken.token_hash == th,
                MagicLinkToken.consumed_at.is_(None),
                MagicLinkToken.expires_at > now,
            )
            .first()
        )
        if not row:
            raise HTTPException(status_code=400, detail="Invalid or expired link")

        intake = find_intake_for_email(db, row.email)
        if not intake:
            row.consumed_at = now
            db.add(row)
            db.commit()
            raise HTTPException(status_code=400, detail="Invalid or expired link")

        row.consumed_at = now
        db.add(row)
        db.commit()

        try:
            from ..services.intake_service import record_navigator_sign_in
        except ImportError:
            from services.intake_service import record_navigator_sign_in  # type: ignore

        record_navigator_sign_in(intake.id, db)

        return {"intake_id": intake.id, "email": intake.email}
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
