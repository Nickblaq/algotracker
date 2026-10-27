"""
Core memory management engine.

Emergent weighted-graph memory:
  - Every memory carries a continuous weight that rises with use
    (recency-weighted access, query similarity, edge strength) and decays
    against time since it was last used. There are no tiers and no
    promotion thresholds.
  - Memories retrieved together are linked by edges, which strengthen on
    co-retrieval and are seeded from embedding similarity at creation.
  - Retrieval blends query similarity with the stored weight, so memories
    that keep mattering keep surfacing — and ones that don't fade out.

  - TF-IDF vector embeddings via scikit-learn
  - Async SQLAlchemy persistence

Usage:
    manager = MemoryManager(session)
    await manager.create_memory(...)
    results = await manager.retrieve_memories(query="...", top_k=5)
"""

from __future__ import annotations

import itertools
import json
import math
import re
import time
import uuid
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    EDGE_DECAY_PER_HOUR,
    WEIGHT_DECAY_PER_HOUR,
    ConversationMessage,
    Memory,
    MemoryEdge,
)


def _uid() -> str:
    return f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:7]}"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --- Tuning -------------------------------------------------------------------

# Retrieval score = weighted blend of what the query says and how strong the
# memory already is.
RETRIEVAL_W_SIM = 0.5        # TF-IDF cosine similarity to the query
RETRIEVAL_W_WEIGHT = 0.4     # emergent weight (use + edges + recency)
RETRIEVAL_W_IMPORTANCE = 0.1  # authored importance seed

# On retrieval, weight rises by this blend of the signals that just proved the
# memory relevant, scaled by remaining headroom (so it approaches 1.0 with
# diminishing gains). Use only ever raises weight; only time lowers it.
ACCESS_W_SIM = 0.5         # how well it matched this query
ACCESS_W_NEIGHBOR = 0.3    # strength of its graph neighborhood

# Two memories embedding this similarly are linked at creation time.
SIM_EDGE_THRESHOLD = 0.7
# Each co-retrieval adds this much edge strength (capped at 1.0).
CO_RETRIEVAL_BOOST = 0.1
# A memory weaker than this and structurally isolated is forgettable.
PRUNE_WEIGHT_FLOOR = 0.05
PRUNE_EDGE_FLOOR = 0.02


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

    # --- Graph: edges ---------------------------------------------------------

    async def _find_edge(self, a: str, b: str) -> MemoryEdge | None:
        low, high = (a, b) if a <= b else (b, a)
        result = await self.session.execute(
            select(MemoryEdge).where(
                MemoryEdge.from_uid == low, MemoryEdge.to_uid == high
            )
        )
        return result.scalar_one_or_none()

    async def _associate(self, uids: list[str]) -> None:
        """Strengthen the edge between every pair of memories retrieved together."""
        unique = list(dict.fromkeys(uids))
        if len(unique) < 2:
            return
        now = _utcnow()
        for a, b in itertools.combinations(unique, 2):
            edge = await self._find_edge(a, b)
            if edge is not None:
                edge.weight = min(1.0, edge.weight + CO_RETRIEVAL_BOOST)
                edge.last_hit = now
            else:
                low, high = (a, b) if a <= b else (b, a)
                self.session.add(
                    MemoryEdge(
                        from_uid=low,
                        to_uid=high,
                        weight=CO_RETRIEVAL_BOOST,
                        last_hit=now,
                    )
                )
        await self.session.flush()

    async def _seed_edges_from_similarity(self, mem: Memory, others: list[Memory]) -> None:
        """Link a brand-new memory to embeddings it already resembles."""
        if not mem.embedding:
            return
        vec = np.array(mem.embedding, dtype=float)
        now = _utcnow()
        for other in others:
            if other.uid == mem.uid or not other.embedding:
                continue
            ovec = np.array(other.embedding, dtype=float)
            sim = self._cosine_sim(vec, ovec)
            if sim < SIM_EDGE_THRESHOLD:
                continue
            existing = await self._find_edge(mem.uid, other.uid)
            if existing is None:
                low, high = (mem.uid, other.uid) if mem.uid <= other.uid else (other.uid, mem.uid)
                self.session.add(
                    MemoryEdge(
                        from_uid=low,
                        to_uid=high,
                        weight=min(1.0, sim),
                        last_hit=now,
                    )
                )
        await self.session.flush()

    async def _neighbor_weight(self, uid: str, now: datetime) -> float:
        """Decayed edge strength × neighbor weight, averaged over all neighbors.

        The PageRank-flavoured signal: memories linked to strong memories are
        themselves worth more.
        """
        result = await self.session.execute(
            select(MemoryEdge).where(
                (MemoryEdge.from_uid == uid) | (MemoryEdge.to_uid == uid)
            )
        )
        edges = list(result.scalars().all())
        if not edges:
            return 0.0

        other_uids = [
            e.to_uid if e.from_uid == uid else e.from_uid for e in edges
        ]
        mems_result = await self.session.execute(
            select(Memory).where(Memory.uid.in_(other_uids))
        )
        by_uid = {m.uid: m for m in mems_result.scalars().all()}

        scores: list[float] = []
        for edge in edges:
            other_uid = edge.to_uid if edge.from_uid == uid else edge.from_uid
            other = by_uid.get(other_uid)
            if other is None:
                continue
            hit = edge.last_hit if edge.last_hit.tzinfo else edge.last_hit.replace(tzinfo=timezone.utc)
            edge_age_h = max(0.0, (now - hit).total_seconds() / 3600.0)
            edge_strength = edge.weight * math.exp(-EDGE_DECAY_PER_HOUR * edge_age_h)
            scores.append(edge_strength * other.effective_weight(now))

        return sum(scores) / len(scores) if scores else 0.0

    async def _has_live_edges(self, uid: str, now: datetime) -> bool:
        """True while the memory still has any edge strong enough to matter."""
        result = await self.session.execute(
            select(MemoryEdge).where(
                (MemoryEdge.from_uid == uid) | (MemoryEdge.to_uid == uid)
            )
        )
        for edge in result.scalars().all():
            hit = edge.last_hit if edge.last_hit.tzinfo else edge.last_hit.replace(tzinfo=timezone.utc)
            age_h = max(0.0, (now - hit).total_seconds() / 3600.0)
            if edge.weight * math.exp(-EDGE_DECAY_PER_HOUR * age_h) >= PRUNE_EDGE_FLOOR:
                return True
        return False

    async def _delete_edges_for(self, uid: str) -> None:
        from sqlalchemy import delete

        await self.session.execute(
            delete(MemoryEdge).where(
                (MemoryEdge.from_uid == uid) | (MemoryEdge.to_uid == uid)
            )
        )

    async def edge_counts(self, uids: list[str]) -> dict[str, int]:
        """How many edges each given memory has (single batched query)."""
        if not uids:
            return {}
        uid_set = set(uids)
        result = await self.session.execute(
            select(MemoryEdge.from_uid, MemoryEdge.to_uid).where(
                (MemoryEdge.from_uid.in_(uid_set)) | (MemoryEdge.to_uid.in_(uid_set))
            )
        )
        counts = {u: 0 for u in uids}
        for a, b in result.all():
            if a in uid_set:
                counts[a] += 1
            if b in uid_set:
                counts[b] += 1
        return counts

    async def serialize_memories(self, memories: list[Memory]) -> list[dict]:
        """to_dict() for each memory, enriched with its edge count."""
        counts = await self.edge_counts([m.uid for m in memories])
        return [m.to_dict(counts.get(m.uid, 0)) for m in memories]

    # --- Memory CRUD ---------------------------------------------------------

    async def create_memory(
        self,
        content: str,
        importance: float = 0.5,
        tags: list[str] | None = None,
    ) -> Memory:
        importance = max(0.0, min(1.0, importance))
        now = _utcnow()

        mem = Memory(
            uid=_uid(),
            tier="unclassified",  # legacy column, ignored by the graph
            content=content,
            importance=importance,
            weight=importance,  # seeded from authored importance
            access_count=0,
            last_accessed=now,
            created_at=now,
            decay_rate=WEIGHT_DECAY_PER_HOUR,
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

        # Seed graph links from embedding similarity
        await self._seed_edges_from_similarity(mem, all_mems)
        return mem

    async def get_memory(self, uid: str) -> Memory | None:
        return await self._get_memory_by_uid(uid)

    async def list_memories(self) -> list[Memory]:
        # Sort by effective (decayed) weight — the value the API returns — not
        # the stored boost, so the list order matches what clients display.
        result = await self.session.execute(select(Memory))
        mems = list(result.scalars().all())
        now = _utcnow()
        mems.sort(key=lambda m: m.effective_weight(now), reverse=True)
        return mems

    async def delete_memory(self, uid: str) -> bool:
        mem = await self._get_memory_by_uid(uid)
        if mem is None:
            return False
        await self._delete_edges_for(uid)
        await self.session.delete(mem)
        await self.session.flush()
        return True

    # --- Retrieval -----------------------------------------------------------

    async def retrieve_memories(
        self, query: str, top_k: int = 5, reinforce: bool = True
    ) -> list[Memory]:
        """Rank memories by query similarity blended with emergent weight.

        Reads are side-effect free unless `reinforce` is set. Chat uses
        reinforce=False while a turn is in flight, then calls
        `reinforce_memories` once the assistant reply is stored, so a stopped
        or abandoned turn never mutates the graph.
        """
        all_mems = await self._get_all_memories()
        if not all_mems:
            return []

        corpus = [m.content for m in all_mems]
        query_vec = _encoder.encode([query], corpus=corpus)[0]

        now = _utcnow()
        scored: list[tuple[Memory, float, float]] = []

        for mem in all_mems:
            raw_emb = mem.embedding
            mem_vec = np.array(raw_emb, dtype=float) if raw_emb else np.zeros(len(query_vec))
            text_sim = self._cosine_sim(query_vec, mem_vec)
            score = (
                RETRIEVAL_W_SIM * text_sim
                + RETRIEVAL_W_WEIGHT * mem.effective_weight(now)
                + RETRIEVAL_W_IMPORTANCE * mem.importance
            )
            scored.append((mem, score, text_sim))

        scored.sort(key=lambda t: t[1], reverse=True)
        retrieved = [mem for mem, _, _ in scored[:top_k]]

        if not reinforce:
            return retrieved

        # Explicit reinforcement pass (the /api/memories/retrieve endpoint).
        await self.reinforce_memories(query, [m.uid for m in retrieved])
        return retrieved

    async def reinforce_memories(self, query: str, uids: list[str]) -> None:
        """Apply the graph write for one completed turn: link co-retrieved
        memories together, then lift weight and access counts.

        Called only when the assistant reply is stored, in the same
        transaction, so discarded turns leave the graph untouched.
        """
        if not uids:
            return

        all_mems = await self._get_all_memories()
        by_uid = {m.uid: m for m in all_mems}
        targets = [by_uid[uid] for uid in uids if uid in by_uid]
        if not targets:
            return

        corpus = [m.content for m in all_mems]
        query_vec = _encoder.encode([query], corpus=corpus)[0]
        now = _utcnow()

        # Co-retrieval evidence: link everything that came back together
        await self._associate([m.uid for m in targets])

        # Reinforcement: additive boost scaled by headroom — recurring
        # retrieval keeps climbing toward 1.0 with diminishing gains.
        for mem in targets:
            raw_emb = mem.embedding
            mem_vec = np.array(raw_emb, dtype=float) if raw_emb else np.zeros(len(query_vec))
            text_sim = self._cosine_sim(query_vec, mem_vec)
            eff = mem.effective_weight(now)
            neighbor = await self._neighbor_weight(mem.uid, now)
            boost = min(
                1.0, ACCESS_W_SIM * text_sim + ACCESS_W_NEIGHBOR * neighbor
            )
            mem.weight = max(0.0, min(1.0, eff + (1.0 - eff) * boost))
            mem.access_count += 1
            mem.last_accessed = now

        await self.session.flush()

    # --- Search --------------------------------------------------------------

    async def search_memories(self, query: str) -> list[Memory]:
        """Simple text search across memory content and tags."""
        result = await self.session.execute(select(Memory))
        all_mems = list(result.scalars().all())

        query_lower = query.lower()
        results = []
        for mem in all_mems:
            content_match = query_lower in mem.content.lower()
            tag_match = any(query_lower in tag.lower() for tag in mem.tags)
            if content_match or tag_match:
                results.append(mem)

        now = _utcnow()
        results.sort(key=lambda m: m.effective_weight(now), reverse=True)
        return results

    # --- Pruning -------------------------------------------------------------

    async def prune_memories(self) -> int:
        """Forget what's forgettable: too weak to recall and graph-isolated.

        Weak-but-connected memories survive — their neighbors keep them alive
        until the edges themselves decay.
        """
        now = _utcnow()
        all_mems = await self._get_all_memories()
        pruned = 0

        for mem in all_mems:
            if mem.effective_weight(now) >= PRUNE_WEIGHT_FLOOR:
                continue
            if await self._has_live_edges(mem.uid, now):
                continue
            await self._delete_edges_for(mem.uid)
            await self.session.delete(mem)
            pruned += 1

        await self.session.flush()
        return pruned

    # --- Chat integration ----------------------------------------------------

    async def process_user_message(self, content: str, session_id: str = "default") -> tuple[ConversationMessage, list[Memory]]:
        """Process a user chat message: retrieve context memories, create sensory memory.

        Retrieval is read-only here — the memories this turn used only gain
        weight once the assistant reply is stored.
        """
        memories_retrieved = await self.retrieve_memories(content, top_k=3, reinforce=False)
        memories_created: list[str] = []

        # Extract key sentences and store them as new memories
        sentences = re.split(r"[.!?]+", content)
        key_phrases = [s.strip() for s in sentences if len(s.strip()) > 10][:3]

        for phrase in key_phrases:
            tags = self._extract_tags(content)
            mem = await self.create_memory(phrase, 0.6 + (hash(phrase) % 30) / 100, tags)
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

    async def process_assistant_response(
        self, content: str, session_id: str = "default", reinforce: bool = True
    ) -> ConversationMessage:
        """Store an assistant response, then reinforce what the turn recalled.

        Both writes happen together, so a completed turn is atomic: either the
        reply and its weight boosts land, or neither does.
        """
        # The turn's recalled memories belong to this reply too: storing them
        # on the assistant message is what lets the UI show which memories a
        # reply actually used.
        memories_used: list[str] = []
        if reinforce:
            last_user = await self.last_user_message(session_id)
            if last_user is not None:
                memories_used = list(last_user.memories_accessed)
                await self.reinforce_memories(
                    last_user.content, memories_used
                )

        tags = ["assistant-response"]
        if re.search(r"\b(how to|steps|process|method|technique)\b", content, re.IGNORECASE):
            tags.append("procedural-knowledge")
        if re.search(r"\b(experience|happened|event|story|when)\b", content, re.IGNORECASE):
            tags.append("episodic-memory")

        mem = await self.create_memory(
            content, 0.5 + (hash(content) % 40) / 100, tags
        )

        msg = ConversationMessage(
            uid=_uid(),
            session_id=session_id,
            role="assistant",
            content=content,
            timestamp=_utcnow(),
            memories_accessed_json=json.dumps(memories_used),
            memories_created_json=json.dumps([mem.uid]),
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

    async def last_user_message(self, session_id: str = "default") -> ConversationMessage | None:
        """Most recent user message in a session (the turn being answered)."""
        result = await self.session.execute(
            select(ConversationMessage)
            .where(
                ConversationMessage.session_id == session_id,
                ConversationMessage.role == "user",
            )
            .order_by(ConversationMessage.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_sessions(self) -> list[dict]:
        """Every session with its title, message count and last activity."""
        result = await self.session.execute(
            select(ConversationMessage).order_by(ConversationMessage.id.desc())
        )
        sessions: dict[str, dict] = {}
        for msg in result.scalars().all():
            info = sessions.get(msg.session_id)
            if info is None:
                info = {
                    "sessionId": msg.session_id,
                    "title": msg.content[:80],
                    "messageCount": 0,
                    "lastActivity": 0,
                }
                sessions[msg.session_id] = info
            info["messageCount"] += 1
            if msg.title:
                info["title"] = msg.title
            ts = int(msg.timestamp.replace(tzinfo=timezone.utc).timestamp() * 1000) \
                if msg.timestamp.tzinfo is None else int(msg.timestamp.timestamp() * 1000)
            info["lastActivity"] = max(info["lastActivity"], ts)
        return sorted(sessions.values(), key=lambda s: s["lastActivity"], reverse=True)

    async def truncate_between(
        self, session_id: str, after_uid: str, before_uid: str
    ) -> int:
        """Delete messages from `after_uid` (inclusive) up to `before_uid`.

        Used by edit-and-resend: the old copy of the edited message and every
        stale turn after it go, while the freshly stored turn (the bound)
        stays — the edit becomes the newest message. Nothing outside the
        session is touched and no memory is deleted.
        """
        result = await self.session.execute(
            select(ConversationMessage)
            .where(ConversationMessage.session_id == session_id)
            .order_by(ConversationMessage.id)
        )
        msgs = list(result.scalars().all())
        index = {m.uid: i for i, m in enumerate(msgs)}
        if after_uid not in index or before_uid not in index:
            return 0
        low, high = index[after_uid], index[before_uid]
        if high <= low:
            return 0
        removed = 0
        for msg in msgs[low:high]:
            await self.session.delete(msg)
            removed += 1
        await self.session.flush()
        return removed

    async def recompute_weights(self) -> dict:
        """Rebuild the graph deterministically from what can be trusted.

        Stored weights are derived values, so they can always be recomputed
        from authored importance plus access history, after which damaged
        edges are dropped and faded, isolated memories are pruned. This is the
        recovery path when anything looks wrong in the graph.
        """
        all_mems = await self._get_all_memories()
        valid_uids = {m.uid for m in all_mems}

        result = await self.session.execute(select(MemoryEdge))
        edges_removed = 0
        for edge in result.scalars().all():
            if edge.from_uid not in valid_uids or edge.to_uid not in valid_uids:
                await self.session.delete(edge)
                edges_removed += 1

        reweighted = 0
        for mem in all_mems:
            usage = min(1.0, mem.access_count / 10.0)
            mem.weight = max(0.0, min(1.0, 0.35 * mem.importance + 0.65 * usage))
            reweighted += 1
        await self.session.flush()

        pruned = await self.prune_memories()
        return {
            "reweighted": reweighted,
            "edgesRemoved": edges_removed,
            "pruned": pruned,
        }

    # --- Internal helpers ----------------------------------------------------

    @staticmethod
    def _extract_tags(text: str) -> list[str]:
        common = {"the", "is", "at", "which", "on", "a", "an", "and", "or", "but", "in", "with", "to", "for", "of", "this", "that", "it", "from"}
        words = re.findall(r"[a-z0-9]+", text.lower())
        return [w for w in words if len(w) > 3 and w not in common][:5]
