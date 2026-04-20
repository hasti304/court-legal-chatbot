"""Send one-off transactional messages via Resend or SMTP (same config as magic links)."""

from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

try:
    from ..services.config_service import (
        RESEND_API_KEY,
        RESEND_FROM,
        SMTP_FROM,
        SMTP_HOST,
        SMTP_PASSWORD,
        SMTP_PORT,
        SMTP_USER,
    )
except ImportError:
    from services.config_service import (  # type: ignore
        RESEND_API_KEY,
        RESEND_FROM,
        SMTP_FROM,
        SMTP_HOST,
        SMTP_PASSWORD,
        SMTP_PORT,
        SMTP_USER,
    )


def send_transactional_email(to_email: str, subject: str, text_body: str, html_body: str) -> bool:
    to_email = (to_email or "").strip()
    subject = (subject or "").strip()
    text_body = text_body or ""
    html_body = html_body or ""
    if not to_email or "@" not in to_email or not subject:
        return False

    if RESEND_API_KEY:
        try:
            with httpx.Client(timeout=25.0) as client:
                r = client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {RESEND_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": RESEND_FROM,
                        "to": [to_email],
                        "subject": subject,
                        "text": text_body,
                        "html": html_body,
                    },
                )
            if r.status_code not in (200, 201):
                print(
                    f"Warning: Resend email failed HTTP {r.status_code}: "
                    f"{getattr(r, 'text', '')[:500]}"
                )
            return r.status_code in (200, 201)
        except Exception as e:
            print(f"Warning: Resend transactional email failed: {e}")
            return False

    if SMTP_HOST and SMTP_FROM:
        if (SMTP_USER or "").strip() and not (SMTP_PASSWORD or "").strip():
            print(
                "Warning: SMTP_USER is set but SMTP_PASSWORD is empty. "
                "Set SMTP_PASSWORD (e.g. Gmail App Password) or use RESEND_API_KEY."
            )
            return False
        try:
            port = int(SMTP_PORT or "587")
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = SMTP_FROM
            msg["To"] = to_email
            msg.attach(MIMEText(text_body, "plain", "utf-8"))
            msg.attach(MIMEText(html_body, "html", "utf-8"))
            with smtplib.SMTP(SMTP_HOST, port, timeout=30) as server:
                server.starttls()
                if SMTP_USER and SMTP_PASSWORD:
                    server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM, [to_email], msg.as_string())
            return True
        except Exception as e:
            print(f"Warning: SMTP transactional email failed: {e}")
            return False

    print("Warning: No email provider configured (RESEND_API_KEY or SMTP_HOST + SMTP_FROM).")
    return False
