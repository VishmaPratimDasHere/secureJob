"""Messaging schemas."""

from pydantic import BaseModel, validator
from datetime import datetime
from typing import Optional

MAX_MESSAGE_LENGTH = 5000
MAX_CONVERSATION_MEMBERS = 20


class ConversationCreate(BaseModel):
    member_ids: list[int]           # user IDs to add (creator auto-included)
    title: str = ""                 # optional, used for group chats
    is_group: bool = False

    @validator('member_ids')
    def validate_members(cls, v):
        if len(v) < 1:
            raise ValueError('At least one other member is required')
        if len(v) > MAX_CONVERSATION_MEMBERS:
            raise ValueError(f'Maximum {MAX_CONVERSATION_MEMBERS} members per conversation')
        if len(v) != len(set(v)):
            raise ValueError('Duplicate member IDs are not allowed')
        return v

    @validator('title')
    def validate_title(cls, v):
        if v and len(v) > 100:
            raise ValueError('Title must be at most 100 characters')
        return v


class MessageCreate(BaseModel):
    body: str                       # plaintext; will be encrypted server-side

    @validator('body')
    def validate_body(cls, v):
        if not v or not v.strip():
            raise ValueError('Message body cannot be empty')
        if len(v) > MAX_MESSAGE_LENGTH:
            raise ValueError(f'Message must be at most {MAX_MESSAGE_LENGTH} characters')
        return v.strip()


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_name: str = ""
    body: str                       # decrypted for the recipient
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: int
    title: str
    is_group: bool
    created_by: int
    created_at: datetime
    member_ids: list[int] = []
    member_names: list[str] = []
    last_message: Optional[MessageResponse] = None

    class Config:
        from_attributes = True
