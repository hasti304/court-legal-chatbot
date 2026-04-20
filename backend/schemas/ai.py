from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class AIChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    topic: Optional[str] = None
    language: str = "en"
    intake_id: Optional[str] = None


class AIChatResponse(BaseModel):
    response: str
    usage: dict = Field(default_factory=dict)
