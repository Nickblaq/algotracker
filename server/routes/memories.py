"""
Memory-related API endpoints.

- GET    /api/memories              List all memories (weight-sorted)
- POST   /api/memories              Create a new memory
- GET    /api/memories/{uid}        Get a single memory
- DELETE /api/memories/{uid}        Delete a memory
- POST   /api/memories/search       Search memories by text/tags
- POST   /api/memories/retrieve     Weighted retrieval (similarity + graph weight)
- POST   /api/memories/prune        Forget isolated, low-weight memories

Weight decay and edge decay are continuous (computed against time since last
use), so there is no decay or consolidation pass to trigger anymore.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..memory_manager import MemoryManager
from ..schemas import (
    MemoryCreate,
    MemoryListResponse,
    MemoryResponse,
    MemorySearchRequest,
)

router = APIRouter(prefix="/api/memories", tags=["memories"])


async def _manager(session: AsyncSession = Depends(get_session)) -> MemoryManager:
    return MemoryManager(session)


# --- CRUD ---------------------------------------------------------------------


@router.get("", response_model=MemoryListResponse)
async def list_memories(
    manager: MemoryManager = Depends(_manager),
):
    """List all memories, strongest weight first."""
    memories = await manager.list_memories()
    entries = await manager.serialize_memories(memories)
    return MemoryListResponse(
        memories=[MemoryResponse(**d) for d in entries],
        total=len(entries),
    )


@router.post("", response_model=MemoryResponse, status_code=201)
async def create_memory(
    body: MemoryCreate,
    manager: MemoryManager = Depends(_manager),
):
    """Create a new memory. Its weight starts from the authored importance."""
    mem = await manager.create_memory(
        content=body.content,
        importance=body.importance,
        tags=body.tags,
    )
    await manager.session.commit()
    entries = await manager.serialize_memories([mem])
    return MemoryResponse(**entries[0])


@router.get("/{uid}", response_model=MemoryResponse)
async def get_memory(
    uid: str,
    manager: MemoryManager = Depends(_manager),
):
    """Get a single memory by its unique ID."""
    mem = await manager.get_memory(uid)
    if mem is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    entries = await manager.serialize_memories([mem])
    return MemoryResponse(**entries[0])


@router.delete("/{uid}", status_code=204)
async def delete_memory(
    uid: str,
    manager: MemoryManager = Depends(_manager),
):
    """Delete a memory by ID (its edges go with it)."""
    deleted = await manager.delete_memory(uid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")
    await manager.session.commit()


# --- Search & Retrieve --------------------------------------------------------


@router.post("/search", response_model=MemoryListResponse)
async def search_memories(
    body: MemorySearchRequest,
    manager: MemoryManager = Depends(_manager),
):
    """Full-text search across memory content and tags."""
    memories = await manager.search_memories(query=body.query)
    results = memories[: body.top_k]
    entries = await manager.serialize_memories(results)
    return MemoryListResponse(
        memories=[MemoryResponse(**d) for d in entries],
        total=len(entries),
    )


@router.post("/retrieve", response_model=MemoryListResponse)
async def retrieve_memories(
    body: MemorySearchRequest,
    manager: MemoryManager = Depends(_manager),
):
    """Weighted retrieval: query similarity blended with emergent weight.
    Retrieval itself reinforces the memories it returns — persist that, or
    the whole emergent loop would roll back with the request session."""
    memories = await manager.retrieve_memories(query=body.query, top_k=body.top_k)
    await manager.session.commit()
    entries = await manager.serialize_memories(memories)
    return MemoryListResponse(
        memories=[MemoryResponse(**d) for d in entries],
        total=len(entries),
    )


# --- Maintenance --------------------------------------------------------------


@router.post("/prune")
async def run_prune(manager: MemoryManager = Depends(_manager)):
    """Forget isolated memories whose weight has decayed away."""
    count = await manager.prune_memories()
    await manager.session.commit()
    return {"pruned": count}
