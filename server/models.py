"""
SQLAlchemy ORM models for the memory system.

Tables:
  - memories: Core memory entries with tier, importance, decay info
  - conversation_messages: Chat messages with memory references
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _json_list(raw: str | None) -> list[str]:
    """Parse a JSON list. Returns [] for empty or malformed values."""
    if not raw:
        return []
    try:
        result = json.loads(raw)
        return result if isinstance(result, list) else []
    except (json.JSONDecodeError, TypeError):
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

    # --- helpers ---------------------------------------------------------------

    @property
    def tags(self) -> list[str]:
        return _json_list(self.tags_json)

    @tags.setter
    def tags(self, value: list[str]) -> None:
        self.tags_json = json.dumps(value)

    @property
    def meta(self) -> dict:
        try:
            result = json.loads(self.metadata_json)
            return result if isinstance(result, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}

    @meta.setter
    def meta(self, value: dict) -> None:
        self.metadata_json = json.dumps(value)

    @property
    def embedding(self) -> list[float]:
        if self.embedding_json:
            try:
                result = json.loads(self.embedding_json)
                return result if isinstance(result, list) else []
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    @embedding.setter
    def embedding(self, value: list[float]) -> None:
        self.embedding_json = json.dumps(value)

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
            "consolidated": bool(self.consolidated),
        }


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
        return _json_list(self.memories_accessed_json)

    @property
    def memories_created(self) -> list[str]:
        return _json_list(self.memories_created_json)

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
