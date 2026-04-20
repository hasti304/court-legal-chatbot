"""
Verify outbound email config (Resend or SMTP). Run from backend folder:

  python scripts/test_outbound_email.py you@example.com

Uses the same settings as magic links and admin intake notifications.
"""

from __future__ import annotations

import os
import sys

# Ensure backend package imports resolve when run as script
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from services.transactional_email import send_transactional_email  # noqa: E402


def main() -> int:
    to = (sys.argv[1] if len(sys.argv) > 1 else os.getenv("ADMIN_EMAIL", "").strip()).strip()
    if "@" not in to:
        print("Usage: python scripts/test_outbound_email.py recipient@example.com")
        return 1
    ok = send_transactional_email(
        to,
        "CAL email test",
        "If you received this, outbound email is configured correctly.",
        "<p>If you received this, outbound email is configured correctly.</p>",
    )
    if ok:
        print(f"OK: test message sent to {to}")
        return 0
    print(
        "FAILED: set RESEND_API_KEY (+ RESEND_FROM) or SMTP_HOST + SMTP_FROM + SMTP_USER + SMTP_PASSWORD "
        "in .env, then restart the API."
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
