import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SQLITE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'app.db')}"
_raw_url = os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL)
# Render (and some other hosts) provide postgres:// URLs; SQLAlchemy requires postgresql://
DATABASE_URL = _raw_url.replace("postgres://", "postgresql://", 1) if _raw_url.startswith("postgres://") else _raw_url

engine_kwargs: dict = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
elif DATABASE_URL.startswith("postgresql"):
    # Render and other managed PostgreSQL hosts require SSL; add it when not already specified in the URL.
    if "sslmode" not in DATABASE_URL:
        engine_kwargs["connect_args"] = {"sslmode": "require"}

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
