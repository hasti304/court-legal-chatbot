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
    "https://hasti304.github.io/court-legal-chatbot",
).strip().rstrip("/")
MAGIC_LINK_TTL_MINUTES = int(os.getenv("MAGIC_LINK_TTL_MINUTES", "20") or "20")
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

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_FROM = os.getenv("RESEND_FROM", "CAL Login <onboarding@resend.dev>").strip()

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = os.getenv("SMTP_PORT", "587").strip()
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM = os.getenv("SMTP_FROM", "").strip()

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
