"""Send transactional email via Gmail API (OAuth2). No SMTP."""

from __future__ import annotations

try:
    from .gmail_service import gmail_api_configured, send_email
    from .config_service import (
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REFRESH_TOKEN,
        GOOGLE_SENDER_EMAIL,
    )
except ImportError:
    from services.gmail_service import gmail_api_configured, send_email  # type: ignore
    from services.config_service import (  # type: ignore
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REFRESH_TOKEN,
        GOOGLE_SENDER_EMAIL,
    )


def email_provider_configured() -> bool:
    return gmail_api_configured()


def email_provider_hint() -> str:
    if gmail_api_configured():
        return "Gmail API (OAuth2) is configured."
    missing = [
        name
        for name, val in {
            "GOOGLE_CLIENT_ID": GOOGLE_CLIENT_ID,
            "GOOGLE_CLIENT_SECRET": GOOGLE_CLIENT_SECRET,
            "GOOGLE_REFRESH_TOKEN": GOOGLE_REFRESH_TOKEN,
            "GOOGLE_SENDER_EMAIL": GOOGLE_SENDER_EMAIL,
        }.items()
        if not val
    ]
    return f"Gmail API not configured. Missing env vars: {', '.join(missing)}."


def send_transactional_email(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
    attachment_bytes: bytes | None = None,
    attachment_filename: str = "",
    attachment_content_type: str = "application/pdf",
) -> bool:
    to_email = (to_email or "").strip()
    subject = (subject or "").strip()
    text_body = text_body or ""
    html_body = html_body or ""

    if not to_email or "@" not in to_email or not subject:
        return False

    if not email_provider_configured():
        print(f"Warning: {email_provider_hint()}")
        return False

    return send_email(
        to_email=to_email,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        attachment_bytes=attachment_bytes,
        attachment_filename=attachment_filename,
        attachment_content_type=attachment_content_type,
    )
