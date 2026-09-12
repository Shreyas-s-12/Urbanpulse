# UrbanPulse

> **Real-Time Urban Intelligence Platform**  
> Initial focus: **Mysuru** & **Bengaluru**, Karnataka, India.

---

## 1. Overview

UrbanPulse is an intelligent, real-time spatial platform designed to monitor, analyze, and optimize urban dynamics. Operating with a configurable **50 km geographic intelligence radius**, the platform harmonizes live sensor streams, user-reported incidents, computer vision inference, and autonomous multi-agent systems to deliver actionable insights.

### Core Capabilities:
- **Live User Location & City Detection**: Automatic spatial bounding and detection for Mysuru and Bengaluru.
- **50 km Geographic Intelligence Radius**: Real-time spatial indexing and proximity analytics around active users or city centers.
- **Multimodal City Sensing**:
  - Traffic flow, congestion, and dynamic routing
  - Road conditions, pothole detection, and accident reports
  - Hazard tracking: Fire incidents, waterlogging & flooding alerts
  - Environmental vitals: Weather, air quality, cleanliness, and tree cover
- **Vision & AI Intelligence**:
  - On-device and server-side computer vision for automated road hazard classification
  - Multi-agent orchestration for civic hazard response recommendations
  - Retrieval-Augmented Generation (RAG) for localized municipal regulations and incident history
  - Predictive severity scoring and incident escalation
- **3D Urban Visualization**: Immersive spatial digital twin rendering city assets and real-time pulse layers.

---

## 2. Monorepo Architecture

UrbanPulse is organized as a modular, production-oriented monorepo with clear separation of concerns:

```
urbanpulse/
├── frontend/             # Next.js & TypeScript client architecture
├── backend/              # Python FastAPI async backend, pipelines, & workers
├── ai/                   # Vision, RAG, multi-agent intelligence, & evaluation
├── database/             # PostGIS schemas, migrations, spatial functions, & seeds
├── shared/               # Cross-cutting contracts, constants, enums, & schemas
├── scripts/              # Setup, database seeding, and operational scripts
├── docs/                 # Architectural specifications, ADRs, & API guides
├── .env.example          # Environment variable template
├── .gitignore            # Multi-stack repository ignore rules
└── docker-compose.yml    # Development environment container orchestration
```

---

## 3. Directory Responsibilities

| Directory | Core Responsibilities |
|---|---|
| [`frontend/`](./frontend) | Next.js App Router, modular features (traffic, hazards, 3D map), reactive stores, and services. |
| [`backend/`](./backend) | FastAPI REST & WebSocket APIs, geospatial querying, data ingestion pipelines, Celery background workers. |
| [`ai/`](./ai) | Computer vision models, autonomous agent graphs, city RAG vector stores, and severity prediction models. |
| [`database/`](./database) | PostgreSQL + PostGIS spatial tables, Alembic migrations, Mysuru/Bengaluru seed boundaries, and spatial indexes. |
| [`shared/`](./shared) | Language-agnostic types, geographic constants (50 km radius, bounding boxes), incident enums, and schemas. |
| [`scripts/`](./scripts) | Automated developer onboarding, environment bootstrap, and database spatial seeding. |
| [`docs/`](./docs) | Architecture Decision Records (ADRs), system design documentation, and telemetry guidelines. |

---

## 4. Getting Started

### Prerequisites
- **Node.js** >= 18.x
- **Python** >= 3.10
- **Docker & Docker Compose**
- **PostgreSQL 16+ with PostGIS 3.4+** (provided via Docker Compose)

### Quick Start
1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
2. Start the database and cache infrastructure:
   ```bash
   docker-compose up -d db redis
   ```
3. Initialize the development environment using the setup script:
   ```powershell
   ./scripts/setup_dev.ps1
   ```

---

## 5. Architectural Standards

- **Boundaries**: Business logic belongs in `backend/app/services` or `ai/`. Presentation logic is strictly isolated to `frontend/`.
- **Spatial Precision**: All spatial coordinates utilize the WGS 84 (EPSG:4326) reference system.
- **Deterministic Contracts**: Shared enums and schemas in `shared/` form the single source of truth across frontend, backend, and AI agents.
