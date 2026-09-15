from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

import socket

# Async engine creation with automatic probe and fallback to SQLite if PostgreSQL is unavailable
url = settings.DATABASE_URL
if url.startswith("postgresql"):
    try:
        import asyncpg  # noqa: F401
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.3)
        sock.connect(("localhost", 5432))
        sock.close()
    except Exception:
        # Fallback to SQLite for environments without running PostgreSQL
        url = "sqlite+aiosqlite:///./test.db"
engine = create_async_engine(url, echo=settings.DEBUG, future=True)

# Session factory
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# Base class for declarative models
Base = declarative_base()

# Auto-initialize tables when running in SQLite local dev/test mode
if url.startswith("sqlite"):
    try:
        from sqlalchemy import create_engine
        sync_url = url.replace("+aiosqlite", "")
        sync_engine = create_engine(sync_url)
        from app.models.monitor import Monitor  # noqa: F401
        from app.models.alert import Alert  # noqa: F401
        from app.models.urban_memory import UrbanMemory  # noqa: F401
        Base.metadata.create_all(bind=sync_engine)
    except Exception:
        pass

# Dependency for FastAPI routes
async def get_db() -> AsyncSession:
    async with async_session_factory() as session:
        yield session
