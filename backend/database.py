import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SQLITE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'app.db')}"
_raw_url = os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL)
# Render (and some other hosts) provide postgres:// URLs; SQLAlchemy requires postgresql://
DATABASE_URL = _raw_url.replace("postgres://", "postgresql://", 1) if _raw_url.startswith("postgres://") else _raw_url

engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

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

    Base.metadata.create_all(bind=engine)
