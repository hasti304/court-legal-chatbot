"""Send email via Gmail API using OAuth2 refresh token. No SMTP, no interactive login."""

from __future__ import annotations

import base64
import logging
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
_TOKEN_URI = "https://oauth2.googleapis.com/token"

# Cache the access token in memory; valid for ~1 hour, auto-refreshed on expiry.
_cached_credentials: Optional[Credentials] = None


def _load_config() -> tuple[str, str, str, str]:
    try:
        from .config_service import (
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            GOOGLE_REFRESH_TOKEN,
            GOOGLE_SENDER_EMAIL,
        )
    except ImportError:
        from services.config_service import (  # type: ignore
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            GOOGLE_REFRESH_TOKEN,
            GOOGLE_SENDER_EMAIL,
        )
    return GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_SENDER_EMAIL


def gmail_api_configured() -> bool:
    client_id, client_secret, refresh_token, sender_email = _load_config()
    return bool(client_id and client_secret and refresh_token and sender_email)


def _get_credentials() -> Credentials:
    global _cached_credentials

    client_id, client_secret, refresh_token, _ = _load_config()
    if not all([client_id, client_secret, refresh_token]):
        raise RuntimeError(
            "Gmail API not configured. "
            "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN."
        )

    if _cached_credentials and _cached_credentials.valid:
        return _cached_credentials

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri=_TOKEN_URI,
        client_id=client_id,
        client_secret=client_secret,
        scopes=_SCOPES,
    )
    creds.refresh(Request())
    _cached_credentials = creds
    return creds


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str = "",
    attachment_bytes: Optional[bytes] = None,
    attachment_filename: str = "",
    attachment_content_type: str = "application/pdf",
) -> bool:
    """Send an email via Gmail API. Returns True on success, False on failure."""
    _, _, _, sender_email = _load_config()
    sender = (sender_email or "").strip()

    if not sender:
        logger.error("Gmail API: GOOGLE_SENDER_EMAIL is not set")
        return False

    try:
        creds = _get_credentials()
    except RuntimeError as e:
        logger.error("Gmail API credentials error: %s", e)
        return False
    except Exception as e:
        logger.error("Gmail API token refresh failed: %s: %s", type(e).__name__, e)
        return False

    has_attachment = bool(attachment_bytes and attachment_filename)

    if has_attachment:
        outer = MIMEMultipart("mixed")
        outer["Subject"] = subject
        outer["From"] = sender
        outer["To"] = to_email
        alt = MIMEMultipart("alternative")
        if text_body:
            alt.attach(MIMEText(text_body, "plain", "utf-8"))
        alt.attach(MIMEText(html_body, "html", "utf-8"))
        outer.attach(alt)
        part = MIMEApplication(attachment_bytes, _subtype="pdf")
        part.add_header("Content-Disposition", "attachment", filename=attachment_filename)
        outer.attach(part)
        msg = outer
    else:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = sender
        msg["To"] = to_email
        if text_body:
            msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")

    try:
        # cache_discovery=False avoids ephemeral filesystem issues on cloud hosts like Render.
        service = build("gmail", "v1", credentials=creds, cache_discovery=False)
        service.users().messages().send(userId="me", body={"raw": raw}).execute()
        logger.info("Gmail API: email sent successfully to %s", to_email)
        return True
    except HttpError as e:
        logger.error(
            "Gmail API HttpError sending to %s: status=%s details=%s",
            to_email,
            e.status_code,
            e.error_details,
        )
        return False
    except Exception as e:
        logger.error(
            "Gmail API unexpected error sending to %s: %s: %s",
            to_email,
            type(e).__name__,
            e,
        )
        return False
