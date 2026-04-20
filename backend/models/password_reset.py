from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String

try:
    from ..database import Base
except ImportError:
    from database import Base  # type: ignore


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
