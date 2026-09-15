"""
Memory-related API endpoints.

- GET    /api/memories              List all memories (optional tier filter)
- POST   /api/memories              Create a new memory
- GET    /api/memories/{uid}        Get a single memory
- PATCH  /api/memories/{uid}        Update a memory
- DELETE /api/memories/{uid}        Delete a memory
- POST   /api/memories/search       Search memories by text/tags
- POST   /api/memories/retrieve     Semantic retrieval (TF-IDF cosine similarity)
- POST   /api/memories/associate    Link two memories
- POST   /api/memories/decay        Run decay pass
- POST   /api/memories/consolidate  Run consolidation pass
- POST   /api/memories/prune        Prune low-importance memories
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..memory_manager import MemoryManager
from ..schemas import (
    MemoryAssociateRequest,
    MemoryCreate,
    MemoryListResponse,
    MemoryResponse,
    MemorySearchRequest,
    MemoryUpdate,
)

router = APIRouter(prefix="/api/memories", tags=["memories"])


async def _manager(session: AsyncSession = Depends(get_session)) -> MemoryManager:
    return MemoryManager(session)


# --- CRUD ---------------------------------------------------------------------


@router.get("", response_model=MemoryListResponse)
async def list_memories(
    tier: str | None = None,
    manager: MemoryManager = Depends(_manager),
):
    """List all memories, optionally filtered by tier."""
    memories = await manager.list_memories(tier=tier)
    return MemoryListResponse(
        memories=[MemoryResponse(**m.to_dict()) for m in memories],
        total=len(memories),
    )


@router.post("", response_model=MemoryResponse, status_code=201)
async def create_memory(
    body: MemoryCreate,
    manager: MemoryManager = Depends(_manager),
):
    """Create a new memory in the specified tier."""
    mem = await manager.create_memory(
        content=body.content,
        tier=body.tier,
        importance=body.importance,
        tags=body.tags,
    )
    await manager.session.commit()
    return MemoryResponse(**mem.to_dict())


@router.get("/{uid}", response_model=MemoryResponse)
async def get_memory(
    uid: str,
    manager: MemoryManager = Depends(_manager),
):
    """Get a single memory by its unique ID."""
    mem = await manager.get_memory(uid)
    if mem is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return MemoryResponse(**mem.to_dict())


@router.patch("/{uid}", response_model=MemoryResponse)
async def update_memory(
    uid: str,
    body: MemoryUpdate,
    manager: MemoryManager = Depends(_manager),
):
    """Update memory fields."""
    updates = body.model_dump(exclude_unset=True)
    mem = await manager.update_memory(uid, **updates)
    if mem is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    await manager.session.commit()
    return MemoryResponse(**mem.to_dict())


@router.delete("/{uid}", status_code=204)
async def delete_memory(
    uid: str,
    manager: MemoryManager = Depends(_manager),
):
    """Delete a memory by ID."""
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
    memories = await manager.search_memories(query=body.query, tier=body.tier)
    results = memories[: body.top_k]
    return MemoryListResponse(
        memories=[MemoryResponse(**m.to_dict()) for m in results],
        total=len(results),
    )


@router.post("/retrieve", response_model=MemoryListResponse)
async def retrieve_memories(
    body: MemorySearchRequest,
    manager: MemoryManager = Depends(_manager),
):
    """Semantic retrieval using TF-IDF cosine similarity scoring."""
    memories = await manager.retrieve_memories(query=body.query, top_k=body.top_k)
    return MemoryListResponse(
        memories=[MemoryResponse(**m.to_dict()) for m in memories],
        total=len(memories),
    )


# --- Association --------------------------------------------------------------


@router.post("/associate")
async def associate_memories(
    body: MemoryAssociateRequest,
    manager: MemoryManager = Depends(_manager),
):
    """Create a bidirectional association between two memories."""
    ok = await manager.associate_memories(body.from_id, body.to_id)
    if not ok:
        raise HTTPException(status_code=400, detail="Could not associate memories (not found or already linked)")
    await manager.session.commit()
    return {"status": "associated"}


# --- Maintenance --------------------------------------------------------------


@router.post("/decay")
async def run_decay(manager: MemoryManager = Depends(_manager)):
    """Run exponential decay across all memories."""
    deleted = await manager.decay_all_memories()
    await manager.session.commit()
    return {"deleted": deleted}


@router.post("/consolidate")
async def run_consolidation(manager: MemoryManager = Depends(_manager)):
    """Promote memories that meet thresholds to the next tier."""
    count = await manager.consolidate_memories()
    await manager.session.commit()
    return {"consolidated": count}


@router.post("/prune")
async def run_prune(manager: MemoryManager = Depends(_manager)):
    """Remove low-importance, never-accessed memories."""
    count = await manager.prune_memories()
    await manager.session.commit()
    return {"pruned": count}
