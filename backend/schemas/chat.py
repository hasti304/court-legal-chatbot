from typing import Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str
    conversation_state: dict = Field(default_factory=dict)
    language: Optional[str] = "en"
    intake_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str = ""
    response_key: Optional[str] = None
    response_params: dict = Field(default_factory=dict)
    options: list = Field(default_factory=list)
    referrals: list = Field(default_factory=list)
    conversation_state: dict = Field(default_factory=dict)
    progress: dict = Field(default_factory=dict)
