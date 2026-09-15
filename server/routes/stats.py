"""
Statistics and operations log API endpoints.

- GET /api/stats         Memory system statistics
- GET /api/operations    Recent operations log
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..memory_manager import MemoryManager
from ..schemas import OperationResponse, StatsResponse, TierCounts

router = APIRouter(tags=["stats"])


async def _manager(session: AsyncSession = Depends(get_session)) -> MemoryManager:
    return MemoryManager(session)


@router.get("/api/stats", response_model=StatsResponse)
async def get_stats(manager: MemoryManager = Depends(_manager)):
    """Get memory system statistics."""
    stats = await manager.get_stats()
    return StatsResponse(
        totalMemories=stats["totalMemories"],
        tierCounts=TierCounts(**stats["tierCounts"]),
        avgImportance=stats["avgImportance"],
        consolidationRate=stats["consolidationRate"],
        retrievalAccuracy=stats["retrievalAccuracy"],
        memoryUtilization=stats["memoryUtilization"],
    )


@router.get("/api/operations", response_model=list[OperationResponse])
async def get_operations(
    limit: int = 100,
    manager: MemoryManager = Depends(_manager),
):
    """Get recent operations log."""
    ops = await manager.get_operations(limit=limit)
    return [OperationResponse(**op.to_dict()) for op in ops]
