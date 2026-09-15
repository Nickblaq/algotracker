"""
Task API endpoints.

- GET    /api/tasks              List all tasks
- POST   /api/tasks              Create a new task
- GET    /api/tasks/{uid}        Get task details with step trail
- POST   /api/tasks/{uid}/start  Start a task
- POST   /api/tasks/{uid}/cancel Cancel a running task
- POST   /api/tasks/{uid}/resume Resume a failed/interrupted task
- GET    /api/agents             List available agent types
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..schemas import (
    TaskCreateRequest,
    TaskListResponse,
    TaskResponse,
)
from .. import task_executor
from ..agent_registry import list_agents as _list_agents

router = APIRouter(tags=["tasks"])


@router.get("/api/tasks", response_model=TaskListResponse)
async def list_tasks(
    status: str | None = None,
    type: str | None = None,
    limit: int = 50,
):
    """List all tasks with optional status/type filters."""
    tasks = await task_executor.list_tasks(status=status, task_type=type, limit=limit)
    return TaskListResponse(
        tasks=[TaskResponse(**t.to_dict()) for t in tasks],
        total=len(tasks),
    )


@router.post("/api/tasks", response_model=TaskResponse, status_code=201)
async def create_task(body: TaskCreateRequest):
    """Create a new task. It will be in 'pending' state until started."""
    try:
        task = await task_executor.create_task(body.type, body.inputParams)
        return TaskResponse(**task.to_dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/tasks/{uid}", response_model=TaskResponse)
async def get_task(uid: str):
    """Get a single task with its full step trail."""
    task = await task_executor.get_task(uid)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse(**task.to_dict())


@router.post("/api/tasks/{uid}/start")
async def start_task(uid: str):
    """Start a pending task (or resume a failed one)."""
    task = await task_executor.get_task(uid)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status not in ("pending", "failed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot start task with status '{task.status}'")

    # Reset failed/cancelled tasks to pending
    if task.status in ("failed", "cancelled"):
        from ..database import async_session
        from ..models import Task
        from sqlalchemy import select as sel
        async with async_session() as session:
            result = await session.execute(sel(Task).where(Task.uid == uid))
            t = result.scalar_one_or_none()
            if t:
                t.status = "pending"
                t.error_message = None
                t.current_step = 0
                await session.commit()

    await task_executor.start_task(uid)
    return {"status": "started"}


@router.post("/api/tasks/{uid}/cancel")
async def cancel_task(uid: str):
    """Cancel a running task."""
    cancelled = await task_executor.cancel_task(uid)
    if not cancelled:
        raise HTTPException(status_code=400, detail="Task could not be cancelled")
    return {"status": "cancelled"}


@router.post("/api/tasks/{uid}/resume")
async def resume_task(uid: str):
    """Resume a failed or interrupted task from its last checkpoint."""
    task = await task_executor.get_task(uid)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status not in ("failed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Cannot resume task with status '{task.status}'")

    # Reset to pending and start
    from ..database import async_session
    from ..models import Task
    from sqlalchemy import select as sel
    async with async_session() as session:
        result = await session.execute(sel(Task).where(Task.uid == uid))
        t = result.scalar_one_or_none()
        if t:
            t.status = "pending"
            t.error_message = None
            # Don't reset current_step — resume from where it stopped
            await session.commit()

    await task_executor.start_task(uid)
    return {"status": "resumed"}


@router.get("/api/agents")
async def list_agents():
    """List available agent types."""
    return _list_agents()
