from pydantic import BaseModel
from typing import Optional


# ------ Requests ------

# send to api to start a new chat session for a user
class StartSessionRequest(BaseModel):
    user_id: int

# send to api user msg to get reply from bot
class SendMessageRequest(BaseModel):
    session_id: int
    user_id: int
    message: str


# ------ Responses ------

# response from api after starting a new chat session
class SessionResponse(BaseModel):
    session_id: int
    message: str


# response from api from bot
class MessageResponse(BaseModel):
    reply: str
    complaint_ready: bool
    collected_data: Optional[dict] = None

