import logging
import os

from fastapi import APIRouter, Body, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class DeleteAccountRequest(BaseModel):
    reason: str = ""

try:
    from ..database import get_db
    from ..schemas.auth import (
        MagicLinkRequestBody,
        MagicLinkRequestResponse,
        MagicLinkVerifyBody,
        MagicLinkVerifyResponse,
        PasswordForgotBody,
        PasswordForgotResponse,
        PasswordLoginBody,
        PasswordLoginResponse,
        PasswordResetBody,
        PasswordResetResponse,
    )
    from ..services.magic_link_service import request_magic_link, verify_magic_link
    from ..services.auth_password_service import (
        login_with_password,
        request_password_reset,
        reset_password,
    )
    from ..services.admin_auth_service import admin_login_configured
    from ..services.config_service import ADMIN_EMAIL, ADMIN_EXPORT_KEY, ADMIN_JWT_SECRET
    from ..services.transactional_email import email_provider_configured, email_provider_hint
except ImportError:
    from database import get_db  # type: ignore
    from schemas.auth import (  # type: ignore
        MagicLinkRequestBody,
        MagicLinkRequestResponse,
        MagicLinkVerifyBody,
        MagicLinkVerifyResponse,
        PasswordForgotBody,
        PasswordForgotResponse,
        PasswordLoginBody,
        PasswordLoginResponse,
        PasswordResetBody,
        PasswordResetResponse,
    )
    from services.magic_link_service import request_magic_link, verify_magic_link  # type: ignore
    from services.auth_password_service import (  # type: ignore
        login_with_password,
        request_password_reset,
        reset_password,
    )
    from services.admin_auth_service import admin_login_configured  # type: ignore
    from services.config_service import ADMIN_EMAIL, ADMIN_EXPORT_KEY, ADMIN_JWT_SECRET  # type: ignore
    from services.transactional_email import email_provider_configured, email_provider_hint  # type: ignore

router = APIRouter()


@router.post("/auth/magic-link/request", response_model=MagicLinkRequestResponse)
def magic_link_request(payload: MagicLinkRequestBody, db: Session = Depends(get_db)):
    return request_magic_link(payload=payload, db=db)


@router.post("/auth/magic-link/verify", response_model=MagicLinkVerifyResponse)
def magic_link_verify(payload: MagicLinkVerifyBody, db: Session = Depends(get_db)):
    return verify_magic_link(payload=payload, db=db)


@router.post("/auth/password/login", response_model=PasswordLoginResponse)
def password_login(payload: PasswordLoginBody, db: Session = Depends(get_db)):
    return login_with_password(payload=payload, db=db)


@router.get("/auth/verify-email")
def verify_email(token: str = "", db: Session = Depends(get_db)):
    token = (token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Missing verification token.")
    try:
        from ..services.email_verification_service import verify_email_token
    except ImportError:
        from services.email_verification_service import verify_email_token  # type: ignore
    return verify_email_token(token, db)


@router.post("/auth/resend-verification")
def resend_verification(email: str = Body(..., embed=True), db: Session = Depends(get_db)):
    email = (email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
    try:
        from ..services.email_verification_service import resend_verification_email
    except ImportError:
        from services.email_verification_service import resend_verification_email  # type: ignore
    return resend_verification_email(email, db)


@router.post("/auth/password/forgot", response_model=PasswordForgotResponse)
def password_forgot(payload: PasswordForgotBody, db: Session = Depends(get_db)):
    return request_password_reset(payload=payload, db=db)


@router.post("/auth/password/reset", response_model=PasswordResetResponse)
def password_reset(payload: PasswordResetBody, db: Session = Depends(get_db)):
    return reset_password(payload=payload, db=db)


@router.get("/auth/email-test")
def email_test(x_admin_key: str = Header(None)):
    """Send a test email to ADMIN_EMAIL. Protected by X-Admin-Key header."""
    if not ADMIN_EXPORT_KEY or x_admin_key != ADMIN_EXPORT_KEY:
        raise HTTPException(status_code=403, detail="Forbidden: provide X-Admin-Key header")
    try:
        from ..services.transactional_email import send_transactional_email
    except ImportError:
        from services.transactional_email import send_transactional_email  # type: ignore
    to = (ADMIN_EMAIL or "").strip()
    if not to:
        raise HTTPException(status_code=400, detail="ADMIN_EMAIL is not configured")
    ok = send_transactional_email(
        to,
        "CAL email test",
        "If you received this, outbound email is configured correctly on Render.",
        "<p>If you received this, outbound email is configured correctly on Render.</p>",
    )
    provider = email_provider_hint()
    if ok:
        return {"status": "ok", "sent_to": to, "provider": provider}
    return {"status": "failed", "sent_to": to, "provider": provider,
            "hint": "Check Render logs for the exact SMTP/Resend error."}


@router.get("/auth/me")
def get_me(x_intake_id: str = Header(None), db: Session = Depends(get_db)):
    intake_id = (x_intake_id or "").strip()
    if not intake_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        from ..models.intake import Intake
    except ImportError:
        from models.intake import Intake  # type: ignore
    intake = db.query(Intake).filter(Intake.id == intake_id).first()
    if not intake:
        raise HTTPException(status_code=401, detail="Invalid session")
    return {
        "intake_id": intake.id,
        "email": intake.email,
        "first_name": getattr(intake, "first_name", "") or "",
        "last_name": getattr(intake, "last_name", "") or "",
        "phone": getattr(intake, "phone", "") or "",
        "is_verified": bool(getattr(intake, "is_verified", True)),
    }


@router.patch("/auth/profile")
def update_profile(phone: str = Body(..., embed=True), x_intake_id: str = Header(None), db: Session = Depends(get_db)):
    intake_id = (x_intake_id or "").strip()
    if not intake_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        from ..models.intake import Intake
    except ImportError:
        from models.intake import Intake  # type: ignore
    intake = db.query(Intake).filter(Intake.id == intake_id).first()
    if not intake:
        raise HTTPException(status_code=401, detail="Invalid session")
    try:
        from ..services.intake_service import normalize_us_phone
    except ImportError:
        from services.intake_service import normalize_us_phone  # type: ignore
    try:
        phone_digits = normalize_us_phone(phone)
    except HTTPException:
        raise
    try:
        intake.phone = phone_digits
        db.add(intake)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return {"ok": True}


@router.delete("/auth/account")
def delete_account(
    body: DeleteAccountRequest = Body(default_factory=DeleteAccountRequest),
    x_intake_id: str = Header(None),
    db: Session = Depends(get_db),
):
    intake_id = (x_intake_id or "").strip()
    reason = (body.reason or "").strip()

    if not intake_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        from ..models.intake import Intake
        from ..models.magic_link import MagicLinkToken
        from ..models.password_reset import PasswordResetToken
        from ..models.email_verification import EmailVerificationToken
    except ImportError:
        from models.intake import Intake  # type: ignore
        from models.magic_link import MagicLinkToken  # type: ignore
        from models.password_reset import PasswordResetToken  # type: ignore
        from models.email_verification import EmailVerificationToken  # type: ignore

    try:
        intake = db.query(Intake).filter(Intake.id == intake_id).first()
        if not intake:
            raise HTTPException(status_code=401, detail="Invalid session")

        # Collect client info before deleting
        full_name = f"{getattr(intake, 'first_name', '') or ''} {getattr(intake, 'last_name', '') or ''}".strip()
        email = intake.email
        phone = getattr(intake, "phone", "") or ""
        zip_code = getattr(intake, "zip", "") or ""

        # Collect distinct topics from triage sessions
        topics_rows = db.execute(
            text("SELECT DISTINCT topic FROM triage_sessions WHERE intake_id = :iid AND topic IS NOT NULL"),
            {"iid": intake_id},
        ).fetchall()
        topics = [r[0] for r in topics_rows if r[0]]
        topics_str = ", ".join(topics) if topics else "None"

        # Send deletion notification — failure must not block deletion
        try:
            try:
                from ..services.gmail_service import send_email
            except ImportError:
                from services.gmail_service import send_email  # type: ignore

            subject = f"Account Deletion Notice — {full_name}"
            text_body = (
                f"A client has deleted their account.\n\n"
                f"Client Details:\n"
                f"Name: {full_name}\n"
                f"Email: {email}\n"
                f"Phone: {phone}\n"
                f"ZIP: {zip_code}\n"
                f"Issues Enquired About: {topics_str}\n\n"
                f"Reason for deletion: {reason or 'Not provided'}\n\n"
                f"This is an automated notification from Chicago Advocate Legal."
            )
            html_body = (
                f"<p>A client has deleted their account.</p>"
                f"<p><strong>Client Details:</strong><br>"
                f"Name: {full_name}<br>"
                f"Email: {email}<br>"
                f"Phone: {phone}<br>"
                f"ZIP: {zip_code}<br>"
                f"Issues Enquired About: {topics_str}</p>"
                f"<p><strong>Reason for deletion:</strong> {reason or 'Not provided'}</p>"
                f"<p><em>This is an automated notification from Chicago Advocate Legal.</em></p>"
            )
            ok = send_email(
                to_email="intake@chicagoadvocatelegal.com",
                subject=subject,
                html_body=html_body,
                text_body=text_body,
            )
            if not ok:
                logger.error("Account deletion email failed for intake_id=%s", intake_id)
        except Exception as email_exc:
            logger.error("Account deletion email error for intake_id=%s: %s", intake_id, email_exc)

        iid = intake_id
        db.execute(text("DELETE FROM evidence_files WHERE intake_id = :iid"), {"iid": iid})
        db.execute(text("DELETE FROM intake_events WHERE intake_id = :iid"), {"iid": iid})
        db.execute(text("DELETE FROM triage_sessions WHERE intake_id = :iid"), {"iid": iid})
        db.execute(text("DELETE FROM intake_deadlines WHERE intake_id = :iid"), {"iid": iid})
        if email:
            db.query(MagicLinkToken).filter(MagicLinkToken.email == email).delete(synchronize_session=False)
            db.query(PasswordResetToken).filter(PasswordResetToken.email == email).delete(synchronize_session=False)
            db.query(EmailVerificationToken).filter(EmailVerificationToken.email == email).delete(synchronize_session=False)
        db.delete(intake)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {"status": "deleted"}


@router.get("/auth/config-status")
def auth_config_status():
    has_pwd_hash = bool((os.getenv("ADMIN_PASSWORD_HASH") or "").strip())
    allow_plain = os.getenv("ADMIN_ALLOW_PLAIN_PASSWORD", "").strip().lower() in ("1", "true", "yes")
    has_plain_pwd = bool((os.getenv("ADMIN_PASSWORD") or "").strip())
    admin_password_ok = has_pwd_hash or has_plain_pwd
    admin_jwt_ok = bool((ADMIN_JWT_SECRET or "").strip() or (ADMIN_EXPORT_KEY or "").strip())

    hints: list[str] = []
    if not admin_password_ok:
        hints.append(
            "Set ADMIN_PASSWORD_HASH (bcrypt), or set ADMIN_PASSWORD."
        )
    if not admin_jwt_ok:
        hints.append("Set ADMIN_JWT_SECRET (or legacy ADMIN_EXPORT_KEY) so staff login can issue a token.")

    return {
        "admin_login_configured": bool(admin_login_configured()),
        "admin_ready_for_login": bool(admin_login_configured()) and admin_jwt_ok,
        "admin_password_configured": admin_password_ok,
        "admin_jwt_configured": admin_jwt_ok,
        "admin_email_effective": (ADMIN_EMAIL or "").strip().lower() or None,
        "email_provider_configured": bool(email_provider_configured()),
        "email_provider_hint": email_provider_hint(),
        "admin_setup_hints": hints,
    }
