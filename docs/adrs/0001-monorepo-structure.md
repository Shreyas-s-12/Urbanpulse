# ADR 0001: Scalable Monorepo Architecture for UrbanPulse

## Status
Accepted

## Context
UrbanPulse combines a real-time web and 3D visualization frontend, high-performance geospatial backend, computer vision pipelines, multi-agent RAG systems, and PostGIS spatial databases. Keeping these disparate services organized without operational friction or coupling requires a well-defined monorepo structure.

## Decision
We adopt a domain-oriented monorepo layout:
- `frontend/`: TypeScript & Next.js client.
- `backend/`: FastAPI Python service managing REST/WebSocket endpoints and 50km spatial filtering.
- `ai/`: Autonomous agent graphs, computer vision models (pothole/hazard detection), RAG, and severity forecasting.
- `database/`: PostgreSQL / PostGIS schemas, spatial functions, and city seed geometry.
- `shared/`: Shared cross-cutting contracts, types, constants, and enums.
- `scripts/`: Devops and database bootstrapping scripts.
- `docs/`: Architecture decision records and telemetry specifications.

## Consequences
- Clean boundaries between frontend presentation and backend spatial queries.
- Prevents UI code from leaking into business logic.
- Enables autonomous deployment of individual services while sharing core spatial constants and domain schemas.
