import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

try:
    from ..models.email_verification import EmailVerificationToken
    from ..models.intake import Intake
    from .config_service import FRONTEND_BASE_URL
    from .magic_link_service import find_intake_for_email, hash_token
    from .transactional_email import send_transactional_email
except ImportError:
    from models.email_verification import EmailVerificationToken  # type: ignore
    from models.intake import Intake  # type: ignore
    from services.config_service import FRONTEND_BASE_URL  # type: ignore
    from services.magic_link_service import find_intake_for_email, hash_token  # type: ignore
    from services.transactional_email import send_transactional_email  # type: ignore

logger = logging.getLogger(__name__)

EMAIL_VERIFY_TTL_MINUTES = 60 * 24  # 24 hours


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _build_verify_url(plain_token: str) -> str:
    base = (FRONTEND_BASE_URL or "").rstrip("/") or "http://localhost:5173"
    return f"{base}/#/?verify_token={plain_token}"


def send_verification_email(email: str, first_name: str, db: Session) -> bool:
    """Create a verification token and send the verification email. Returns True on success."""
    plain = secrets.token_urlsafe(32)
    token_hash = hash_token(plain)
    now = utc_now()
    expires = now + timedelta(minutes=EMAIL_VERIFY_TTL_MINUTES)

    try:
        db.query(EmailVerificationToken).filter(
            EmailVerificationToken.email == email,
            EmailVerificationToken.consumed_at.is_(None),
        ).delete(synchronize_session=False)

        db.add(
            EmailVerificationToken(
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

    verify_url = _build_verify_url(plain)
    greeting = (first_name or "").strip() or "Hello"
    subject = "Verify your email — Chicago Advocate Legal, NFP"
    text = (
        f"Hello {greeting},\n\n"
        "Thank you for registering with the Chicago Advocate Legal resource navigator. "
        "Please verify your email address by clicking the link below:\n\n"
        f"{verify_url}\n\n"
        "This link expires in 24 hours. If you did not register, you can ignore this email."
    )
    html = (
        f"<p>Hello {greeting},</p>"
        "<p>Thank you for registering with the Chicago Advocate Legal resource navigator.</p>"
        "<p>Please verify your email address by clicking the button below:</p>"
        f'<p><a href="{verify_url}" style="font-size:16px;padding:10px 20px;'
        'background:#1a56db;color:#fff;text-decoration:none;border-radius:6px;">'
        "Verify email</a></p>"
        "<p>This link expires in 24 hours. If you did not register, you can safely ignore this email.</p>"
    )
    sent = send_transactional_email(email, subject, text, html)
    if not sent:
        logger.warning(
            "Email verification message could not be delivered to %s. "
            "Check Gmail API configuration in backend logs.",
            email,
        )
    return sent


def verify_email_token(raw_token: str, db: Session) -> dict:
    """Mark a user's email as verified. Raises HTTPException on invalid/expired token."""
    if not raw_token:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link.")

    th = hash_token(raw_token)
    now = utc_now()

    try:
        row = (
            db.query(EmailVerificationToken)
            .filter(
                EmailVerificationToken.token_hash == th,
                EmailVerificationToken.consumed_at.is_(None),
                EmailVerificationToken.expires_at > now,
            )
            .first()
        )
        if not row:
            raise HTTPException(status_code=400, detail="Invalid or expired verification link.")

        intake = find_intake_for_email(db, row.email)
        if not intake:
            row.consumed_at = now
            db.add(row)
            db.commit()
            raise HTTPException(status_code=400, detail="Invalid or expired verification link.")

        intake.is_verified = True
        row.consumed_at = now
        db.add(intake)
        db.add(row)
        db.commit()
        return {"status": "verified", "email": row.email}
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def resend_verification_email(email: str, db: Session) -> dict:
    """Resend the verification email. Always returns success to prevent enumeration."""
    intake = find_intake_for_email(db, email)
    if not intake:
        return {"status": "sent"}

    if getattr(intake, "is_verified", False):
        return {"status": "already_verified"}

    first_name = getattr(intake, "first_name", "") or ""
    sent = send_verification_email(email, first_name, db)
    return {"status": "sent", "email_sent": sent}
