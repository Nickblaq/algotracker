"""
Agent registry — defines available agent types and their step sequences.

Each agent type declares:
  - name: human-readable name
  - steps: ordered list of step names
  - execute_step(step_name, task, context) -> dict: runs one step and returns output

The task executor calls execute_step for each step in sequence, writing
checkpoints after each successful step. On resume, completed steps are skipped.
"""

from __future__ import annotations

import asyncio
import json
import random
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from .models import Task


class AgentStep:
    """Defines a single step in an agent's pipeline."""

    def __init__(self, name: str, description: str = "") -> None:
        self.name = name
        self.description = description


class AgentDefinition:
    """Defines an agent type with its step sequence and execution logic."""

    def __init__(self, agent_id: str, name: str, steps: list[AgentStep]) -> None:
        self.agent_id = agent_id
        self.name = name
        self.steps = steps

    async def execute_step(
        self,
        step_name: str,
        task: "Task",
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """Execute a single step. Override in subclasses or use the registry."""
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Built-in agents
# ---------------------------------------------------------------------------

class MemoryConsolidationAgent(AgentDefinition):
    """Runs decay, consolidation, and pruning across all memory tiers."""

    def __init__(self) -> None:
        super().__init__(
            agent_id="memory_consolidation",
            name="Memory Consolidator",
            steps=[
                AgentStep("fetch_memories", "Load all memories from database"),
                AgentStep("apply_decay", "Apply exponential decay to importance scores"),
                AgentStep("consolidate", "Promote memories meeting tier thresholds"),
                AgentStep("prune", "Remove low-importance unused memories"),
                AgentStep("recompute_stats", "Update system statistics"),
            ],
        )

    async def execute_step(
        self,
        step_name: str,
        task: "Task",
        context: dict[str, Any],
    ) -> dict[str, Any]:
        from .database import async_session
        from .memory_manager import MemoryManager

        async with async_session() as session:
            mgr = MemoryManager(session)

            if step_name == "fetch_memories":
                all_mems = await mgr._get_all_memories()
                context["memory_count"] = len(all_mems)
                return {"memoryCount": len(all_mems)}

            elif step_name == "apply_decay":
                deleted = await mgr.decay_all_memories()
                await session.commit()
                return {"decayed": deleted}

            elif step_name == "consolidate":
                count = await mgr.consolidate_memories()
                await session.commit()
                return {"consolidated": count}

            elif step_name == "prune":
                count = await mgr.prune_memories()
                await session.commit()
                return {"pruned": count}

            elif step_name == "recompute_stats":
                stats = await mgr.get_stats()
                return stats

        return {}


class KnowledgeExtractionAgent(AgentDefinition):
    """Analyzes text and extracts structured memories with embeddings."""

    def __init__(self) -> None:
        super().__init__(
            agent_id="knowledge_extraction",
            name="Knowledge Extractor",
            steps=[
                AgentStep("receive_input", "Parse and validate input text"),
                AgentStep("chunk_text", "Split text into processable chunks"),
                AgentStep("extract_concepts", "Identify key concepts and entities"),
                AgentStep("create_memories", "Store extracted knowledge as memories"),
                AgentStep("build_associations", "Link related memories together"),
            ],
        )

    async def execute_step(
        self,
        step_name: str,
        task: "Task",
        context: dict[str, Any],
    ) -> dict[str, Any]:
        import re
        from .database import async_session
        from .memory_manager import MemoryManager

        text = task.input_params.get("text", "")

        if step_name == "receive_input":
            word_count = len(text.split())
            sentence_count = len(re.split(r'[.!?]+', text))
            context["text"] = text
            return {"wordCount": word_count, "sentenceCount": sentence_count}

        elif step_name == "chunk_text":
            words = text.split()
            chunk_size = 100
            chunks = [" ".join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size)]
            context["chunks"] = chunks
            return {"chunkCount": len(chunks), "totalWords": len(words)}

        elif step_name == "extract_concepts":
            chunks = context.get("chunks", [text])
            concepts = []
            for chunk in chunks:
                sentences = re.split(r'[.!?]+', chunk)
                for s in sentences:
                    s = s.strip()
                    if len(s) > 15:
                        concepts.append(s)
            context["concepts"] = concepts[:20]
            return {"conceptCount": len(concepts[:20])}

        elif step_name == "create_memories":
            from .database import async_session as sess
            async with sess() as session:
                mgr = MemoryManager(session)
                concepts = context.get("concepts", [])
                created = 0
                for concept in concepts:
                    tags = mgr._extract_tags(concept)
                    await mgr.create_memory(concept, "sensory", 0.6 + random.random() * 0.3, tags)
                    created += 1
                await session.commit()
                return {"memoriesCreated": created}

        elif step_name == "build_associations":
            return {"associationsCreated": 0}

        return {}


class ChatSummarizationAgent(AgentDefinition):
    """Summarizes a conversation into long-term memories."""

    def __init__(self) -> None:
        super().__init__(
            agent_id="chat_summarization",
            name="Chat Summarizer",
            steps=[
                AgentStep("fetch_history", "Load conversation messages"),
                AgentStep("retrieve_context", "Fetch relevant memories for context"),
                AgentStep("summarize", "Generate summary of conversation key points"),
                AgentStep("store_summary", "Save summary as long-term memory"),
            ],
        )

    async def execute_step(
        self,
        step_name: str,
        task: "Task",
        context: dict[str, Any],
    ) -> dict[str, Any]:
        from .database import async_session
        from .memory_manager import MemoryManager

        session_id = task.input_params.get("session_id", "default")

        async with async_session() as session:
            mgr = MemoryManager(session)

            if step_name == "fetch_history":
                msgs = await mgr.get_conversation_history(session_id=session_id, limit=100)
                context["messages"] = [m.to_dict() for m in msgs]
                return {"messageCount": len(msgs)}

            elif step_name == "retrieve_context":
                msgs = context.get("messages", [])
                combined = " ".join(m["content"] for m in msgs if m["role"] == "user")
                retrieved = await mgr.retrieve_memories(combined[:500], top_k=5)
                context["context_memories"] = [m.to_dict() for m in retrieved]
                return {"contextMemories": len(retrieved)}

            elif step_name == "summarize":
                msgs = context.get("messages", [])
                user_msgs = [m["content"] for m in msgs if m["role"] == "user"]
                summary = f"Conversation summary: {len(user_msgs)} exchanges. Key topics: {'; '.join(user_msgs[:3])}"
                context["summary"] = summary
                return {"summaryLength": len(summary)}

            elif step_name == "store_summary":
                summary = context.get("summary", "")
                if summary:
                    mem = await mgr.create_memory(summary, "long_term", 0.8, ["conversation-summary"])
                    await session.commit()
                    return {"memoryId": mem.uid}

        return {}


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

_REGISTRY: dict[str, AgentDefinition] = {}


def register_agent(agent: AgentDefinition) -> None:
    _REGISTRY[agent.agent_id] = agent


def get_agent(agent_id: str) -> AgentDefinition | None:
    return _REGISTRY.get(agent_id)


def list_agents() -> list[dict]:
    return [
        {"id": a.agent_id, "name": a.name, "stepCount": len(a.steps)}
        for a in _REGISTRY.values()
    ]


def get_agent_steps(agent_id: str) -> list[str]:
    agent = _REGISTRY.get(agent_id)
    if agent:
        return [s.name for s in agent.steps]
    return []


# Register built-in agents
register_agent(MemoryConsolidationAgent())
register_agent(KnowledgeExtractionAgent())
register_agent(ChatSummarizationAgent())
