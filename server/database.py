"""
Async SQLAlchemy database setup with SQLite.
Provides the engine, session factory, and base model.
"""

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = "sqlite+aiosqlite:///./hmm_data.db"


class Base(DeclarativeBase):
    pass


engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def _add_missing_columns(sync_conn):
    """Migrate pre-weight databases: add memories.weight, backfill it.

    `create_all` only creates missing tables, so an existing hmm_data.db
    created before the graph rework needs the weight column added explicitly.
    """
    from sqlalchemy import text

    cols = [row[1] for row in sync_conn.exec_driver_sql("PRAGMA table_info(memories)")]
    if "weight" not in cols:
        sync_conn.exec_driver_sql(
            "ALTER TABLE memories ADD COLUMN weight FLOAT NOT NULL DEFAULT 0.5"
        )
        # Existing memories start their emergent life from authored importance.
        sync_conn.execute(text("UPDATE memories SET weight = importance"))


async def init_db():
    """Create all tables and apply lightweight migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)


async def get_session() -> AsyncSession:  # type: ignore[misc]
    """Dependency that yields a database session."""
    async with async_session() as session:
        yield session
