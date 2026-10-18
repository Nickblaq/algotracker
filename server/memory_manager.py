"""
Core memory management engine.

  - TF-IDF vector embeddings via scikit-learn
  - Async SQLAlchemy persistence
  - Numpy-accelerated similarity scoring
  - Server-side decay and consolidation

Usage:
    manager = MemoryManager(session)
    await manager.create_memory(...)
    results = await manager.retrieve_memories(query="...", top_k=5)
"""

from __future__ import annotations

import json
import math
import re
import time
import uuid
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import ConversationMessage, Memory


def _uid() -> str:
    return f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:7]}"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


TIER_ORDER = ["sensory", "short_term", "long_term", "episodic", "procedural"]

TIER_CONFIG: dict[str, dict] = {
    "sensory":     {"capacity": 50,  "decay_base": 0.15, "promotion_threshold": 0.3},
    "short_term":  {"capacity": 30,  "decay_base": 0.08, "promotion_threshold": 0.5},
    "long_term":   {"capacity": 100, "decay_base": 0.02, "promotion_threshold": 0.7},
    "episodic":    {"capacity": 60,  "decay_base": 0.03, "promotion_threshold": 0.6},
    "procedural":  {"capacity": 40,  "decay_base": 0.01, "promotion_threshold": 0.8},
}


# ---------------------------------------------------------------------------
# TF-IDF vectoriser (fitted lazily on the full corpus each call)
# ---------------------------------------------------------------------------

class _TfidfEncoder:
    """Thin wrapper around sklearn TfidfVectorizer for embedding generation."""

    def __init__(self) -> None:
        self._vectorizer = None

    def _ensure_fitted(self, corpus: list[str]) -> None:
        from sklearn.feature_extraction.text import TfidfVectorizer

        self._vectorizer = TfidfVectorizer(
            max_features=256,
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True,
        )
        self._vectorizer.fit(corpus)

    def encode(self, texts: list[str], corpus: list[str] | None = None) -> np.ndarray:
        """Return a 2-D numpy array of shape (len(texts), n_features)."""
        if corpus:
            self._ensure_fitted(corpus)
        if self._vectorizer is None:
            self._ensure_fitted(texts)
        return self._vectorizer.transform(texts).toarray()  # type: ignore[union-attr]


_encoder = _TfidfEncoder()


# ---------------------------------------------------------------------------
# MemoryManager
# ---------------------------------------------------------------------------

class MemoryManager:
    """Async memory manager backed by SQLAlchemy + SQLite."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- helpers --------------------------------------------------------------

    async def _get_all_memories(self) -> list[Memory]:
        result = await self.session.execute(select(Memory))
        return list(result.scalars().all())

    async def _get_memory_by_uid(self, uid: str) -> Memory | None:
        result = await self.session.execute(select(Memory).where(Memory.uid == uid))
        return result.scalar_one_or_none()

    # --- text similarity via TF-IDF ------------------------------------------

    def _compute_embeddings(self, texts: list[str], corpus: list[str]) -> list[list[float]]:
        """Compute TF-IDF embeddings for texts against the full corpus."""
        if not corpus:
            return [[] for _ in texts]
        vecs = _encoder.encode(texts, corpus=corpus)
        return [v.tolist() for v in vecs]

    @staticmethod
    def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
        # Handle dimension mismatch by truncating to the smaller size
        min_len = min(len(a), len(b))
        if min_len == 0:
            return 0.0
        a_trunc = a[:min_len]
        b_trunc = b[:min_len]
        norm_a = np.linalg.norm(a_trunc)
        norm_b = np.linalg.norm(b_trunc)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a_trunc, b_trunc) / (norm_a * norm_b))

    # --- Memory CRUD ---------------------------------------------------------

    async def create_memory(
        self,
        content: str,
        tier: str = "sensory",
        importance: float = 0.5,
        tags: list[str] | None = None,
    ) -> Memory:
        importance = max(0.0, min(1.0, importance))
        now = _utcnow()

        mem = Memory(
            uid=_uid(),
            tier=tier,
            content=content,
            importance=importance,
            access_count=0,
            last_accessed=now,
            created_at=now,
            decay_rate=TIER_CONFIG[tier]["decay_base"],
            tags=tags or [],
            consolidated=0,
        )
        self.session.add(mem)
        await self.session.flush()

        # Compute embedding against the full corpus
        all_mems = await self._get_all_memories()
        corpus = [m.content for m in all_mems]
        emb = self._compute_embeddings([content], corpus)
        if emb:
            mem.embedding = emb[0]

        await self.session.flush()
        return mem

    async def get_memory(self, uid: str) -> Memory | None:
        return await self._get_memory_by_uid(uid)

    async def list_memories(self, tier: str | None = None) -> list[Memory]:
        q = select(Memory)
        if tier:
            q = q.where(Memory.tier == tier)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def delete_memory(self, uid: str) -> bool:
        mem = await self._get_memory_by_uid(uid)
        if mem is None:
            return False
        await self.session.delete(mem)
        await self.session.flush()
        return True

    # --- Retrieval -----------------------------------------------------------

    async def retrieve_memories(self, query: str, top_k: int = 5) -> list[Memory]:
        """Retrieve memories using TF-IDF cosine similarity + recency + importance weighting."""
        all_mems = await self._get_all_memories()
        if not all_mems:
            return []

        corpus = [m.content for m in all_mems]
        query_vec = _encoder.encode([query], corpus=corpus)[0]

        now_ms = time.time() * 1000
        scored: list[tuple[Memory, float]] = []

        for mem in all_mems:
            raw_emb = mem.embedding
            mem_vec = np.array(raw_emb, dtype=float) if raw_emb else np.zeros(len(query_vec))
            text_sim = self._cosine_sim(query_vec, mem_vec)
            recency_bonus = math.exp(-0.001 * (now_ms - mem.last_accessed.timestamp() * 1000))
            importance_bonus = mem.importance
            access_bonus = math.log1p(mem.access_count) * 0.1

            score = text_sim * 0.4 + recency_bonus * 0.2 + importance_bonus * 0.3 + access_bonus * 0.1
            scored.append((mem, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        retrieved = [mem for mem, _ in scored[:top_k]]

        for mem in retrieved:
            mem.access_count += 1
            mem.last_accessed = _utcnow()

        await self.session.flush()
        return retrieved

    # --- Search --------------------------------------------------------------

    async def search_memories(self, query: str, tier: str | None = None) -> list[Memory]:
        """Simple text search across memory content and tags."""
        q = select(Memory)
        if tier:
            q = q.where(Memory.tier == tier)
        result = await self.session.execute(q)
        all_mems = list(result.scalars().all())

        query_lower = query.lower()
        results = []
        for mem in all_mems:
            content_match = query_lower in mem.content.lower()
            tag_match = any(query_lower in tag.lower() for tag in mem.tags)
            if content_match or tag_match:
                results.append(mem)

        results.sort(key=lambda m: m.importance, reverse=True)
        return results

    # --- Decay ---------------------------------------------------------------

    async def decay_all_memories(self) -> int:
        """Apply exponential decay to all memories. Delete low-importance sensory."""
        now = datetime.now(timezone.utc)
        all_mems = await self._get_all_memories()
        deleted = 0

        for mem in all_mems:
            last = mem.last_accessed
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            age_sec = (now - last).total_seconds()
            decay = math.exp(-mem.decay_rate * (age_sec / 60))
            mem.importance = max(0, mem.importance * decay)

            if mem.importance < 0.05 and mem.tier == "sensory":
                await self.session.delete(mem)
                deleted += 1

        await self.session.flush()
        return deleted

    # --- Consolidation -------------------------------------------------------

    async def consolidate_memories(self) -> int:
        """Promote memories that meet importance + access thresholds to the next tier."""
        all_mems = await self._get_all_memories()
        consolidated = 0

        for i in range(len(TIER_ORDER) - 1):
            tier = TIER_ORDER[i]
            next_tier = TIER_ORDER[i + 1]
            threshold = TIER_CONFIG[tier]["promotion_threshold"]

            for mem in all_mems:
                if mem.tier == tier and mem.importance >= threshold and mem.access_count >= 2:
                    mem.tier = next_tier
                    mem.consolidated = 1
                    mem.decay_rate = TIER_CONFIG[next_tier]["decay_base"]
                    consolidated += 1

        await self.session.flush()
        return consolidated

    # --- Pruning -------------------------------------------------------------

    async def prune_memories(self) -> int:
        """Remove low-importance, never-accessed memories."""
        all_mems = await self._get_all_memories()
        pruned = 0

        for mem in all_mems:
            if mem.importance < 0.1 and mem.access_count == 0:
                await self.session.delete(mem)
                pruned += 1

        await self.session.flush()
        return pruned

    # --- Chat integration ----------------------------------------------------

    async def process_user_message(self, content: str, session_id: str = "default") -> tuple[ConversationMessage, list[Memory]]:
        """Process a user chat message: retrieve context memories, create sensory memory."""
        memories_retrieved = await self.retrieve_memories(content, top_k=3)
        memories_created: list[str] = []

        # Extract key sentences and create sensory memories
        sentences = re.split(r"[.!?]+", content)
        key_phrases = [s.strip() for s in sentences if len(s.strip()) > 10][:3]

        for phrase in key_phrases:
            tags = self._extract_tags(content)
            mem = await self.create_memory(phrase, "sensory", 0.6 + (hash(phrase) % 30) / 100, tags)
            memories_created.append(mem.uid)

        # Auto-generate title from first user message in session
        title = None
        existing = await self.session.execute(
            select(ConversationMessage).where(
                ConversationMessage.session_id == session_id
            ).limit(1)
        )
        if existing.scalar_one_or_none() is None:
            title = content[:80]

        user_msg = ConversationMessage(
            uid=_uid(),
            session_id=session_id,
            title=title,
            role="user",
            content=content,
            timestamp=_utcnow(),
            memories_accessed_json=json.dumps([m.uid for m in memories_retrieved]),
            memories_created_json=json.dumps(memories_created),
        )
        self.session.add(user_msg)
        await self.session.flush()

        return user_msg, memories_retrieved

    async def process_assistant_response(self, content: str, session_id: str = "default") -> ConversationMessage:
        """Store an assistant response as short_term memory."""
        memories_created: list[str] = []

        mem = await self.create_memory(content, "short_term", 0.5 + (hash(content) % 40) / 100, ["assistant-response"])
        memories_created.append(mem.uid)

        # Check for procedural patterns
        if re.search(r"\b(how to|steps|process|method|technique)\b", content, re.IGNORECASE):
            proc = await self.create_memory(content, "procedural", 0.7, ["procedural-knowledge"])
            memories_created.append(proc.uid)

        # Check for episodic markers
        if re.search(r"\b(experience|happened|event|story|when)\b", content, re.IGNORECASE):
            epi = await self.create_memory(content, "episodic", 0.65, ["episodic-memory"])
            memories_created.append(epi.uid)

        msg = ConversationMessage(
            uid=_uid(),
            session_id=session_id,
            role="assistant",
            content=content,
            timestamp=_utcnow(),
            memories_accessed_json="[]",
            memories_created_json=json.dumps(memories_created),
        )
        self.session.add(msg)
        await self.session.flush()
        return msg

    async def get_conversation_history(self, session_id: str = "default", limit: int = 50) -> list[ConversationMessage]:
        result = await self.session.execute(
            select(ConversationMessage)
            .where(ConversationMessage.session_id == session_id)
            .order_by(ConversationMessage.timestamp.desc())
            .limit(limit)
        )
        msgs = list(result.scalars().all())
        msgs.reverse()
        return msgs

    async def clear_conversation(self, session_id: str = "default") -> None:
        """Delete all messages in a specific session."""
        result = await self.session.execute(
            select(ConversationMessage).where(ConversationMessage.session_id == session_id)
        )
        for msg in result.scalars().all():
            await self.session.delete(msg)
        await self.session.flush()

    # --- Seed demo data ------------------------------------------------------

    async def seed_demo_data(self) -> None:
        """Populate the database with demo memories if empty."""
        count_result = await self.session.execute(select(func.count(Memory.id)))
        if count_result.scalar() > 0:
            return

        demo = [
            ("User mentioned wanting to understand hierarchical memory management for LLMs", "sensory", 0.7, ["memory", "hierarchy"]),
            ("Key concept: working memory in transformer attention mechanisms", "sensory", 0.6, ["transformer", "attention"]),
            ("Memory consolidation mimics hippocampal replay during sleep cycles", "sensory", 0.65, ["consolidation", "hippocampus"]),
            ("Short-term buffer decays exponentially without reinforcement", "sensory", 0.55, ["decay", "short-term"]),
            ("Procedural memories encode step-by-step reasoning patterns", "sensory", 0.5, ["procedural", "reasoning"]),
            ("Hierarchical memory systems separate storage by retention duration and access patterns", "short_term", 0.75, ["hierarchy", "storage"]),
            ("The memory manager uses importance scores to determine promotion between tiers", "short_term", 0.7, ["importance", "promotion"]),
            ("Consolidation promotes frequently-accessed memories from short-term to long-term storage", "short_term", 0.68, ["consolidation", "long-term"]),
            ("Effective LLM memory systems implement 3-5 distinct tiers with different decay rates and capacities", "long_term", 0.85, ["llm", "tiers", "decay"]),
            ("Memory retrieval uses cosine similarity combined with recency and importance weighting", "long_term", 0.82, ["retrieval", "similarity"]),
            ("Session 1: User demonstrated how memory operations flow from sensory input through consolidation to long-term storage", "episodic", 0.78, ["session", "demonstration"]),
            ("Steps to retrieve relevant memories: 1) tokenize query 2) compute similarity 3) apply importance weighting 4) return top-k results", "procedural", 0.9, ["retrieval", "algorithm"]),
        ]

        for content, tier, importance, tags in demo:
            await self.create_memory(content, tier, importance, tags)
        await self.session.commit()

    # --- Internal helpers ----------------------------------------------------

    @staticmethod
    def _extract_tags(text: str) -> list[str]:
        common = {"the", "is", "at", "which", "on", "a", "an", "and", "or", "but", "in", "with", "to", "for", "of", "this", "that", "it", "from"}
        words = re.findall(r"[a-z0-9]+", text.lower())
        return [w for w in words if len(w) > 3 and w not in common][:5]
