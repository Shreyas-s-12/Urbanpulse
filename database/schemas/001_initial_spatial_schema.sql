-- Enable PostGIS spatial extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cities Table (Mysuru and Bengaluru metadata)
CREATE TABLE IF NOT EXISTS cities (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL DEFAULT 'Karnataka',
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    center_location GEOMETRY(Point, 4326) NOT NULL,
    boundary GEOMETRY(Polygon, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Incidents Table (Potholes, accidents, fire, flood, traffic, etc.)
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city_id VARCHAR(50) NOT NULL REFERENCES cities(id),
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'moderate',
    status VARCHAR(30) NOT NULL DEFAULT 'reported',
    location GEOMETRY(Point, 4326) NOT NULL,
    address TEXT,
    ward_name VARCHAR(100),
    confidence_score FLOAT DEFAULT 1.0,
    media_urls TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial GIST Indexes
CREATE INDEX IF NOT EXISTS idx_cities_center ON cities USING GIST (center_location);
CREATE INDEX IF NOT EXISTS idx_incidents_location ON incidents USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_incidents_category_status ON incidents (category, status);
