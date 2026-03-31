"""Messaging router — encrypted one-to-one and group conversations."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.encryption import encrypt_file, decrypt_file
from app.core.audit import log_event
from app.models.user import User
from app.models.messaging import Conversation, Message, conversation_members
from app.schemas.messaging import (
    ConversationCreate, ConversationResponse,
    MessageCreate, MessageResponse,
)

router = APIRouter(prefix="/messages", tags=["Messaging"])


@router.get("/health")
def health_check():
    return {"status": "healthy", "service": "messaging"}


# ─── helpers ──────────────────────────────────────────────────────────────────

def _encrypt_body(text: str) -> str:
    """Fernet-encrypt a message body; store as latin-1 text in the DB."""
    return encrypt_file(text.encode("utf-8")).decode("latin-1")


def _decrypt_body(stored: str) -> str:
    """Reverse of _encrypt_body."""
    return decrypt_file(stored.encode("latin-1")).decode("utf-8")


def _conversation_response(conv: Conversation) -> dict:
    members = list(conv.members)
    last_msg = conv.messages[-1] if conv.messages else None
    return {
        "id": conv.id,
        "title": conv.title,
        "is_group": conv.is_group,
        "created_by": conv.created_by,
        "created_at": conv.created_at,
        "member_ids": [m.id for m in members],
        "member_names": [m.full_name or m.username for m in members],
        "last_message": _message_response(last_msg) if last_msg else None,
    }


def _message_response(msg: Message) -> dict:
    try:
        body = _decrypt_body(msg.encrypted_body)
    except Exception:
        body = "[decryption error]"
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "sender_name": (msg.sender.full_name or msg.sender.username) if msg.sender else "",
        "body": body,
        "created_at": msg.created_at,
    }


# ─── conversations ────────────────────────────────────────────────────────────

@router.get("/conversations", response_model=list[ConversationResponse])
def list_conversations(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List conversations the current user is a member of."""
    convs = (
        db.query(Conversation)
        .join(conversation_members)
        .filter(conversation_members.c.user_id == current_user.id)
        .all()
    )
    return [_conversation_response(c) for c in convs]


@router.post("/conversations", response_model=ConversationResponse, status_code=201)
def create_conversation(
    data: ConversationCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a new conversation (DM or group)."""
    all_member_ids = set(data.member_ids) | {current_user.id}
    if len(all_member_ids) < 2:
        raise HTTPException(status_code=400, detail="A conversation needs at least two members")

    users = db.query(User).filter(User.id.in_(all_member_ids)).all()
    if len(users) != len(all_member_ids):
        raise HTTPException(status_code=400, detail="One or more user IDs are invalid")

    is_group = data.is_group or len(all_member_ids) > 2

    # For 1-on-1, prevent duplicates
    if not is_group:
        other_id = (all_member_ids - {current_user.id}).pop()
        existing = (
            db.query(Conversation)
            .join(conversation_members)
            .filter(
                Conversation.is_group == False,
                conversation_members.c.user_id == current_user.id,
            )
            .all()
        )
        for conv in existing:
            ids = {m.id for m in conv.members}
            if ids == all_member_ids:
                return _conversation_response(conv)

    conv = Conversation(
        title=data.title if is_group else "",
        is_group=is_group,
        created_by=current_user.id,
    )
    db.add(conv)
    db.flush()
    conv.members = users
    log_event(db, action="conversation.create", request=request, user_id=current_user.id,
              target_type="conversation", target_id=conv.id,
              detail=f"{'group' if is_group else 'dm'} with {len(users)} members")
    db.commit()
    db.refresh(conv)
    return _conversation_response(conv)


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.id not in [m.id for m in conv.members]:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")
    return _conversation_response(conv)


# ─── messages ─────────────────────────────────────────────────────────────────

@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
def list_messages(
    conversation_id: int,
    skip: int = Query(0, ge=0, le=10000),
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get messages in a conversation (must be a member)."""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.id not in [m.id for m in conv.members]:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_message_response(m) for m in msgs]


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=201)
def send_message(
    conversation_id: int,
    data: MessageCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Send an encrypted message in a conversation."""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.id not in [m.id for m in conv.members]:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    if not data.body or not data.body.strip():
        raise HTTPException(status_code=400, detail="Message body cannot be empty")

    encrypted = _encrypt_body(data.body.strip())
    msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        encrypted_body=encrypted,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _message_response(msg)


# ─── Utility: list platform users for starting conversations ──────────────────

@router.get("/users", response_model=list[dict])
def search_users(
    q: str = "",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Search users to start a conversation with."""
    query = db.query(User).filter(User.id != current_user.id, User.is_active == True)
    if q:
        pattern = f"%{q}%"
        query = query.filter(
            (User.username.ilike(pattern)) | (User.full_name.ilike(pattern))
        )
    users = query.limit(20).all()
    return [{"id": u.id, "username": u.username, "full_name": u.full_name or u.username} for u in users]
