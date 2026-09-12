-- Seed Mysuru & Bengaluru center points (SRID 4326)
INSERT INTO cities (id, name, state, country, center_location)
VALUES 
    (
        'bengaluru',
        'Bengaluru',
        'Karnataka',
        'India',
        ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)
    ),
    (
        'mysuru',
        'Mysuru',
        'Karnataka',
        'India',
        ST_SetSRID(ST_MakePoint(76.6394, 12.2958), 4326)
    )
ON CONFLICT (id) DO UPDATE 
SET center_location = EXCLUDED.center_location;
