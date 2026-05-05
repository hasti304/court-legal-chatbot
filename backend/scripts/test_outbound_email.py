"""
Verify outbound email via Gmail API. Run from the backend folder:

  python scripts/test_outbound_email.py you@example.com
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from services.transactional_email import email_provider_hint, send_transactional_email  # noqa: E402


def main() -> int:
    to = (sys.argv[1] if len(sys.argv) > 1 else os.getenv("ADMIN_EMAIL", "").strip()).strip()
    if "@" not in to:
        print("Usage: python scripts/test_outbound_email.py recipient@example.com")
        return 1

    print(f"Sending test email to {to} via Gmail API...")
    ok = send_transactional_email(
        to,
        "CAL email test — Gmail API",
        "If you received this, Gmail API OAuth2 is configured correctly.",
        "<p>If you received this, <strong>Gmail API OAuth2</strong> is configured correctly.</p>",
    )

    if ok:
        print(f"OK: test message sent to {to}")
        return 0

    print(
        "FAILED. Check that these env vars are set correctly in .env:\n"
        "  GOOGLE_CLIENT_ID\n"
        "  GOOGLE_CLIENT_SECRET\n"
        "  GOOGLE_REFRESH_TOKEN\n"
        "  GOOGLE_SENDER_EMAIL\n\n"
        f"Current status: {email_provider_hint()}"
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
