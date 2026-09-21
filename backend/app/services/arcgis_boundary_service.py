"""
UrbanPulse ArcGIS Boundary Service
Integrates public World Bank Global Administrative Divisions FeatureServer:
https://services.arcgis.com/iQ1dY19aHwbSDYIF/arcgis/rest/services/World_Bank_Global_Administrative_Divisions/FeatureServer

Layer 1: WB_GAD_ADM0 (Country boundaries)
Layer 2: WB_GAD_ADM1 (State / Province / Region boundaries)
Layer 3: WB_GAD_ADM2 (District / County boundaries)

Strict specifications:
- No geoBoundaries usage
- No ArcGIS API key required for this public service
- Server-side caching for boundary metadata and simplified geometry
- maxAllowableOffset generalization to prevent high-resolution bandwidth saturation
- Point-in-polygon spatial constraints for COUNTRY, STATE, and DISTRICT scopes
- Raises ArcGISBoundaryProviderError if ArcGIS query fails
"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional, Tuple, Union
import urllib.parse
import httpx

logger = logging.getLogger("urbanpulse.boundaries.arcgis")


class ArcGISBoundaryProviderError(Exception):
    """Raised when an ArcGIS REST FeatureServer query fails or returns an error."""
    def __init__(self, message: str, details: Optional[Any] = None, status_code: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.details = details
        self.status_code = status_code


# Bounding Box helper: [min_lon, min_lat, max_lon, max_lat]
def _compute_geometry_bbox(geometry: Dict[str, Any]) -> List[float]:
    min_x, min_y = float("inf"), float("inf")
    max_x, max_y = float("-inf"), float("-inf")

    def walk_coords(coords: Any):
        nonlocal min_x, min_y, max_x, max_y
        if isinstance(coords, (list, tuple)):
            if len(coords) >= 2 and isinstance(coords[0], (int, float)) and isinstance(coords[1], (int, float)):
                x, y = float(coords[0]), float(coords[1])
                if x < min_x: min_x = x
                if y < min_y: min_y = y
                if x > max_x: max_x = x
                if y > max_y: max_y = y
            else:
                for c in coords:
                    walk_coords(c)

    walk_coords(geometry.get("coordinates", []))
    if min_x == float("inf"):
        return [-180.0, -90.0, 180.0, 90.0]
    return [round(min_x, 5), round(min_y, 5), round(max_x, 5), round(max_y, 5)]


def _compute_geometry_centroid(bbox: List[float]) -> Tuple[float, float]:
    """Computes (lat, lon) centroid from bounding box [min_lon, min_lat, max_lon, max_lat]."""
    center_lon = (bbox[0] + bbox[2]) / 2.0
    center_lat = (bbox[1] + bbox[3]) / 2.0
    return (round(center_lat, 5), round(center_lon, 5))


def point_in_polygon(lon: float, lat: float, poly_rings: List[List[List[float]]]) -> bool:
    """
    Standard Ray Casting Point-in-Polygon.
    poly_rings[0] is outer boundary; poly_rings[1:] are inner holes.
    """
    if not poly_rings:
        return False

    def ray_cast(ring: List[List[float]]) -> bool:
        inside = False
        n = len(ring)
        if n < 3:
            return False
        p1x, p1y = ring[0][0], ring[0][1]
        for i in range(1, n + 1):
            p2x, p2y = ring[i % n][0], ring[i % n][1]
            if lat > min(p1y, p2y):
                if lat <= max(p1y, p2y):
                    if lon <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        else:
                            xinters = p1x
                        if p1x == p2x or lon <= xinters:
                            inside = not inside
            p1x, p2x = p2x, p1x
            p1y, p2y = p2y, p1y
        return inside

    # Must be inside outer ring
    if not ray_cast(poly_rings[0]):
        return False
    # Must NOT be inside any hole
    for hole in poly_rings[1:]:
        if ray_cast(hole):
            return False
    return True


def point_in_geometry(lon: float, lat: float, geometry: Dict[str, Any], bbox: Optional[List[float]] = None) -> bool:
    """
    Evaluates whether (lon, lat) falls within a GeoJSON Polygon or MultiPolygon.
    Uses bounding box for O(1) early rejection before executing ray casting.
    """
    if bbox:
        min_lon, min_lat, max_lon, max_lat = bbox
        if lon < min_lon or lon > max_lon or lat < min_lat or lat > max_lat:
            return False

    g_type = geometry.get("type", "")
    coords = geometry.get("coordinates", [])

    if g_type == "Polygon":
        return point_in_polygon(lon, lat, coords)
    elif g_type == "MultiPolygon":
        for poly_rings in coords:
            if point_in_polygon(lon, lat, poly_rings):
                return True
        return False
    return False


class ArcGISBoundaryService:
    BASE_URL = (
        "https://services.arcgis.com/iQ1dY19aHwbSDYIF/arcgis/rest/services/"
        "World_Bank_Global_Administrative_Divisions/FeatureServer"
    )

    # Layer IDs
    LAYER_ADM0 = 1  # Country boundaries
    LAYER_ADM1 = 2  # State/Province/Region boundaries
    LAYER_ADM2 = 3  # District/County boundaries

    # Simplification parameters (maxAllowableOffset in degrees)
    # 0.05 deg ~ 5.5 km (Fast, compact, ideal for national boundaries)
    # 0.02 deg ~ 2.2 km (Ideal for state boundaries)
    # 0.01 deg ~ 1.1 km (Ideal for district boundaries)
    OFFSET_MAP = {
        LAYER_ADM0: "0.05",
        LAYER_ADM1: "0.02",
        LAYER_ADM2: "0.01",
    }

    # In-memory server-side cache with TTL: key -> (timestamp, data_dict)
    _cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
    CACHE_TTL_SECONDS = 86400  # 24 hours

    @classmethod
    def _get_from_cache(cls, key: str) -> Optional[Dict[str, Any]]:
        entry = cls._cache.get(key)
        if entry:
            ts, data = entry
            if time.time() - ts < cls.CACHE_TTL_SECONDS:
                return data
            else:
                del cls._cache[key]
        return None

    @classmethod
    def _set_in_cache(cls, key: str, data: Dict[str, Any]):
        cls._cache[key] = (time.time(), data)

    @classmethod
    def clear_cache(cls):
        """Clears the in-memory cache (primarily for tests)."""
        cls._cache.clear()

    @classmethod
    async def query_layer(
        cls,
        layer_id: int,
        where_clause: str,
        out_fields: str = "*",
        max_offset: Optional[str] = None,
        timeout: float = 12.0,
    ) -> Dict[str, Any]:
        """
        Executes a GET query to the ArcGIS REST FeatureServer /query endpoint.
        Returns GeoJSON FeatureCollection.
        Raises ArcGISBoundaryProviderError upon HTTP failure, timeout, or ArcGIS error payload.
        """
        cache_key = f"{layer_id}:{where_clause}:{max_offset or cls.OFFSET_MAP.get(layer_id, '0.02')}"
        cached = cls._get_from_cache(cache_key)
        if cached:
            logger.debug("Serving boundary from server-side cache for key %s", cache_key)
            return cached

        offset = max_offset or cls.OFFSET_MAP.get(layer_id, "0.02")
        params = {
            "where": where_clause,
            "outFields": out_fields,
            "returnGeometry": "true",
            "f": "geojson",
            "maxAllowableOffset": offset,
            "geometryPrecision": "4",
        }
        url = f"{cls.BASE_URL}/{layer_id}/query?{urllib.parse.urlencode(params)}"

        logger.info("Querying ArcGIS REST FeatureServer Layer %d: %s", layer_id, where_clause)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(url, headers={"User-Agent": "UrbanPulse-Intelligence/1.0"})

            if resp.status_code != 200:
                raise ArcGISBoundaryProviderError(
                    f"ArcGIS FeatureServer returned HTTP {resp.status_code}",
                    details=resp.text[:300],
                    status_code=resp.status_code,
                )

            data = resp.json()
            if "error" in data:
                err_info = data["error"]
                msg = err_info.get("message") or "ArcGIS query execution failed"
                details = err_info.get("details", [])
                raise ArcGISBoundaryProviderError(
                    f"ArcGIS API error: {msg} ({details})",
                    details=err_info,
                    status_code=err_info.get("code", 400),
                )

            features = data.get("features", [])
            if not features:
                raise ArcGISBoundaryProviderError(
                    f"No boundary feature found for query: {where_clause}",
                    details={"features": []},
                    status_code=404,
                )

            # Process primary feature
            primary_feature = features[0]
            geom = primary_feature.get("geometry", {})
            bbox = _compute_geometry_bbox(geom)
            centroid = _compute_geometry_centroid(bbox)

            result = {
                "type": "Feature",
                "layerId": layer_id,
                "layerName": "WB_GAD_ADM0" if layer_id == 1 else ("WB_GAD_ADM1" if layer_id == 2 else "WB_GAD_ADM2"),
                "geometry": geom,
                "properties": primary_feature.get("properties", {}),
                "bbox": bbox,
                "centroid": {"latitude": centroid[0], "longitude": centroid[1]},
                "featureCount": len(features),
                "allFeatures": features if len(features) > 1 else None,
            }

            cls._set_in_cache(cache_key, result)
            return result

        except ArcGISBoundaryProviderError:
            raise
        except httpx.RequestError as req_err:
            logger.error("Network error querying ArcGIS boundary: %s", req_err)
            raise ArcGISBoundaryProviderError(
                f"ArcGIS boundary network connection failed: {req_err}",
                details=str(req_err),
            ) from req_err
        except Exception as exc:
            logger.error("Unexpected error querying ArcGIS boundary: %s", exc)
            raise ArcGISBoundaryProviderError(
                f"ArcGIS boundary processing error: {exc}",
                details=str(exc),
            ) from exc

    @classmethod
    async def get_country_boundary(cls, country_name_or_iso: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves country boundary from Layer 1 (WB_GAD_ADM0).
        Matches ISO_A2, ISO_A3, or NAM_0.
        """
        c_str = (country_name_or_iso or "India").strip()
        c_upper = c_str.upper()

        if len(c_str) == 2:
            where = f"ISO_A2=\'{c_upper}\'"
        elif len(c_str) == 3:
            where = f"ISO_A3=\'{c_upper}\'"
        elif c_upper in ("UNITED STATES", "USA", "US"):
            where = "ISO_A2=\'US\' OR NAM_0=\'United States of America\'"
        elif c_upper in ("UNITED KINGDOM", "UK", "GB", "BRITAIN"):
            where = "ISO_A2=\'GB\' OR NAM_0=\'United Kingdom\'"
        else:
            escaped = c_str.replace("'", "''")
            where = f"NAM_0=\'{escaped}\' OR NAM_0 LIKE \'%{escaped}%\'"

        return await cls.query_layer(cls.LAYER_ADM0, where)

    @classmethod
    async def get_state_boundary(cls, state_name: Optional[str] = None, country_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves state/province boundary from Layer 2 (WB_GAD_ADM1).
        Matches NAM_1.
        """
        s_str = (state_name or "Karnataka").strip()
        escaped_s = s_str.replace("'", "''")

        if country_name:
            c_str = country_name.strip().replace("'", "''")
            where = f"(NAM_1=\'{escaped_s}\' OR NAM_1 LIKE \'%{escaped_s}%\') AND (NAM_0=\'{c_str}\' OR ISO_A2=\'{c_str.upper()}\')"
        else:
            where = f"NAM_1=\'{escaped_s}\' OR NAM_1 LIKE \'%{escaped_s}%\'"

        return await cls.query_layer(cls.LAYER_ADM1, where)

    @classmethod
    async def get_district_boundary(
        cls,
        district_name: Optional[str] = None,
        state_name: Optional[str] = None,
        country_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Retrieves district/county boundary from Layer 3 (WB_GAD_ADM2).
        Matches NAM_2.
        """
        d_str = (district_name or "Bangalore").strip()
        escaped_d = d_str.replace("'", "''")

        clauses = [f"(NAM_2=\'{escaped_d}\' OR NAM_2 LIKE \'%{escaped_d}%\')"]
        if state_name:
            escaped_s = state_name.strip().replace("'", "''")
            clauses.append(f"(NAM_1=\'{escaped_s}\' OR NAM_1 LIKE \'%{escaped_s}%\')")
        if country_name:
            escaped_c = country_name.strip().replace("'", "''")
            clauses.append(f"(NAM_0=\'{escaped_c}\' OR ISO_A2=\'{escaped_c.upper()}\')")

        where = " AND ".join(clauses)
        return await cls.query_layer(cls.LAYER_ADM2, where)

    @classmethod
    def is_point_in_boundary(cls, lat: float, lon: float, boundary: Dict[str, Any]) -> bool:
        """Checks if (lat, lon) is within the given boundary feature."""
        geom = boundary.get("geometry", {})
        bbox = boundary.get("bbox")
        return point_in_geometry(lon, lat, geom, bbox)
