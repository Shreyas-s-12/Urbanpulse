-- Function to fetch incidents within a specified kilometer radius (default 50 km)
-- Uses ST_DWithin on GEOGRAPHY for accurate earth-curvature metric calculations.

CREATE OR REPLACE FUNCTION get_incidents_within_radius(
    center_lat DOUBLE PRECISION,
    center_lon DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 50.0
)
RETURNS TABLE (
    incident_id UUID,
    city_id VARCHAR(50),
    category VARCHAR(50),
    severity VARCHAR(20),
    status VARCHAR(30),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    distance_meters DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id AS incident_id,
        i.city_id,
        i.category,
        i.severity,
        i.status,
        ST_Y(i.location::geometry) AS latitude,
        ST_X(i.location::geometry) AS longitude,
        ST_Distance(
            i.location::geography,
            ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)::geography
        ) AS distance_meters
    FROM incidents i
    WHERE ST_DWithin(
        i.location::geography,
        ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)::geography,
        radius_km * 1000.0
    )
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;
