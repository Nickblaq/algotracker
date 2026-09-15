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


class MemoryUpdate(BaseModel):
    content: str | None = None
    tier: Literal["sensory", "short_term", "long_term", "episodic", "procedural"] | None = None
    importance: float | None = Field(default=None, ge=0.0, le=1.0)
    tags: list[str] | None = None


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
    associations: list[str]
    consolidated: bool


class MemoryListResponse(BaseModel):
    memories: list[MemoryResponse]
    total: int


class MemorySearchRequest(BaseModel):
    query: str
    tier: str | None = None
    top_k: int = Field(default=10, ge=1, le=100)


class MemoryAssociateRequest(BaseModel):
    from_id: str
    to_id: str


# --- Conversation Schemas -----------------------------------------------------


class ChatRequest(BaseModel):
    content: str
    session_id: str = "default"
    api_key: str = ""  # optional — used if the caller wants server-side OpenRouter calls


class ConversationMessageResponse(BaseModel):
    id: str
    sessionId: str
    role: str
    content: str
    timestamp: int
    memoriesAccessed: list[str]
    memoriesCreated: list[str]


class SessionResponse(BaseModel):
    id: str
    title: str
    messageCount: int
    lastMessageAt: int


class ConversationResetRequest(BaseModel):
    pass


# --- Operation Schemas --------------------------------------------------------


class OperationResponse(BaseModel):
    id: str
    type: str
    sourceTier: str
    targetTier: str | None
    memoryId: str
    timestamp: int
    details: str


# --- Stats Schemas ------------------------------------------------------------


class TierCounts(BaseModel):
    sensory: int = 0
    short_term: int = 0
    long_term: int = 0
    episodic: int = 0
    procedural: int = 0


class StatsResponse(BaseModel):
    totalMemories: int
    tierCounts: TierCounts
    avgImportance: float
    consolidationRate: float
    retrievalAccuracy: float
    memoryUtilization: float


# --- Misc ---------------------------------------------------------------------


class HealthResponse(BaseModel):
    status: str
    version: str
    memory_count: int


# --- Task Schemas -------------------------------------------------------------


class TaskCreateRequest(BaseModel):
    type: str
    inputParams: dict = {}


class TaskStepResponse(BaseModel):
    index: int
    name: str
    status: str
    input: dict | None = None
    output: dict | None = None
    error: str | None = None
    agentId: str | None = None
    startedAt: int | None = None
    completedAt: int | None = None
    checkpoint: dict | None = None


class TaskResponse(BaseModel):
    id: str
    type: str
    status: str
    agentId: str | None = None
    inputParams: dict
    result: dict | None = None
    progress: int
    errorMessage: str | None = None
    currentStep: int
    totalSteps: int
    createdAt: int
    startedAt: int | None = None
    completedAt: int | None = None
    updatedAt: int
    steps: list[TaskStepResponse]


class TaskListResponse(BaseModel):
    tasks: list[TaskResponse]
    total: int
