"""
SQLAlchemy ORM models for the memory system.

Tables:
  - memories: Core memory entries with an emergent weight, importance, edges
  - memory_edges: Undirected association links between memories (co-retrieval
    and similarity), strengthened by use and decayed by time
  - conversation_messages: Chat messages with memory references

The legacy `tier` column is kept only so existing databases open cleanly; no
logic reads it anymore, and new rows store "unclassified".
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String, Text, UniqueConstraint

from .database import Base

# Weight decay applied continuously against time since the memory was last
# used. 0.05/hour ≈ half-life of ~14 hours: unused memories visibly fade
# within a day, actively retrieved ones never sit still long enough to fade.
WEIGHT_DECAY_PER_HOUR = 0.05

# Edges weaken too: two memories that stop being retrieved together drift
# apart. Slower than node decay (~35h half-life) so the graph is stickier
# than its nodes.
EDGE_DECAY_PER_HOUR = 0.02


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
    # Legacy tier label — retained for schema compatibility, not used by logic.
    tier = Column(String(20), nullable=False, index=True, default="unclassified")
    content = Column(Text, nullable=False)
    embedding_json = Column(Text, nullable=True)  # JSON-encoded float list
    importance = Column(Float, nullable=False, default=0.5)
    # Emergent strength: raised by retrieval (recency-weighted access, query
    # similarity, edge strength), decayed continuously against time since use.
    weight = Column(Float, nullable=False, default=0.5)
    access_count = Column(Integer, nullable=False, default=0)
    last_accessed = Column(DateTime, nullable=False, default=_utcnow)
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    decay_rate = Column(Float, nullable=False, default=WEIGHT_DECAY_PER_HOUR)
    tags_json = Column(Text, nullable=False, default="[]")
    metadata_json = Column(Text, nullable=False, default="{}")
    consolidated = Column(Integer, nullable=False, default=0)  # legacy 0/1

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

    def effective_weight(self, now: datetime | None = None) -> float:
        """Current weight after continuous decay since last use.

        This is the value retrieval and the API see; the stored column is the
        weight as of the last boost, so decay is applied here rather than
        being persisted repeatedly (no double-decay).
        """
        if self.weight <= 0:
            return 0.0
        anchor = self.last_accessed
        if anchor.tzinfo is None:
            anchor = anchor.replace(tzinfo=timezone.utc)
        current = now or _utcnow()
        hours = max(0.0, (current - anchor).total_seconds() / 3600.0)
        return max(0.0, min(1.0, self.weight * math.exp(-WEIGHT_DECAY_PER_HOUR * hours)))

    def to_dict(self, edge_count: int = 0) -> dict:
        return {
            "id": self.uid,
            "content": self.content,
            "weight": round(self.effective_weight(), 4),
            "edgeCount": edge_count,
            "importance": self.importance,
            "accessCount": self.access_count,
            "lastAccessed": int(self.last_accessed.timestamp() * 1000),
            "createdAt": int(self.created_at.timestamp() * 1000),
            "tags": self.tags,
            "metadata": self.meta,
        }


class MemoryEdge(Base):
    """Undirected association between two memories.

    Edges form when two memories come back from the same query (co-retrieval)
    or embed similarly at creation time. `from_uid`/`to_uid` are stored in
    sorted order so each pair has exactly one row.
    """

    __tablename__ = "memory_edges"
    __table_args__ = (UniqueConstraint("from_uid", "to_uid", name="uq_memory_edge_pair"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    from_uid = Column(String(64), nullable=False, index=True)
    to_uid = Column(String(64), nullable=False, index=True)
    weight = Column(Float, nullable=False, default=0.1)
    last_hit = Column(DateTime, nullable=False, default=_utcnow)

    def to_dict(self) -> dict:
        return {
            "from": self.from_uid,
            "to": self.to_uid,
            "weight": round(self.weight, 4),
            "lastHit": int(self.last_hit.timestamp() * 1000),
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
