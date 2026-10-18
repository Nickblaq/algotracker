"""
Chat and conversation API endpoints.

- POST /api/chat/send     Process a user message in a session
- POST /api/chat/respond  Store an assistant response in a session
- GET  /api/chat/history  Get conversation history for a session
- POST /api/chat/clear    Clear a specific session
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..memory_manager import MemoryManager
from ..schemas import ChatRequest, ConversationMessageResponse

router = APIRouter(prefix="/api/chat", tags=["chat"])


async def _manager(session: AsyncSession = Depends(get_session)) -> MemoryManager:
    return MemoryManager(session)


@router.post("/send")
async def send_message(
    body: ChatRequest,
    manager: MemoryManager = Depends(_manager),
):
    """
    Process a user chat message within a session.
    Returns the user message, retrieved context memories, and a suggested system prompt.
    """
    session_id = body.session_id or "default"
    user_msg, memories_retrieved = await manager.process_user_message(body.content, session_id)

    # Build context for the LLM
    context_parts = [f"[{m.tier}] {m.content}" for m in memories_retrieved]
    context_block = "\n".join(context_parts) if context_parts else "(No memories retrieved yet)"

    # Get last 10 messages for this session
    history = await manager.get_conversation_history(session_id=session_id, limit=10)
    chat_messages = [{"role": m.role, "content": m.content} for m in history]

    system_prompt = (
        f"You are a helpful AI assistant demonstrating hierarchical memory management.\n"
        f"You have access to the following memories from previous interactions:\n"
        f"{context_block}\n\n"
        f"Use these memories to provide contextual responses. Mention when you recall something from memory."
    )

    await manager.session.commit()

    return {
        "message": ConversationMessageResponse(**user_msg.to_dict()).model_dump(),
        "memoriesAccessed": [m.to_dict() for m in memories_retrieved],
        "suggestedPrompt": {
            "system": system_prompt,
            "messages": chat_messages,
        },
    }


@router.post("/respond")
async def store_response(
    body: ChatRequest,
    manager: MemoryManager = Depends(_manager),
):
    """Store an assistant's response and create relevant memories."""
    session_id = body.session_id or "default"
    msg = await manager.process_assistant_response(body.content, session_id)
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


@router.post("/clear")
async def clear_history(
    session_id: str = "default",
    manager: MemoryManager = Depends(_manager),
):
    """Clear conversation history for a specific session."""
    await manager.clear_conversation(session_id)
    await manager.session.commit()
    return {"status": "cleared"}
