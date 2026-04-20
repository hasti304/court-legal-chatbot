from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


def normalize_string_list(values: Optional[List[str]]) -> List[str]:
    if not values:
        return []
    return [str(v).strip() for v in values if str(v).strip()]


class ResourceCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    category: str = Field(min_length=2, max_length=80)
    jurisdiction_country: str = Field(min_length=2, max_length=80)
    jurisdiction_state: Optional[str] = Field(default=None, max_length=80)
    jurisdiction_city: Optional[str] = Field(default=None, max_length=80)
    court_level: Optional[str] = Field(default=None, max_length=80)
    case_types: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    eligibility: Optional[str] = None
    cost_type: Optional[str] = Field(default=None, max_length=40)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=255)
    website_url: Optional[str] = Field(default=None, max_length=500)
    address_line1: Optional[str] = Field(default=None, max_length=255)
    address_line2: Optional[str] = Field(default=None, max_length=255)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    hours: Optional[str] = Field(default=None, max_length=255)
    languages: List[str] = Field(default_factory=list)
    action_label: Optional[str] = Field(default=None, max_length=120)
    action_url: Optional[str] = Field(default=None, max_length=500)
    source_name: str = Field(min_length=2, max_length=255)
    source_url: str = Field(min_length=5, max_length=500)
    verified_at: Optional[datetime] = None
    is_active: bool = True
    priority_score: int = 0

    @field_validator("title", "category", "jurisdiction_country", "source_name", "source_url")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("Field is required")
        return cleaned

    @field_validator("case_types", "languages")
    @classmethod
    def validate_lists(cls, value: List[str]) -> List[str]:
        return normalize_string_list(value)


class ResourceUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=255)
    category: Optional[str] = Field(default=None, min_length=2, max_length=80)
    jurisdiction_country: Optional[str] = Field(default=None, min_length=2, max_length=80)
    jurisdiction_state: Optional[str] = Field(default=None, max_length=80)
    jurisdiction_city: Optional[str] = Field(default=None, max_length=80)
    court_level: Optional[str] = Field(default=None, max_length=80)
    case_types: Optional[List[str]] = None
    description: Optional[str] = None
    eligibility: Optional[str] = None
    cost_type: Optional[str] = Field(default=None, max_length=40)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=255)
    website_url: Optional[str] = Field(default=None, max_length=500)
    address_line1: Optional[str] = Field(default=None, max_length=255)
    address_line2: Optional[str] = Field(default=None, max_length=255)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    hours: Optional[str] = Field(default=None, max_length=255)
    languages: Optional[List[str]] = None
    action_label: Optional[str] = Field(default=None, max_length=120)
    action_url: Optional[str] = Field(default=None, max_length=500)
    source_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    source_url: Optional[str] = Field(default=None, min_length=5, max_length=500)
    verified_at: Optional[datetime] = None
    is_active: Optional[bool] = None
    priority_score: Optional[int] = None

    @field_validator(
        "title", "category", "jurisdiction_country", "source_name", "source_url",
        mode="before"
    )
    @classmethod
    def validate_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field cannot be blank")
        return cleaned

    @field_validator("case_types", "languages")
    @classmethod
    def validate_optional_lists(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return value
        return normalize_string_list(value)


class ResourceOut(BaseModel):
    id: int
    title: str
    category: str
    jurisdiction_country: str
    jurisdiction_state: Optional[str]
    jurisdiction_city: Optional[str]
    court_level: Optional[str]
    case_types: List[str] = Field(default_factory=list)
    description: Optional[str]
    eligibility: Optional[str]
    cost_type: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    website_url: Optional[str]
    address_line1: Optional[str]
    address_line2: Optional[str]
    postal_code: Optional[str]
    hours: Optional[str]
    languages: List[str] = Field(default_factory=list)
    action_label: Optional[str]
    action_url: Optional[str]
    source_name: str
    source_url: str
    verified_at: datetime
    is_active: bool
    priority_score: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ResourceSuggestionOut(BaseModel):
    resource: ResourceOut
    match_reasons: List[str] = Field(default_factory=list)
    last_verified_days_ago: int


class ResourceBulkImportResult(BaseModel):
    created_count: int
    skipped_count: int
    errors: List[str] = Field(default_factory=list)
