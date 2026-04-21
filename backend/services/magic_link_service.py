import hashlib
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import httpx
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
        RESEND_API_KEY,
        RESEND_FROM,
        SMTP_FROM,
        SMTP_HOST,
        SMTP_PASSWORD,
        SMTP_PORT,
        SMTP_USER,
    )
except ImportError:
    from models.intake import Intake  # type: ignore
    from models.magic_link import MagicLinkToken  # type: ignore
    from services.config_service import (  # type: ignore
        FRONTEND_BASE_URL,
        MAGIC_LINK_DEV_RETURN_TOKEN,
        MAGIC_LINK_TTL_MINUTES,
        RESEND_API_KEY,
        RESEND_FROM,
        SMTP_FROM,
        SMTP_HOST,
        SMTP_PASSWORD,
        SMTP_PORT,
        SMTP_USER,
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
    return f"{base}/?magic_token={plain_token}"


def _send_via_resend(to_email: str, magic_url: str) -> bool:
    if not RESEND_API_KEY:
        return False
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": RESEND_FROM,
                    "to": [to_email],
                    "subject": "Your sign-in link — Chicago Advocate Legal, NFP",
                    "html": f"""
                    <p>Hello,</p>
                    <p>Click the link below to sign in to the legal resource navigator. This link expires in {MAGIC_LINK_TTL_MINUTES} minutes.</p>
                    <p><a href="{magic_url}">Sign in</a></p>
                    <p>If you did not request this, you can ignore this email.</p>
                    """,
                },
            )
        if r.status_code not in (200, 201):
            print(
                f"Warning: Resend magic link email failed with HTTP {r.status_code}: "
                f"{getattr(r, 'text', '')[:500]}"
            )
        return r.status_code in (200, 201)
    except Exception as e:
        print(f"Warning: Resend magic link email failed: {e}")
        return False


def _send_via_smtp(to_email: str, magic_url: str) -> bool:
    if not SMTP_HOST or not SMTP_FROM:
        return False
    try:
        port = int(SMTP_PORT or "587")
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Your sign-in link — Chicago Advocate Legal, NFP"
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        text = f"Sign in (copy link if button does not work):\n{magic_url}\n"
        html = f'<p><a href="{magic_url}">Sign in</a></p><p>This link expires in {MAGIC_LINK_TTL_MINUTES} minutes.</p>'
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(SMTP_HOST, port, timeout=30) as server:
            server.starttls()
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [to_email], msg.as_string())
        return True
    except Exception as e:
        print(f"Warning: SMTP magic link email failed: {e}")
        return False


def request_magic_link(payload, db: Session) -> dict:
    email = str(payload.email).strip().lower()
    intake = find_intake_for_email(db, email)
    if not intake:
        return {"status": "sent"}

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
    sent = _send_via_resend(email, magic_url) or _send_via_smtp(email, magic_url)
    if not sent:
        print(f"Magic link for {email} (configure RESEND_API_KEY or SMTP): {magic_url}")

    result: dict = {"status": "sent"}
    if MAGIC_LINK_DEV_RETURN_TOKEN:
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
