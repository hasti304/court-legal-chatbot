import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class IntakeStartRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=5, max_length=255)
    phone: str = Field(min_length=10, max_length=30)
    zip: str = Field(default="", max_length=5)
    language: Optional[str] = "en"
    consent: bool
    password: Optional[str] = Field(default=None, min_length=8, max_length=255)

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("Name fields are required")
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        cleaned = (value or "").strip().lower()
        if "@" not in cleaned:
            raise ValueError("Valid email is required")
        return cleaned

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if len(re.sub(r"[^0-9]", "", cleaned)) < 10:
            raise ValueError("Valid phone is required")
        return cleaned

    @field_validator("zip")
    @classmethod
    def validate_zip_optional(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            return ""
        if not re.fullmatch(r"\d{5}", cleaned):
            raise ValueError("ZIP must be exactly 5 digits")
        return cleaned

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = str(value).strip()
        if not cleaned:
            return None
        if len(cleaned) < 8:
            raise ValueError("Password must be at least 8 characters")
        return cleaned


class IntakeStartResponse(BaseModel):
    status: str
    intake_id: str


class AdminIntakeCreateRequest(BaseModel):
    """Staff-created navigator account (same validation as public intake, without consent checkbox)."""

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=5, max_length=255)
    phone: str = Field(min_length=10, max_length=30)
    zip: str = Field(min_length=5, max_length=5, pattern=r"^\d{5}$")
    language: Optional[str] = "en"

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("Name fields are required")
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        cleaned = (value or "").strip().lower()
        if "@" not in cleaned:
            raise ValueError("Valid email is required")
        return cleaned

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if len(re.sub(r"[^0-9]", "", cleaned)) < 10:
            raise ValueError("Valid phone is required")
        return cleaned


class IntakeEventRequest(BaseModel):
    intake_id: str
    event_type: str
    event_value: Optional[str] = None


class IntakeSubmissionCreate(BaseModel):
    name: str
    email: str
    phone: str
    zip_code: str
    issue_type: str
    message: str


class IntakeSubmissionOut(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    zip_code: str
    issue_type: str
    message: str
    timestamp: datetime

    class Config:
        from_attributes = True
