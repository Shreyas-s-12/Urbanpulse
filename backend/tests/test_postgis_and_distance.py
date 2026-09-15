import pytest
from app.services.spatial import (
    make_postgis_point,
    make_postgis_distance_sphere,
    haversine_distance_meters,
    validate_coordinate_bounds,
)

def test_postgis_point_convention():
    """Verify ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) strictly orders longitude first, latitude second."""
    lon = 76.639380
    lat = 12.295810
    sql = make_postgis_point(longitude=lon, latitude=lat)
    assert sql == f"ST_SetSRID(ST_MakePoint({lon:.8f}, {lat:.8f}), 4326)"
    # Ensure longitude appears before latitude in the argument list
    first_arg = float(sql.split("ST_MakePoint(")[1].split(",")[0].strip())
    second_arg = float(sql.split(",")[1].split(")")[0].strip())
    assert abs(first_arg - lon) < 1e-6
    assert abs(second_arg - lat) < 1e-6

def test_postgis_distance_sphere_expression():
    """Verify ST_DistanceSphere SQL generation uses correct geometry order."""
    lon1, lat1 = 77.594562, 12.971598
    lon2, lat2 = 77.604562, 12.981598
    sql = make_postgis_distance_sphere(lon1, lat1, lon2, lat2)
    assert "ST_DistanceSphere(" in sql
    assert f"ST_MakePoint({lon1:.8f}, {lat1:.8f})" in sql
    assert f"ST_MakePoint({lon2:.8f}, {lat2:.8f})" in sql

def test_haversine_distance_zero_for_identical_coords():
    """Verify haversine distance is 0.000m for identical device and map coordinates (Rule 35)."""
    lat, lon = 12.302145, 76.643219
    dist = haversine_distance_meters(lat, lon, lat, lon)
    assert dist == 0.0

def test_haversine_accuracy_known_distance():
    """Verify haversine distance accurately measures real physical displacement."""
    # 1 degree of latitude is approximately 111,139 meters
    dist = haversine_distance_meters(12.0, 77.0, 13.0, 77.0)
    assert 111000 <= dist <= 111500

def test_wgs84_bounds_validation():
    """Verify coordinate bounds validation prevents malformed GPS coordinates."""
    valid, msg = validate_coordinate_bounds(12.2958, 76.6394)
    assert valid is True
    assert msg == "VALID"

    invalid_lat, _ = validate_coordinate_bounds(95.0, 76.6394)
    assert invalid_lat is False

    invalid_lon, _ = validate_coordinate_bounds(12.2958, 195.0)
    assert invalid_lon is False
