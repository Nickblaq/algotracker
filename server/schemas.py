"""
Pydantic schemas for request validation and response serialization.
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Literal


# --- Memory Schemas -----------------------------------------------------------


class MemoryCreate(BaseModel):
    content: str
    tier: Literal["sensory", "short_term", "long_term", "episodic", "procedural"] = "sensory"
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    tags: list[str] = []


class MemoryResponse(BaseModel):
    id: str
    tier: str
    content: str
    importance: float
    accessCount: int
    lastAccessed: int  # epoch ms
    createdAt: int  # epoch ms
    decayRate: float
    tags: list[str]
    metadata: dict
    consolidated: bool


class MemoryListResponse(BaseModel):
    memories: list[MemoryResponse]
    total: int


class MemorySearchRequest(BaseModel):
    query: str
    tier: str | None = None
    top_k: int = Field(default=10, ge=1, le=100)


# --- Conversation Schemas -----------------------------------------------------


class ChatRequest(BaseModel):
    content: str
    session_id: str = "default"


class ConversationMessageResponse(BaseModel):
    id: str
    sessionId: str
    role: str
    content: str
    timestamp: int
    memoriesAccessed: list[str]
    memoriesCreated: list[str]


# --- Misc ---------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: str
    version: str
    memory_count: int
