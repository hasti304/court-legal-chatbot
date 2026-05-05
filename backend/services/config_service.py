import os

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
TRIAGE_QUESTIONS_PATH = os.path.join(DATA_DIR, "triage_questions.json")
REFERRAL_MAP_PATH = os.path.join(DATA_DIR, "referral_map.json")
REFERRAL_OFFICE_GEO_PATH = os.path.join(DATA_DIR, "referral_office_geo.json")

SUPPORTED_LANGS = {"en", "es"}

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
ADMIN_EXPORT_KEY = os.getenv("ADMIN_EXPORT_KEY", "").strip()

# Admin dashboard (email + password → JWT). Legacy X-Admin-Key still works if ADMIN_EXPORT_KEY is set.
# Default is Chicago Advocate Legal’s operations inbox; override with ADMIN_EMAIL in .env or hosting env.
ADMIN_EMAIL = (os.getenv("ADMIN_EMAIL") or "chicagoadvocatelegal@gmail.com").strip().lower()
ADMIN_JWT_SECRET = os.getenv("ADMIN_JWT_SECRET", "").strip()
ADMIN_JWT_EXPIRE_MINUTES = int(os.getenv("ADMIN_JWT_EXPIRE_MINUTES", "480") or "480")

# Magic link sign-in (email must match an existing intake row)
FRONTEND_BASE_URL = os.getenv(
    "FRONTEND_BASE_URL",
    "http://localhost:5173",
).strip().rstrip("/")


def dev_auth_links_in_response_allowed() -> bool:
    """Never return sign-in/reset URLs in API JSON for public GitHub Pages (tokens in JSON are unsafe)."""
    base = (FRONTEND_BASE_URL or "").strip().lower()
    if "127.0.0.1" in base:
        return True
    return "://localhost" in base or base.startswith("http://localhost") or base.startswith("https://localhost")


MAGIC_LINK_TTL_MINUTES = int(os.getenv("MAGIC_LINK_TTL_MINUTES", "15") or "15")
MAGIC_LINK_DEV_RETURN_TOKEN = os.getenv("MAGIC_LINK_DEV_RETURN_TOKEN", "").strip().lower() in (
    "1",
    "true",
    "yes",
)
RESET_PASSWORD_DEV_RETURN_TOKEN = os.getenv("RESET_PASSWORD_DEV_RETURN_TOKEN", "").strip().lower() in (
    "1",
    "true",
    "yes",
)
RESET_PASSWORD_TTL_MINUTES = int(os.getenv("RESET_PASSWORD_TTL_MINUTES", "30") or "30")

# Gmail API OAuth2 — emails sent over HTTPS, no SMTP required.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
GOOGLE_REFRESH_TOKEN = os.getenv("GOOGLE_REFRESH_TOKEN", "").strip()
GOOGLE_SENDER_EMAIL = os.getenv("GOOGLE_SENDER_EMAIL", "").strip()

try:
    from ..database import engine
except ImportError:
    from database import engine  # type: ignore

groq_client = None
groq_configured = False

try:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("Warning: GROQ_API_KEY not found in environment variables")
    else:
        groq_client = Groq(api_key=api_key)
        groq_configured = True
        print("Groq client initialized successfully")
except Exception as e:
    print(f"Warning: Groq client initialization failed: {type(e).__name__}: {e}")
    groq_configured = False
