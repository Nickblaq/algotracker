"""
FastAPI application entry point for the Hierarchical Memory for LLMs backend.

Run with:
    uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload

Or via Python:
    python -m server.main
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import async_session, init_db
from .memory_manager import MemoryManager
from .routes.chat import router as chat_router
from .routes.memories import router as memories_router
from .schemas import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables and seed demo data if the database is empty."""
    await init_db()
    async with async_session() as session:
        manager = MemoryManager(session)
        await manager.seed_demo_data()

    yield


app = FastAPI(
    title="Hierarchical Memory for LLMs — Backend API",
    description=(
        "REST API for the HMM memory system. Provides persistent memory storage "
        "with emergent weights (use + graph edges + similarity, decaying over "
        "time), TF-IDF vector embeddings, and conversation context via an async "
        "SQLAlchemy + SQLite backend."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# --- CORS ---------------------------------------------------------------------
# The Next.js app proxies /api/* through its own origin, so CORS is only needed
# for direct calls from the dev server.

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routes -------------------------------------------------------------------

app.include_router(memories_router)
app.include_router(chat_router)


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

    uvicorn.run(
        "server.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
