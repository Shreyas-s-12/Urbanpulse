"""
UrbanPulse Backend Root Entrypoint
Allows starting the existing FastAPI application with:
    cd C:/Urban Pulse/backend
    py main.py
or:
    python main.py
Re-exports the existing app from app.main without duplicating or rewriting architecture.
"""

import sys
from pathlib import Path
import uvicorn

# Ensure the backend directory is always in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Re-export the existing FastAPI application object
from app.main import app
from app.core.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=settings.DEBUG,
    )
