# UrbanPulse Database Layer (`database/`)

Geospatial data layer powered by PostgreSQL, PostGIS spatial extensions, and TimescaleDB for time-series sensor and telemetry data.

## Directory Structure

```
database/
├── migrations/   # Database migration scripts (Alembic or native SQL versioning)
├── seeds/        # Initial seed datasets (Mysuru & Bengaluru administrative boundaries, wards, major landmarks)
├── functions/    # PostGIS stored procedures and custom spatial queries (e.g. 50 km radius bounding)
└── schemas/      # Core DDL table definitions and spatial index specifications (GIST)
```

## Spatial Indexing Strategy
- All geospatial incident and road feature coordinates are stored using `GEOMETRY(Point, 4326)`.
- High-performance spatial indexing uses PostgreSQL **GIST (Generalized Search Tree)** indexes:
  `CREATE INDEX idx_incidents_location ON incidents USING GIST (location);`
- Geographic distance queries leverage `ST_DWithin` on `GEOGRAPHY` types for precise metric calculations (e.g., 50,000 meters = 50 km).
