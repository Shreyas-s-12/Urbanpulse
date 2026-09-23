# UrbanPulse

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen.svg)]()
[![API Docs](https://img.shields.io/badge/API%20Docs-Swagger-009688.svg)](http://localhost:8000/docs)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)

> **AI Site & Urban Decision Intelligence Platform**  
> Global, location-agnostic geospatial intelligence, multimodal environmental vitals, deep site suitability assessment, and autonomous civic agents.

---
## Demo Video

[Watch the UrbanPulse Demo Video](https://drive.google.com/file/d/13l3yl2tzEpRuPIabG1XyHCgYPzZYw29_/view?usp=sharing)

## 1. Overview

UrbanPulse is a global, location-agnostic AI decision intelligence platform designed to monitor, analyze, simulate, and optimize urban environments and site selections anywhere in the world. Rather than hardcoding fixed metropolitan boundaries, UrbanPulse dynamically binds to any selected city, town, coordinate pair, property, or administrative region (with initial benchmark telemetry in **Mysuru** and **Bengaluru**).

## Demo Video

**End-to-end UrbanPulse demonstration:**

[Watch the UrbanPulse Demo Video](https://drive.google.com/file/d/13l3yl2tzEpRuPIabG1XyHCgYPzZYw29_/view?usp=sharing)

> This demo demonstrates UrbanPulse as an agentic location-intelligence system, including location analysis, Nexus AI, live geospatial intelligence, GeoRAG, CrisisRAG, AquaRAG, explainable intelligence, and What-If scenario analysis.

### Agentic Workflow Demonstrated

```text
INPUT
Location + Natural-Language Question
        ↓
UNDERSTAND
Nexus interprets intent and location context
        ↓
PLAN
Select relevant intelligence sources and tools
        ↓
USE TOOLS
Maps + Live Data + GeoRAG + CrisisRAG + AquaRAG
        ↓
ANALYZE
Risk Analysis + Forecasting + What-If Scenarios
        ↓
VERIFY
Evidence + Freshness + Coverage + Confidence
        ↓
RECOVER / ESCALATE
Surface missing data, uncertainty, or provider failures
        ↓
DECISION
Explainable Location Intelligence
```

---

### Core Capabilities

- **Global Geospatial Intelligence Canvas**:
  - Non-blocking, resilient Google Maps & 3D WebGL digital twin architecture with an automatic 7-second watchdog recovery.
  - Multi-tier arbitrary coordinates geocoding and global Places search with dynamic radius control (5 km – 250 km).
- **Multimodal Environmental & Civic Vitals**:
  - Real-time traffic flow, congestion levels, and corridor speeds.
  - Live meteorological conditions (Open-Meteo precipitation, temperature, wind gusts).
  - Continuous Air Quality Index (AQI PM2.5 / PM10) monitoring.
  - High-resolution topographical elevation, slope gradient analysis, and hydrological drainage vectors.
- **Specialized Multi-Domain RAG Engines**:
  - **GeoRAG**: Spatial zoning regulations, master plans, and municipal building codes.
  - **CrisisRAG**: Emergency protocols, disaster management historical precedent, and civic resilience pathways.
  - **AquaRAG**: Watershed dynamics, localized flood susceptibility, and storm drain capacity models.
- **Nexus Agent Decision Intelligence**:
  - Structured, typed answer cards (`NexusRankingResponse`, `NexusComparisonResponse`, `NexusConditionResponse`, `NexusForecastResponse`, `NexusScenarioResponse`).
  - Strict URL and HTML sanitization ensuring clean plain-text source provenance without tracking tokens or naked hyperlinks.
- **Site Suitability & Scenario Simulation**:
  - 5-factor weighted suitability assessment (Topography 25%, Flood Safety 25%, Infrastructure 20%, Environmental Quality 15%, Climatic Resilience 15%).
  - Live scenario perturbation models: Monsoonal Rainfall (+75mm/h), Heatwaves (+6°C), and High Squall Wind Events (85 km/h).
- **Live Verified Civic Updates Feed (`/updates`)**:
  - Filterable live feed (Traffic, Weather, Crime, Hazard, Municipal) with interactive vector map pins and contextual incident drawers.

---

## 2. Interactive API Documentation

UrbanPulse provides complete, interactive OpenAPI-compliant documentation generated automatically from FastAPI route definitions:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs) — Explore and execute REST endpoints directly from the browser.
- **ReDoc UI**: [http://localhost:8000/redoc](http://localhost:8000/redoc) — Clean, readable technical reference for all schemas and request/response models.
- **OpenAPI Schema**: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json) — Raw machine-readable OpenAPI 3.1 contract.

---

## 3. Monorepo Architecture

UrbanPulse is engineered as a modular, high-performance monorepo:

```
urbanpulse/
├── frontend/             # Next.js 14 App Router, TypeScript, Tailwind, SVG design system
├── backend/              # Python FastAPI async backend, geospatial pipelines, & agents
├── ai/                   # Specialized RAG engines (GeoRAG, CrisisRAG, AquaRAG), vector stores
├── database/             # PostgreSQL schemas, PostGIS spatial functions, migrations, seeds
├── shared/               # Universal domain contracts, geographic constants, schemas, enums
├── scripts/              # Automated bootstrapping, environment setup, and spatial seeders
├── docs/                 # Architectural specifications, ADRs, and visual assets
├── .env.example          # Generic environment configuration template
├── docker-compose.yml    # Unified container orchestration
└── LICENSE               # MIT License
```

### Directory Responsibilities

| Directory | Responsibilities |
|---|---|
| [`frontend/`](./frontend) | Next.js 14 client architecture, responsive two-column dashboards, Google Maps canvas, reactive Zustand stores, and SVG icon systems. |
| [`backend/`](./backend) | FastAPI REST & WebSocket APIs, telemetry ingestion pipelines, spatial query resolvers, and asynchronous task workers. |
| [`ai/`](./ai) | Domain RAG vector retrieval, LLM orchestration, structured answer generation, and mathematical suitability modeling. |
| [`database/`](./database) | PostgreSQL + PostGIS tables, spatial GIST indexes, Alembic migration scripts, and geographical boundary seeds. |
| [`shared/`](./shared) | Language-agnostic contracts, schemas, incident enums, and geospatial constants. |
| [`scripts/`](./scripts) | Automated developer onboarding, environment validation, and database spatial seeding. |
| [`docs/`](./docs) | Architecture Decision Records (ADRs), system designs, telemetry specifications, and screenshots. |

---

## 4. Setup & Installation

You can run UrbanPulse either fully containerized via **Docker Compose** or via a **Local Development** workflow.

### Prerequisites

- **Node.js** >= 18.x and **npm** >= 9.x
- **Python** >= 3.10
- **Docker & Docker Compose** (required for PostGIS spatial database and Redis cache)

---

### Option A: Unified Docker Orchestration (Recommended)

1. **Clone the repository and prepare the environment**:
   ```bash
   git clone https://github.com/Shreyas-s-12/Urbanpulse.git
   cd Urbanpulse
   cp .env.example .env
   ```
   *(Configure your `.env` with your Google Maps API key and preferred provider tokens).*

2. **Launch all services**:
   ```bash
   docker-compose up --build -d
   ```

3. **Verify running containers**:
   ```bash
   docker-compose ps
   ```
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend Core API: [http://localhost:8000](http://localhost:8000)
   - Swagger Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option B: Local Development Setup

#### 1. Environment Configuration
```bash
cp .env.example .env
```
Generate a secure backend secret key:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```
Place the generated token in `.env` under `SECRET_KEY`.

#### 2. Start Spatial Database & Cache Infrastructure
```bash
docker-compose up -d db redis
```

#### 3. Backend Setup
```bash
cd backend
python -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Database Migrations & Spatial Seeding

The database layer uses **PostgreSQL 16** with **PostGIS 3.4** for high-dimensional spatial indexing (`GIST`) and spherical distance metrics (`ST_DWithin`).

### 1. Apply Schema Migrations
To apply database schema definitions and spatial tables:
```bash
cd backend
# Run Alembic migrations
alembic upgrade head
```

### 2. Seed Spatial Boundaries & Reference Datasets
Populate initial administrative boundaries, major landmarks, arterial networks, and sensor stations:
```bash
# Seed spatial tables and municipal boundaries
python -m database.seeds.seed_spatial_data
```
Spatial tables utilize EPSG:4326 (WGS 84) coordinate references for seamless interoperability with Google Maps and GIS tooling.

---

## 6. Testing & Quality Assurance

### Frontend Typechecking & Linting
```bash
cd frontend
npm run typecheck    # Strict TypeScript verification
npm run lint         # ESLint code quality & zero-emoji enforcement
npm run build        # Production Next.js compilation
```

### Backend Test Suite
```bash
cd backend
python -m pytest -q  # Comprehensive unit, integration, and RAG evaluation tests
```

---

## 7. Security & Responsible Disclosure

UrbanPulse treats location data and system credentials with strict confidentiality:

- **Secrets Management**: Never commit `.env` files or API credentials to version control. All API keys (`GOOGLE_MAPS_API_KEY`, `OPENAI_API_KEY`, `SECRET_KEY`) must remain in your untracked `.env`.
- **URL & Source Sanitization**: The PulseWire intelligence rail and Nexus conversational agents enforce strict HTTP/HTTPS protocol checks and strip tracking tokens (`utm_*`, `fbclid`, `gclid`) before rendering external references.
- **Vulnerability Disclosure**: If you discover a potential security vulnerability in UrbanPulse, please open a private security advisory on GitHub or contact the maintainer directly rather than opening a public issue.

---

## 8. License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 Shrey. All rights reserved.
