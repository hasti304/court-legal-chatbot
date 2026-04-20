from typing import Optional

from pydantic import BaseModel, Field, field_validator


class MagicLinkRequestBody(BaseModel):
    email: str = Field(min_length=5, max_length=255)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        cleaned = (v or "").strip().lower()
        local, _, domain = cleaned.partition("@")
        if not local or not domain or "@" in domain:
            raise ValueError("Valid email is required")
        return cleaned


class MagicLinkRequestResponse(BaseModel):
    """Same core shape to avoid email enumeration; optional dev-only field."""

    status: str = "sent"
    dev_magic_link: Optional[str] = None


class MagicLinkVerifyBody(BaseModel):
    token: str = Field(min_length=16, max_length=512)


class MagicLinkVerifyResponse(BaseModel):
    intake_id: str
    email: str


class PasswordLoginBody(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=255)

    @field_validator("email")
    @classmethod
    def normalize_email_login(cls, v: str) -> str:
        cleaned = (v or "").strip().lower()
        local, _, domain = cleaned.partition("@")
        if not local or not domain or "@" in domain:
            raise ValueError("Valid email is required")
        return cleaned


class PasswordLoginResponse(BaseModel):
    intake_id: str
    email: str


class PasswordForgotBody(BaseModel):
    email: str = Field(min_length=5, max_length=255)

    @field_validator("email")
    @classmethod
    def normalize_email_forgot(cls, v: str) -> str:
        cleaned = (v or "").strip().lower()
        local, _, domain = cleaned.partition("@")
        if not local or not domain or "@" in domain:
            raise ValueError("Valid email is required")
        return cleaned


class PasswordForgotResponse(BaseModel):
    status: str = "sent"
    dev_reset_link: Optional[str] = None


class PasswordResetBody(BaseModel):
    token: str = Field(min_length=16, max_length=512)
    new_password: str = Field(min_length=8, max_length=255)


class PasswordResetResponse(BaseModel):
    status: str = "ok"
