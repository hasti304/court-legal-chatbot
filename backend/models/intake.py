from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, String, Text, Integer

try:
    from ..database import Base
except ImportError:
    from database import Base  # type: ignore


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class IntakeSubmission(Base):
    __tablename__ = "intake_submissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=False)
    zip_code = Column(String(10), nullable=False, index=True)
    issue_type = Column(String(100), nullable=False, index=True)
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)


class Intake(Base):
    __tablename__ = "intakes"

    id = Column(String(64), primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=False)
    zip = Column(String(10), nullable=False, index=True)
    language = Column(String(10), nullable=False, default="en")
    consent = Column(Boolean, nullable=False, default=True)
    created_at = Column(String(64), nullable=False, index=True)
    admin_status = Column(String(20), nullable=False, default="pending", index=True)
    password_hash = Column(String(255), nullable=True)
    login_count = Column(Integer, nullable=False, default=0)
