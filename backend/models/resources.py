from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

try:
    from ..database import Base
except ImportError:
    from database import Base  # type: ignore


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    category = Column(String(80), nullable=False, index=True)
    jurisdiction_country = Column(String(80), nullable=False, index=True)
    jurisdiction_state = Column(String(80), nullable=True, index=True)
    jurisdiction_city = Column(String(80), nullable=True, index=True)
    court_level = Column(String(80), nullable=True, index=True)
    case_types = Column(Text, nullable=False, default="[]")
    description = Column(Text, nullable=True)
    eligibility = Column(Text, nullable=True)
    cost_type = Column(String(40), nullable=True, index=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    website_url = Column(String(500), nullable=True)
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    postal_code = Column(String(20), nullable=True, index=True)
    hours = Column(String(255), nullable=True)
    languages = Column(Text, nullable=False, default="[]")
    action_label = Column(String(120), nullable=True)
    action_url = Column(String(500), nullable=True)
    source_name = Column(String(255), nullable=False)
    source_url = Column(String(500), nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=False, index=True, default=utc_now)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    priority_score = Column(Integer, nullable=False, default=0, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)
