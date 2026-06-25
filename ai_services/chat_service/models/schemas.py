from pydantic import BaseModel, Field
from typing import Optional


# --- Requests ---

class StartSessionRequest(BaseModel):
    user_id: int


class SendMessageRequest(BaseModel):
    session_id: int
    user_id: int
    message: str = Field(..., min_length=1, max_length=1500)
    attachment_url: Optional[str] = None


# --- Responses ---

class SessionResponse(BaseModel):
    session_id: int
    message: str


class MessageResponse(BaseModel):
    reply: str
    complaint_ready: bool
    complaint_id: Optional[int] = None
    collected_data: Optional[dict] = None