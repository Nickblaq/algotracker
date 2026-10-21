"""
Chat and conversation API endpoints.

- POST /api/chat/send       Store a user message and build the model prompt.
                            Retrieval is read-only: the graph is untouched.
- POST /api/chat/respond    Store the assistant reply and reinforce the turn
                            (one transaction: reply + weight boosts together).
- GET  /api/chat/history    Conversation history for a session
- GET  /api/chat/sessions   Every session, newest activity first
- POST /api/chat/truncate   Delete the messages strictly between two messages
- POST /api/chat/clear      Clear a specific session
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..memory_manager import MemoryManager
from ..schemas import (
    ChatRequest,
    ConversationMessageResponse,
    RespondRequest,
    SessionListResponse,
    TruncateRequest,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


async def _manager(session: AsyncSession = Depends(get_session)) -> MemoryManager:
    return MemoryManager(session)


# The memories are context, not a script. Nothing in the prompt asks the model
# to narrate recalls — that only bloats every reply.
SYSTEM_PROMPT_TEMPLATE = (
    "You are a precise, well-organised assistant with access to a memory of "
    "previous conversations.\n\n"
    "Relevant memories are provided below. Use them silently: never mention "
    "them, never say you recall something, never narrate your reasoning.\n\n"
    "House style:\n"
    "- Lead with the answer. No preamble, no restating the question.\n"
    "- Short paragraphs or tight bullet lists; headings only for genuinely "
    "multi-part answers.\n"
    "- Be concrete. Cut hedging, filler and pleasantries.\n"
    "- Match the user's language and depth; they will ask if they want more.\n"
    "- Use markdown only where it helps scanning: lists, bold for key terms, "
    "fenced code blocks for code.\n\n"
    "Memories (weight in brackets):\n{context}\n"
)


@router.post("/send")
async def send_message(
    body: ChatRequest,
    manager: MemoryManager = Depends(_manager),
):
    """
    Store a user message in a session and build the prompt for the model.

    Retrieval here does not modify the graph — memories only gain weight when
    the assistant reply is stored via /api/chat/respond, so a stopped or
    abandoned request leaves weights, access counts and edges untouched.
    """
    session_id = body.session_id or "default"
    user_msg, memories_retrieved = await manager.process_user_message(
        body.content, session_id
    )

    # Build context for the LLM — memories carry their emergent weight
    context_parts = [f"[w={m.effective_weight():.2f}] {m.content}" for m in memories_retrieved]
    context_block = "\n".join(context_parts) if context_parts else "(none yet)"

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(context=context_block)

    # Get last 10 messages for this session
    history = await manager.get_conversation_history(session_id=session_id, limit=10)
    chat_messages = [{"role": m.role, "content": m.content} for m in history]

    await manager.session.commit()

    return {
        "message": ConversationMessageResponse(**user_msg.to_dict()).model_dump(),
        "memoriesAccessed": await manager.serialize_memories(memories_retrieved),
        "suggestedPrompt": {
            "system": system_prompt,
            "messages": chat_messages,
        },
    }


@router.post("/respond")
async def store_response(
    body: RespondRequest,
    manager: MemoryManager = Depends(_manager),
):
    """Store an assistant reply and reinforce what the turn recalled.

    Both writes happen in one transaction, so a completed turn is atomic.
    `reinforce: false` is for echoes that should not affect the graph, such as
    storing a client-side error notice.
    """
    session_id = body.session_id or "default"
    msg = await manager.process_assistant_response(
        body.content, session_id, reinforce=body.reinforce
    )
    await manager.session.commit()
    return ConversationMessageResponse(**msg.to_dict())


@router.get("/history")
async def get_history(
    session_id: str = "default",
    limit: int = 50,
    manager: MemoryManager = Depends(_manager),
):
    """Get conversation history for a specific session, oldest first."""
    msgs = await manager.get_conversation_history(session_id=session_id, limit=limit)
    return [ConversationMessageResponse(**m.to_dict()) for m in msgs]


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(manager: MemoryManager = Depends(_manager)):
    """Every session with its title, message count and last activity."""
    sessions = await manager.list_sessions()
    return SessionListResponse(sessions=sessions, total=len(sessions))


@router.post("/truncate")
async def truncate_messages(
    body: TruncateRequest,
    manager: MemoryManager = Depends(_manager),
):
    """Delete the messages from `after_uid` (inclusive) up to `before_uid`.

    Edit-and-resend uses this after the new turn is stored: the old copy of
    the edited message and the stale turns after it are removed, so the edit
    becomes the newest message. Messages and memories outside that range are
    untouched.
    """
    removed = await manager.truncate_between(
        body.session_id or "default", body.after_uid, body.before_uid
    )
    await manager.session.commit()
    return {"removed": removed}


@router.post("/clear")
async def clear_history(
    session_id: str = "default",
    manager: MemoryManager = Depends(_manager),
):
    """Clear conversation history for a specific session."""
    await manager.clear_conversation(session_id)
    await manager.session.commit()
    return {"status": "cleared"}
