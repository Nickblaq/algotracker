"""
SQLAlchemy ORM models for the memory system.

Tables:
  - memories: Core memory entries with tier, importance, decay info
  - memory_associations: Many-to-many between memories
  - conversation_messages: Chat messages with memory references
  - operations: Audit log of all memory operations
  - tasks: Background agent tasks with status tracking
  - task_steps: Ordered execution steps with checkpoint data
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    event,
)
from sqlalchemy.orm import relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _safe_json_list(raw: str) -> list[str]:
    """Parse a JSON list, handling Python repr format as a fallback."""
    try:
        result = json.loads(raw)
        return result if isinstance(result, list) else []
    except (json.JSONDecodeError, TypeError):
        pass
    # Fallback: try ast.literal_eval for Python list repr like "['a', 'b']"
    try:
        import ast
        result = ast.literal_eval(raw)
        return result if isinstance(result, list) else []
    except (ValueError, SyntaxError):
        return []


class Memory(Base):
    __tablename__ = "memories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), unique=True, nullable=False, index=True)
    tier = Column(String(20), nullable=False, index=True)  # sensory | short_term | long_term | episodic | procedural
    content = Column(Text, nullable=False)
    embedding_json = Column(Text, nullable=True)  # JSON-encoded float list
    importance = Column(Float, nullable=False, default=0.5)
    access_count = Column(Integer, nullable=False, default=0)
    last_accessed = Column(DateTime, nullable=False, default=_utcnow)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    decay_rate = Column(Float, nullable=False, default=0.1)
    tags_json = Column(Text, nullable=False, default="[]")
    metadata_json = Column(Text, nullable=False, default="{}")
    consolidated = Column(Integer, nullable=False, default=0)  # 0/1 boolean

    # Associations (many-to-many via association table)
    associated_from = relationship(
        "MemoryAssociation",
        primaryjoin="Memory.id == MemoryAssociation.from_id",
        lazy="selectin",
    )
    associated_to = relationship(
        "MemoryAssociation",
        primaryjoin="Memory.id == MemoryAssociation.to_id",
        lazy="selectin",
    )

    # --- helpers ---------------------------------------------------------------

    @property
    def tags(self) -> list[str]:
        return json.loads(self.tags_json)

    @tags.setter
    def tags(self, value: list[str]) -> None:
        self.tags_json = json.dumps(value)

    @property
    def meta(self) -> dict:
        return json.loads(self.metadata_json)

    @meta.setter
    def meta(self, value: dict) -> None:
        self.metadata_json = json.dumps(value)

    @property
    def embedding(self) -> list[float]:
        if self.embedding_json:
            return json.loads(self.embedding_json)
        return []

    @embedding.setter
    def embedding(self, value: list[float]) -> None:
        self.embedding_json = json.dumps(value)

    @property
    def association_ids(self) -> list[int]:
        ids = set()
        for a in self.associated_from:
            ids.add(a.to_id)
        for a in self.associated_to:
            ids.add(a.from_id)
        return list(ids)

    def to_dict(self) -> dict:
        return {
            "id": self.uid,
            "tier": self.tier,
            "content": self.content,
            "importance": self.importance,
            "accessCount": self.access_count,
            "lastAccessed": int(self.last_accessed.timestamp() * 1000),
            "createdAt": int(self.created_at.timestamp() * 1000),
            "decayRate": self.decay_rate,
            "tags": self.tags,
            "metadata": self.meta,
            "associations": [
                (a.to_id if a.from_id == self.id else a.from_id)
                for a in (self.associated_from + self.associated_to)
            ],
            "consolidated": bool(self.consolidated),
        }


class MemoryAssociation(Base):
    __tablename__ = "memory_associations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    from_id = Column(Integer, ForeignKey("memories.id"), nullable=False, index=True)
    to_id = Column(Integer, ForeignKey("memories.id"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), unique=True, nullable=False, index=True)
    session_id = Column(String(64), nullable=False, index=True, default="default")
    title = Column(String(200), nullable=True)
    role = Column(String(20), nullable=False)  # user | assistant | system
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, nullable=False, default=_utcnow)
    memories_accessed_json = Column(Text, nullable=False, default="[]")
    memories_created_json = Column(Text, nullable=False, default="[]")

    @property
    def memories_accessed(self) -> list[str]:
        return _safe_json_list(self.memories_accessed_json)

    @property
    def memories_created(self) -> list[str]:
        return _safe_json_list(self.memories_created_json)

    def to_dict(self) -> dict:
        return {
            "id": self.uid,
            "sessionId": self.session_id,
            "role": self.role,
            "content": self.content,
            "timestamp": int(self.timestamp.timestamp() * 1000),
            "memoriesAccessed": self.memories_accessed,
            "memoriesCreated": self.memories_created,
        }


class Operation(Base):
    __tablename__ = "operations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), unique=True, nullable=False, index=True)
    op_type = Column(String(20), nullable=False, index=True)  # create | consolidate | decay | retrieve | associate | prune
    source_tier = Column(String(20), nullable=False)
    target_tier = Column(String(20), nullable=True)
    memory_uid = Column(String(64), nullable=False)
    timestamp = Column(DateTime, nullable=False, default=_utcnow)
    details = Column(Text, nullable=False, default="")

    def to_dict(self) -> dict:
        return {
            "id": self.uid,
            "type": self.op_type,
            "sourceTier": self.source_tier,
            "targetTier": self.target_tier,
            "memoryId": self.memory_uid,
            "timestamp": int(self.timestamp.timestamp() * 1000),
            "details": self.details,
        }


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    uid = Column(String(64), unique=True, nullable=False, index=True)
    task_type = Column(String(64), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending", index=True)  # pending | running | completed | failed | cancelled
    agent_id = Column(String(64), nullable=True)
    input_params_json = Column(Text, nullable=False, default="{}")
    result_json = Column(Text, nullable=True)
    progress = Column(Integer, nullable=False, default=0)  # 0-100
    error_message = Column(Text, nullable=True)
    current_step = Column(Integer, nullable=False, default=0)
    total_steps = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    # Relationship to steps
    steps = relationship("TaskStep", primaryjoin="Task.id == TaskStep.task_id", lazy="selectin", order_by="TaskStep.step_index")

    @property
    def input_params(self) -> dict:
        try:
            return json.loads(self.input_params_json)
        except (json.JSONDecodeError, TypeError):
            return {}

    @input_params.setter
    def input_params(self, value: dict) -> None:
        self.input_params_json = json.dumps(value)

    @property
    def result(self) -> dict | None:
        if self.result_json:
            try:
                return json.loads(self.result_json)
            except (json.JSONDecodeError, TypeError):
                return None
        return None

    @result.setter
    def result(self, value: dict | None) -> None:
        self.result_json = json.dumps(value) if value is not None else None

    def to_dict(self) -> dict:
        return {
            "id": self.uid,
            "type": self.task_type,
            "status": self.status,
            "agentId": self.agent_id,
            "inputParams": self.input_params,
            "result": self.result,
            "progress": self.progress,
            "errorMessage": self.error_message,
            "currentStep": self.current_step,
            "totalSteps": self.total_steps,
            "createdAt": int(self.created_at.timestamp() * 1000),
            "startedAt": int(self.started_at.timestamp() * 1000) if self.started_at else None,
            "completedAt": int(self.completed_at.timestamp() * 1000) if self.completed_at else None,
            "updatedAt": int(self.updated_at.timestamp() * 1000),
            "steps": [s.to_dict() for s in self.steps],
        }


class TaskStep(Base):
    __tablename__ = "task_steps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    step_index = Column(Integer, nullable=False)
    step_name = Column(String(64), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending | running | done | failed | skipped
    input_json = Column(Text, nullable=True)
    output_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    agent_id = Column(String(64), nullable=True)  # which agent instance ran this
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    checkpoint_json = Column(Text, nullable=True)  # arbitrary checkpoint data for resume

    @property
    def input_data(self) -> dict | None:
        if self.input_json:
            try:
                return json.loads(self.input_json)
            except (json.JSONDecodeError, TypeError):
                return None
        return None

    @property
    def output_data(self) -> dict | None:
        if self.output_json:
            try:
                return json.loads(self.output_json)
            except (json.JSONDecodeError, TypeError):
                return None
        return None

    @property
    def checkpoint(self) -> dict | None:
        if self.checkpoint_json:
            try:
                return json.loads(self.checkpoint_json)
            except (json.JSONDecodeError, TypeError):
                return None
        return None

    def to_dict(self) -> dict:
        return {
            "index": self.step_index,
            "name": self.step_name,
            "status": self.status,
            "input": self.input_data,
            "output": self.output_data,
            "error": self.error_message,
            "agentId": self.agent_id,
            "startedAt": int(self.started_at.timestamp() * 1000) if self.started_at else None,
            "completedAt": int(self.completed_at.timestamp() * 1000) if self.completed_at else None,
            "checkpoint": self.checkpoint,
        }
