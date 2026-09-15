"""
Task executor — runs background tasks with step-by-step checkpointing.

Uses asyncio tasks backed by SQLite persistence. On server restart,
interrupted tasks (status=running or pending) are resumed from their
last completed step.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .database import async_session
from .models import Task, TaskStep
from .agent_registry import get_agent, get_agent_steps


def _uid() -> str:
    return f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:7]}"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# In-memory map of running asyncio tasks (for cancellation)
_running_tasks: dict[str, asyncio.Task] = {}


async def create_task(task_type: str, input_params: dict | None = None) -> Task:
    """Create a new task in the database and return it."""
    agent = get_agent(task_type)
    if agent is None:
        raise ValueError(f"Unknown task type: {task_type}")

    steps = get_agent_steps(task_type)

    async with async_session() as session:
        task = Task(
            uid=_uid(),
            task_type=task_type,
            status="pending",
            agent_id=task_type,
            input_params=input_params or {},
            progress=0,
            current_step=0,
            total_steps=len(steps),
            created_at=_utcnow(),
            updated_at=_utcnow(),
        )
        session.add(task)
        await session.flush()

        # Create step records
        for i, step_name in enumerate(steps):
            step = TaskStep(
                task_id=task.id,
                step_index=i,
                step_name=step_name,
                status="pending",
            )
            session.add(step)

        await session.commit()
        await session.refresh(task)
        return task


async def start_task(task_uid: str) -> None:
    """Start executing a task in the background."""
    async with async_session() as session:
        result = await session.execute(
            select(Task).where(Task.uid == task_uid)
        )
        task = result.scalar_one_or_none()
        if task is None:
            return

        # Mark as running
        task.status = "running"
        task.started_at = task.started_at or _utcnow()
        task.updated_at = _utcnow()
        await session.commit()

    # Launch asyncio task
    asyncio_task = asyncio.create_task(_run_task(task_uid))
    _running_tasks[task_uid] = asyncio_task


async def cancel_task(task_uid: str) -> bool:
    """Cancel a running task."""
    asyncio_task = _running_tasks.get(task_uid)
    if asyncio_task and not asyncio_task.done():
        asyncio_task.cancel()
        try:
            await asyncio_task
        except asyncio.CancelledError:
            pass

    async with async_session() as session:
        result = await session.execute(
            select(Task).where(Task.uid == task_uid)
        )
        task = result.scalar_one_or_none()
        if task and task.status == "running":
            task.status = "cancelled"
            task.updated_at = _utcnow()
            await session.commit()
            return True
    return False


async def _run_task(task_uid: str) -> None:
    """Execute a task step by step with checkpointing."""
    agent = None
    try:
        async with async_session() as session:
            result = await session.execute(
                select(Task).where(Task.uid == task_uid).options(
                    # Eagerly load steps
                )
            )
            task = result.scalar_one_or_none()
            if task is None:
                return

            agent_id = task.agent_id
            task_type = task.task_type
            input_params = task.input_params
            current_step_idx = task.current_step

        agent = get_agent(task_type)
        if agent is None:
            await _fail_task(task_uid, f"Unknown agent type: {task_type}")
            return

        step_names = get_agent_steps(task_type)
        total_steps = len(step_names)
        context: dict[str, Any] = {}

        # Load checkpoint from last completed step
        async with async_session() as session:
            result = await session.execute(
                select(TaskStep).where(
                    TaskStep.task_id == select(Task.id).where(Task.uid == task_uid).scalar_subquery()
                ).order_by(TaskStep.step_index)
            )
            all_steps = list(result.scalars().all())

            # Rebuild context from completed steps' outputs and checkpoints
            for step_record in all_steps:
                if step_record.status == "done":
                    output = step_record.output_data
                    if output:
                        context.update(output)
                    checkpoint = step_record.checkpoint
                    if checkpoint:
                        context.update(checkpoint)

        # Execute steps from current position
        for step_idx in range(current_step_idx, total_steps):
            step_name = step_names[step_idx]

            # Check for cancellation
            if task_uid in _running_tasks and _running_tasks[task_uid].cancelled():
                return

            # Mark step as running
            async with async_session() as session:
                task_result = await session.execute(
                    select(Task).where(Task.uid == task_uid)
                )
                task = task_result.scalar_one_or_none()
                if task is None or task.status == "cancelled":
                    return

                task.current_step = step_idx
                task.updated_at = _utcnow()
                await session.commit()

                # Find and update step record
                step_result = await session.execute(
                    select(TaskStep).where(
                        TaskStep.task_id == task.id,
                        TaskStep.step_index == step_idx,
                    )
                )
                step_record = step_result.scalar_one_or_none()
                if step_record:
                    step_record.status = "running"
                    step_record.started_at = _utcnow()
                    step_record.agent_id = agent.agent_id
                    step_record.input_json = json.dumps(context)
                    await session.commit()

            # Execute the step
            try:
                output = await agent.execute_step(step_name, task, context)
            except Exception as e:
                await _fail_step(task_uid, step_idx, str(e))
                return

            # Checkpoint: save step output and context
            async with async_session() as session:
                task_result = await session.execute(
                    select(Task).where(Task.uid == task_uid)
                )
                task = task_result.scalar_one_or_none()
                if task is None:
                    return

                step_result = await session.execute(
                    select(TaskStep).where(
                        TaskStep.task_id == task.id,
                        TaskStep.step_index == step_idx,
                    )
                )
                step_record = step_result.scalar_one_or_none()
                if step_record:
                    step_record.status = "done"
                    step_record.completed_at = _utcnow()
                    step_record.output_json = json.dumps(output)
                    step_record.checkpoint_json = json.dumps(context)

                # Update task progress
                progress = int(((step_idx + 1) / total_steps) * 100)
                task.progress = progress
                task.current_step = step_idx + 1
                task.updated_at = _utcnow()
                await session.commit()

            # Merge step output into context
            context.update(output)

        # All steps done — mark task as completed
        async with async_session() as session:
            task_result = await session.execute(
                select(Task).where(Task.uid == task_uid)
            )
            task = task_result.scalar_one_or_none()
            if task:
                task.status = "completed"
                task.progress = 100
                task.completed_at = _utcnow()
                task.updated_at = _utcnow()
                task.result = context
                await session.commit()

    except asyncio.CancelledError:
        # Task was cancelled — leave status as-is (cancel_task sets it)
        pass
    except Exception as e:
        await _fail_task(task_uid, str(e))
    finally:
        _running_tasks.pop(task_uid, None)


async def _fail_task(task_uid: str, error: str) -> None:
    """Mark a task as failed with an error message."""
    async with async_session() as session:
        result = await session.execute(
            select(Task).where(Task.uid == task_uid)
        )
        task = result.scalar_one_or_none()
        if task:
            task.status = "failed"
            task.error_message = error
            task.updated_at = _utcnow()
            await session.commit()


async def _fail_step(task_uid: str, step_idx: int, error: str) -> None:
    """Mark a specific step as failed and fail the task."""
    async with async_session() as session:
        task_result = await session.execute(
            select(Task).where(Task.uid == task_uid)
        )
        task = task_result.scalar_one_or_none()
        if task:
            # Fail the step
            step_result = await session.execute(
                select(TaskStep).where(
                    TaskStep.task_id == task.id,
                    TaskStep.step_index == step_idx,
                )
            )
            step_record = step_result.scalar_one_or_none()
            if step_record:
                step_record.status = "failed"
                step_record.error_message = error
                step_record.completed_at = _utcnow()

            # Fail the task
            task.status = "failed"
            task.error_message = f"Step '{step_idx}' failed: {error}"
            task.updated_at = _utcnow()
            await session.commit()


async def resume_interrupted_tasks() -> int:
    """On startup, find pending/running tasks and restart them."""
    async with async_session() as session:
        result = await session.execute(
            select(Task).where(Task.status.in_(["pending", "running"]))
        )
        tasks = list(result.scalars().all())

        count = 0
        for task in tasks:
            # Reset running tasks to pending (they were interrupted)
            if task.status == "running":
                task.status = "pending"
                task.updated_at = _utcnow()
            await session.commit()

            # Start the task
            await start_task(task.uid)
            count += 1

    return count


async def get_task(task_uid: str) -> Task | None:
    """Get a task by UID with its steps."""
    async with async_session() as session:
        result = await session.execute(
            select(Task).where(Task.uid == task_uid)
        )
        return result.scalar_one_or_none()


async def list_tasks(
    status: str | None = None,
    task_type: str | None = None,
    limit: int = 50,
) -> list[Task]:
    """List tasks with optional filters."""
    async with async_session() as session:
        q = select(Task).order_by(Task.created_at.desc()).limit(limit)
        if status:
            q = q.where(Task.status == status)
        if task_type:
            q = q.where(Task.task_type == task_type)
        result = await session.execute(q)
        return list(result.scalars().all())
