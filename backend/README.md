# UrbanPulse Backend Service (`backend/`)

Asynchronous FastAPI backend providing real-time spatial APIs, WebSocket event broadcasting, data ingestion pipelines, and asynchronous worker orchestration for UrbanPulse (Mysuru & Bengaluru).

## Directory Structure

```
backend/
├── app/
│   ├── api/          # REST & WebSocket route handlers (v1 endpoints: incidents, traffic, weather)
│   ├── agents/       # Real-time event orchestrators bridging incoming telemetry to AI reasoning
│   ├── core/         # Application settings, security, logging, and database configs
│   ├── db/           # Async SQLAlchemy session management and base classes
│   ├── models/       # ORM database models (PostGIS spatial geometry tables)
│   ├── schemas/      # Pydantic schemas for request validation & serialization
│   ├── services/     # Core domain business logic (50 km radius spatial queries, city detection)
│   ├── pipelines/    # Real-time data ingestion pipelines (traffic sensor feeds, weather, municipal alerts)
│   ├── workers/      # Celery / Redis background workers for heavy async processing
│   └── utils/        # Geospatial conversions, coordinate math, and formatting helpers
├── tests/            # Automated test suite (unit, integration, and spatial API tests)
├── requirements.txt  # Python dependency specifications
└── Dockerfile        # Container build definition
```

## Running the Backend

```bash
# Set up virtual environment
python -m venv .venv
source .venv/bin/activate  # Or on Windows: .venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
