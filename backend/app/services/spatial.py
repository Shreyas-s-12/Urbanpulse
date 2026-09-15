import math
from typing import Tuple

def make_postgis_point(longitude: float, latitude: float, srid: int = 4326) -> str:
    """
    Rule 11 Compliance:
    All PostGIS spatial geometry operations must use:
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    Notice: longitude first, latitude second.
    """
    return f"ST_SetSRID(ST_MakePoint({longitude:.8f}, {latitude:.8f}), {srid})"

def make_postgis_distance_sphere(lon1: float, lat1: float, lon2: float, lat2: float) -> str:
    """
    Returns PostGIS ST_DistanceSphere query fragment comparing two points.
    Enforces (longitude, latitude) order for both operands.
    """
    pt1 = make_postgis_point(lon1, lat1)
    pt2 = make_postgis_point(lon2, lat2)
    return f"ST_DistanceSphere({pt1}, {pt2})"

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes great-circle distance in meters between two coordinates.
    """
    r = 6371000.0  # Earth mean radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c

def validate_coordinate_bounds(lat: float, lon: float) -> Tuple[bool, str]:
    """
    Validates WGS-84 coordinate bounds:
    Latitude: [-90.0, 90.0]
    Longitude: [-180.0, 180.0]
    """
    if not (-90.0 <= lat <= 90.0):
        return False, f"Latitude {lat} is out of valid WGS-84 range [-90, 90]"
    if not (-180.0 <= lon <= 180.0):
        return False, f"Longitude {lon} is out of valid WGS-84 range [-180, 180]"
    return True, "VALID"
