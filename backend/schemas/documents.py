from typing import Optional

from pydantic import BaseModel, Field, field_validator


class DocumentEmailRequest(BaseModel):
    to_email: str = Field(min_length=5, max_length=255)
    subject: str = Field(min_length=3, max_length=180)
    body_text: str = Field(min_length=10, max_length=12000)
    html_body: Optional[str] = Field(default="", max_length=30000)
    attachment_filename: Optional[str] = Field(default="")
    attachment_base64: Optional[str] = Field(default="")
    intake_id: Optional[str] = None

    @field_validator("to_email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        cleaned = (value or "").strip().lower()
        if "@" not in cleaned:
            raise ValueError("Valid email is required")
        return cleaned

    @field_validator("subject")
    @classmethod
    def normalize_subject(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("Subject is required")
        return cleaned
