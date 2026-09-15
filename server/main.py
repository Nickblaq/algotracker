"""
FastAPI application entry point for the Hierarchical Memory for LLMs backend.

Run with:
    uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload

Or via Python:
    python -m server.main
"""

from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import async_session, init_db
from .memory_manager import MemoryManager
from .routes.memories import router as memories_router
from .routes.chat import router as chat_router
from .routes.stats import router as stats_router
from .routes.tasks import router as tasks_router
from .schemas import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables, seed demo data, resume interrupted tasks."""
    await init_db()
    async with async_session() as session:
        manager = MemoryManager(session)
        await manager.seed_demo_data()

    # Resume any interrupted tasks from previous run
    from .task_executor import resume_interrupted_tasks
    resumed = await resume_interrupted_tasks()
    if resumed:
        print(f"  ↻ Resumed {resumed} interrupted task(s)")

    yield
    # Shutdown: nothing special needed


app = FastAPI(
    title="Hierarchical Memory for LLMs — Backend API",
    description=(
        "REST API for the HMM memory system. Provides persistent memory storage, "
        "TF-IDF vector embeddings, decay/consolidation, and conversation context "
        "via an async SQLAlchemy + SQLite backend."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# --- CORS ---------------------------------------------------------------------
# Allow the Vite dev server (typically :5173) and the preview server (:4173).
# In production the frontend and API may share an origin.

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173",
        "http://0.0.0.0:5173",
        "http://0.0.0.0:4173",
        "*",  # relaxed for development; tighten in production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routes -------------------------------------------------------------------

app.include_router(memories_router)
app.include_router(chat_router)
app.include_router(stats_router)
app.include_router(tasks_router)


@app.get("/")
async def root():
    """Root endpoint — confirms the backend is running."""
    return {
        "service": "hmm-backend",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    async with async_session() as session:
        from sqlalchemy import func, select
        from .models import Memory
        result = await session.execute(select(func.count(Memory.id)))
        count = result.scalar() or 0
    return HealthResponse(status="ok", version="1.0.0", memory_count=count)


# --- CLI entry point ----------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "server.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )
