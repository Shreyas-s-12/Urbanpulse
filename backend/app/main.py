from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.routes_api import router as v1_router
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.db.database import async_session_factory
from app.services.persisted_monitoring import PersistedMonitoringService

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="UrbanPulse real-time global location-aware urban and environmental intelligence platform API."
)

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def start_scheduler():
    from app.db.database import engine, Base
    from app.models import Monitor, Alert, UrbanMemory  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Run evaluation every 5 minutes
    scheduler.add_job(PersistedMonitoringService.evaluate_monitors, "interval", minutes=5, args=[async_session_factory()])
    try:
        scheduler.start()
    except Exception:
        pass

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 Router
app.include_router(v1_router)

@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "default_radius_km": settings.DEFAULT_INTELLIGENCE_RADIUS_KM,
        "location_mode": "dynamic_global",
    }
