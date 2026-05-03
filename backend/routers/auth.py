import os

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

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
