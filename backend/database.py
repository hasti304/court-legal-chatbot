import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SQLITE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'app.db')}"
_raw = (os.getenv("DATABASE_URL") or "").strip() or DEFAULT_SQLITE_URL
# SQLAlchemy 2.x removed the legacy "postgres" dialect; Render still provides postgres:// URLs.
if _raw.startswith("postgres://"):
    _raw = _raw.replace("postgres://", "postgresql://", 1)
DATABASE_URL = _raw

engine_kwargs: dict = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
elif DATABASE_URL.startswith("postgresql"):
    # Managed Postgres (Render, etc.) requires TLS unless the URL already sets SSL params.
    lower = DATABASE_URL.lower()
    if "sslmode=" not in lower and "ssl=" not in lower:
        engine_kwargs["connect_args"] = {"sslmode": "require"}
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    try:
        from .models import intake  # noqa: F401
        from .models import resources  # noqa: F401
        from .models import magic_link  # noqa: F401
        from .models import password_reset  # noqa: F401
    except ImportError:
        from models import intake  # type: ignore # noqa: F401
        from models import resources  # type: ignore # noqa: F401
        from models import magic_link  # type: ignore # noqa: F401
        from models import password_reset  # type: ignore # noqa: F401

    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Warning: init_db could not create tables: {type(e).__name__}: {e}")
