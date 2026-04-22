import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from .database import init_db
    from .services.intake_service import ensure_tables
    from .routers.core import router as core_router
    from .routers.intake import router as intake_router
    from .routers.admin import router as admin_router
    from .routers.chat import router as chat_router
    from .routers.ai import router as ai_router
    from .routers.resources import router as resources_router
    from .routers.auth import router as auth_router
    from .routers.documents import router as documents_router
except ImportError:
    from database import init_db
    from services.intake_service import ensure_tables  # type: ignore
    from routers.core import router as core_router  # type: ignore
    from routers.intake import router as intake_router  # type: ignore
    from routers.admin import router as admin_router  # type: ignore
    from routers.chat import router as chat_router  # type: ignore
    from routers.ai import router as ai_router  # type: ignore
    from routers.resources import router as resources_router  # type: ignore
    from routers.auth import router as auth_router  # type: ignore
    from routers.documents import router as documents_router  # type: ignore

app = FastAPI()


@app.on_event("startup")
def startup_event():
    init_db()
    ensure_tables()
    try:
        from .services import config_service as _cfg
    except ImportError:
        from services import config_service as _cfg  # type: ignore
    if not getattr(_cfg, "RESEND_API_KEY", "") and not (
        getattr(_cfg, "SMTP_HOST", "") and getattr(_cfg, "SMTP_FROM", "")
    ):
        print(
            "Warning: Magic link email is not configured. "
            "Set RESEND_API_KEY (recommended) or SMTP_HOST + SMTP_FROM (+ user/password). "
            "Without that, sign-in links are only printed in server logs. "
            "For local testing only, set MAGIC_LINK_DEV_RETURN_TOKEN=true to return the link in the API JSON."
        )

def _split_csv_env(name: str) -> list[str]:
    raw = os.getenv(name, "")
    return [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]


_BASE_ALLOWED_ORIGINS = [
    "https://court-legal-chatbot-frontend.onrender.com",
    "https://hasti304.github.io",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
ALLOWED_ORIGINS = list(dict.fromkeys([*_BASE_ALLOWED_ORIGINS, *_split_csv_env("CORS_ALLOWED_ORIGINS")]))

# Browsers treat localhost and 127.0.0.1 as different origins; Authorization header triggers preflight.
# Keep regex strict and explicit so Render frontend deployments always receive ACAO headers.
_DEFAULT_CORS_ORIGIN_REGEX = r"^https://([a-z0-9-]+)\.onrender\.com$|^http://(localhost|127\.0\.0\.1)(:\d+)?$"
_custom_cors_regex = os.getenv("CORS_ALLOWED_ORIGIN_REGEX", "").strip()
_CORS_ORIGIN_REGEX = (
    f"(?:{_DEFAULT_CORS_ORIGIN_REGEX})|(?:{_custom_cors_regex})"
    if _custom_cors_regex
    else _DEFAULT_CORS_ORIGIN_REGEX
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=_CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)
app.include_router(core_router)
app.include_router(intake_router)
app.include_router(admin_router)
app.include_router(chat_router)
app.include_router(ai_router)
app.include_router(resources_router)
app.include_router(auth_router)
app.include_router(documents_router)