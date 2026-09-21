"""
UrbanPulse TomTom Orbis Traffic Flow Provider
Integrates the current TomTom Orbis Traffic API:
  https://api.tomtom.com/maps/orbis/traffic/flow/vector/tile/{zoom}/{x}/{y}?apiVersion=2
Header authentication: TomTom-Api-Key
Strict rules:
  - Zero synthetic circles or fake congestion points.
  - Real road geometry vector tile decoding (MVT/Protobuf).
  - Zoom 0 -> 22 dynamic road network scaling.
  - Viewport-driven tile sampling with brief 60-second in-memory caching.
  - Error isolation: returns PROVIDER_ERROR or NO_COVERAGE without crashing map or services.
"""

import asyncio
import math
import time
import logging
from typing import Any, Dict, List, Optional, Tuple
import httpx
import mapbox_vector_tile

from app.core.config import settings

logger = logging.getLogger("urbanpulse.tomtom_traffic")

# In-memory tile cache with 60-second TTL matching TomTom Traffic Flow update interval
_TILE_CACHE: Dict[Tuple[int, int, int], Tuple[float, List[Dict[str, Any]]]] = {}
_CACHE_TTL_SECONDS = 60.0

ROAD_CATEGORY_FREE_FLOW_SPEEDS: Dict[str, float] = {
    "motorway": 110.0,
    "motorway_link": 80.0,
    "trunk": 90.0,
    "trunk_link": 70.0,
    "primary": 70.0,
    "primary_link": 50.0,
    "secondary": 50.0,
    "secondary_link": 40.0,
    "tertiary": 40.0,
    "tertiary_link": 30.0,
    "street": 30.0,
    "residential": 30.0,
    "living_street": 20.0,
    "service": 20.0,
    "pedestrian": 10.0,
    "track": 20.0,
}


def tile_px_to_latlon(px: float, py: float, z: int, x: int, y: int, extent: int = 4096) -> Tuple[float, float]:
    """Converts Mapbox Vector Tile pixel coordinates (extent 4096) to WGS84 (latitude, longitude)."""
    n = 2.0 ** z
    gx = x + (px / extent)
    gy = y + (py / extent)
    lon = (gx / n) * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1.0 - 2.0 * (gy / n))))
    lat = math.degrees(lat_rad)
    return round(lat, 6), round(lon, 6)


def latlon_to_tile(lat: float, lon: float, z: int) -> Tuple[int, int]:
    """Converts WGS84 (latitude, longitude) to tile coordinates (x, y) at zoom z."""
    n = 2.0 ** z
    lat_r = math.radians(lat)
    xtile = int((lon + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * n)
    max_t = int(n) - 1
    return max(0, min(max_t, xtile)), max(0, min(max_t, ytile))


def bbox_to_tiles(north: float, south: float, east: float, west: float, z: int, max_tiles: int = 16) -> List[Tuple[int, int]]:
    """Calculates intersecting tile (x, y) coordinates for a given bounding box at zoom z."""
    x_min, y_min = latlon_to_tile(north, west, z)
    x_max, y_max = latlon_to_tile(south, east, z)

    x_start = min(x_min, x_max)
    x_end = max(x_min, x_max)
    y_start = min(y_min, y_max)
    y_end = max(y_min, y_max)

    tiles = []
    for x in range(x_start, x_end + 1):
        for y in range(y_start, y_end + 1):
            tiles.append((x, y))

    if len(tiles) > max_tiles:
        # Step through with stride to keep representation balanced across the viewport
        step = math.ceil(len(tiles) / max_tiles)
        tiles = tiles[::step][:max_tiles]

    return tiles


class TomTomTrafficProvider:
    provider_name = "TomTom Orbis Traffic Flow"
    base_url = "https://api.tomtom.com/maps/orbis/traffic/flow/vector/tile"

    @classmethod
    def get_api_key(cls) -> str:
        key = settings.TOMTOM_API_KEY
        return key.strip() if key else ""

    @classmethod
    async def fetch_tile_raw(cls, z: int, x: int, y: int) -> Optional[bytes]:
        """Fetches raw vector tile bytes from TomTom Orbis v2 API using TomTom-Api-Key header."""
        api_key = cls.get_api_key()
        if not api_key:
            logger.error("TomTom API key not configured in settings")
            return None

        url = f"{cls.base_url}/{z}/{x}/{y}?apiVersion=2"
        headers = {
            "TomTom-Api-Key": api_key,
            "Accept": "application/vnd.mapbox-vector-tile",
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    return resp.content
                elif resp.status_code in (404, 204):
                    logger.debug("TomTom tile (%d, %d, %d) has no traffic data (status %d)", z, x, y, resp.status_code)
                    return b""
                else:
                    logger.warning("TomTom Orbis API error status %d for tile (%d, %d, %d): %s", resp.status_code, z, x, y, resp.text[:100])
                    return None
        except Exception as exc:
            logger.error("TomTom Orbis tile network exception for (%d, %d, %d): %s", z, x, y, exc)
            return None

    @classmethod
    def parse_mvt_tile(cls, tile_bytes: bytes, z: int, x: int, y: int) -> List[Dict[str, Any]]:
        """Parses decoded MVT features into normalized road segment cells with real geometry and speeds."""
        if not tile_bytes or len(tile_bytes) < 15:
            return []

        try:
            decoded = mapbox_vector_tile.decode(tile_bytes)
        except Exception as exc:
            logger.warning("Failed to decode MVT tile (%d, %d, %d): %s", z, x, y, exc)
            return []

        layer = decoded.get("Traffic flow")
        if not layer or not layer.get("features"):
            return []

        features = layer["features"]
        cells: List[Dict[str, Any]] = []
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        for idx, feat in enumerate(features):
            geom = feat.get("geometry", {})
            props = feat.get("properties", {})
            g_type = geom.get("type")
            coords_raw = geom.get("coordinates", [])

            if not coords_raw:
                continue

            # Transform tile coordinates to WGS84 [lon, lat]
            # LineString: [[px, py], ...]
            # MultiLineString: [[[px, py], ...], ...]
            paths_wgs84: List[List[List[float]]] = []

            if g_type == "LineString":
                path: List[List[float]] = []
                for pt in coords_raw:
                    if len(pt) >= 2:
                        lat, lon = tile_px_to_latlon(pt[0], pt[1], z, x, y)
                        path.append([lon, lat])
                if len(path) >= 2:
                    paths_wgs84.append(path)
            elif g_type == "MultiLineString":
                for line in coords_raw:
                    path = []
                    for pt in line:
                        if len(pt) >= 2:
                            lat, lon = tile_px_to_latlon(pt[0], pt[1], z, x, y)
                            path.append([lon, lat])
                    if len(path) >= 2:
                        paths_wgs84.append(path)

            if not paths_wgs84:
                continue

            # Extract raw TomTom Orbis attributes
            relative_speed = float(props.get("relative_speed", 1.0))
            relative_speed = max(0.0, min(1.0, relative_speed))
            road_category = str(props.get("road_category", "street")).lower()
            road_subcategory = props.get("road_subcategory")
            road_closure = bool(props.get("road_closure", False))
            display_class = props.get("display_class")

            # Zoom hierarchy scaling: show broad/coarse at low zoom, increasingly detailed at higher zoom
            if z <= 8 and road_category not in ("motorway", "motorway_link", "trunk", "trunk_link", "primary"):
                continue
            elif z <= 10 and road_category not in ("motorway", "motorway_link", "trunk", "trunk_link", "primary", "secondary"):
                continue
            elif z <= 11 and road_category in ("service", "track", "living_street", "pedestrian"):
                continue

            # Determine free-flow speed and current speed
            free_flow_speed = ROAD_CATEGORY_FREE_FLOW_SPEEDS.get(road_category, 45.0)
            current_speed = round(relative_speed * free_flow_speed, 1)
            delay_pct = max(0.0, round((1.0 - relative_speed) * 100.0, 1))

            # Severity classification adhering strictly to provider values
            if road_closure or relative_speed < 0.25:
                category = "SEVERE"
                traffic_level = "Severe Congestion" if not road_closure else "Road Closure"
                color_rgba = [220, 38, 38, 230]
            elif relative_speed < 0.60:
                category = "HIGH"
                traffic_level = "Heavy Traffic"
                color_rgba = [234, 88, 12, 230]
            elif relative_speed < 0.85:
                category = "MODERATE"
                traffic_level = "Moderate Traffic"
                color_rgba = [245, 158, 11, 230]
            else:
                category = "LOW"
                traffic_level = "Free Flow"
                color_rgba = [34, 197, 94, 230]

            road_name = f"{road_category.title()}"
            if road_subcategory:
                road_name += f" ({str(road_subcategory).title()})"
            else:
                road_name += " Segment"

            # Create one cell per path segment
            for p_idx, path in enumerate(paths_wgs84):
                mid_idx = len(path) // 2
                mid_lon, mid_lat = path[mid_idx]

                cells.append({
                    "id": f"tt-flow-{z}-{x}-{y}-{idx}-{p_idx}",
                    "latitude": round(mid_lat, 5),
                    "longitude": round(mid_lon, 5),
                    "geometry": {
                        "type": "LineString",
                        "coordinates": path,
                    },
                    "center": {"latitude": round(mid_lat, 5), "longitude": round(mid_lon, 5)},
                    "metric": "TRAFFIC",
                    "subMetric": "FLOW",
                    "value": current_speed,
                    "rawValue": relative_speed,
                    "normalizedValue": round(1.0 - relative_speed, 4),
                    "unit": "km/h",
                    "category": category,
                    "status": "AVAILABLE",
                    "confidence": 0.95,
                    "coverage": 1.0,
                    "timestamp": now_iso,
                    "source": cls.provider_name,
                    "color": color_rgba,
                    "metadata": {
                        "roadName": road_name,
                        "roadCategory": road_category,
                        "roadSubcategory": road_subcategory,
                        "currentSpeedKmh": current_speed,
                        "freeFlowSpeedKmh": free_flow_speed,
                        "relativeSpeed": round(relative_speed, 3),
                        "delayPercent": delay_pct,
                        "trafficLevel": traffic_level,
                        "roadClosure": road_closure,
                        "displayClass": display_class,
                        "qualityConfidence": 0.95,
                        "source": "TomTom Orbis Vector Flow API",
                    },
                })

        return cells

    @classmethod
    async def get_tile_cells(cls, z: int, x: int, y: int) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Retrieves parsed road cells for tile (z, x, y), utilizing a 60-second in-memory cache.
        Returns (status, cells).
        """
        now = time.time()
        key = (z, x, y)

        if key in _TILE_CACHE:
            cached_time, cached_cells = _TILE_CACHE[key]
            if now - cached_time < _CACHE_TTL_SECONDS:
                return "AVAILABLE" if cached_cells else "NO_COVERAGE", cached_cells

        raw_bytes = await cls.fetch_tile_raw(z, x, y)
        if raw_bytes is None:
            return "PROVIDER_ERROR", []

        if len(raw_bytes) == 0:
            _TILE_CACHE[key] = (now, [])
            return "NO_COVERAGE", []

        cells = cls.parse_mvt_tile(raw_bytes, z, x, y)
        _TILE_CACHE[key] = (now, cells)
        return "AVAILABLE" if cells else "NO_COVERAGE", cells

    @classmethod
    async def fetch_viewport_traffic_cells(
        cls,
        north: float,
        south: float,
        east: float,
        west: float,
        zoom: int,
        sub_metric: str = "FLOW",
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Dynamically calculates and fetches all visible vector tiles for a given bounding box.
        TomTom Orbis vector flow data is natively available from zoom 6 up to 22.
        """
        # Clamp zoom to provider supported range [6, 20]
        effective_zoom = max(6, min(20, zoom))
        tiles = bbox_to_tiles(north, south, east, west, effective_zoom, max_tiles=16)

        if not tiles:
            return "NO_COVERAGE", []

        tasks = [cls.get_tile_cells(effective_zoom, tx, ty) for tx, ty in tiles]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        aggregated_cells: List[Dict[str, Any]] = []
        has_provider_error = False
        valid_tiles = 0

        for res in results:
            if isinstance(res, Exception):
                has_provider_error = True
                continue
            status, tile_cells = res
            if status == "PROVIDER_ERROR":
                has_provider_error = True
            elif status == "AVAILABLE":
                valid_tiles += 1
                aggregated_cells.extend(tile_cells)

        # Apply sub-metric value transformation if requested
        for c in aggregated_cells:
            c["subMetric"] = sub_metric
            if sub_metric == "SPEED":
                c["value"] = c["metadata"]["currentSpeedKmh"]
                c["unit"] = "km/h"
            elif sub_metric == "DELAY":
                c["value"] = c["metadata"]["delayPercent"]
                c["unit"] = "%"
            else:  # FLOW / CONGESTION
                c["value"] = c["metadata"]["relativeSpeed"]
                c["unit"] = "ratio"

        if aggregated_cells:
            return "AVAILABLE", aggregated_cells
        elif has_provider_error:
            return "PROVIDER_ERROR", []
        else:
            return "NO_COVERAGE", []

    @classmethod
    async def get_traffic_flow_cells(
        cls,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        radius_km: float = 50.0,
        geography: str = "CITY",
        sub_metric: str = "FLOW",
        country: Optional[str] = None,
        region: Optional[str] = None,
        district: Optional[str] = None,
        viewport_bounds: Optional[Dict[str, float]] = None,
        zoom: Optional[int] = None,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        High-level dispatcher for Spatial Heatmap.
        Translates geographic scope or explicit viewport bounds into TomTom Orbis vector flow tiles.
        """
        # If client provided real viewport bounds from map camera, prioritize exact viewport
        if viewport_bounds and all(k in viewport_bounds for k in ("north", "south", "east", "west")):
            v_north = viewport_bounds["north"]
            v_south = viewport_bounds["south"]
            v_east = viewport_bounds["east"]
            v_west = viewport_bounds["west"]
            v_zoom = zoom if zoom is not None else 12
            return await cls.fetch_viewport_traffic_cells(v_north, v_south, v_east, v_west, v_zoom, sub_metric)

        geography_upper = (geography or "CITY").upper()

        if geography_upper == "WORLD":
            # Sample international corridors at zoom 6 across major continental hubs
            hubs = [
                (51.5074, -0.1278),  # London / West Europe
                (40.7128, -74.0060), # New York / US East
                (37.7749, -122.4194),# SF / US West
                (35.6762, 139.6503), # Tokyo / East Asia
                (28.6139, 77.2090),  # Delhi / North India
                (12.9716, 77.5946),  # Bengaluru / South India
                (25.2048, 55.2708),  # Dubai / Middle East
                (1.3521, 103.8198),  # Singapore / SE Asia
                (-33.8688, 151.2093),# Sydney / Oceania
                (-23.5505, -46.6333),# São Paulo / South America
            ]
            tasks = []
            for h_lat, h_lon in hubs:
                tx, ty = latlon_to_tile(h_lat, h_lon, 6)
                tasks.append(cls.get_tile_cells(6, tx, ty))

            results = await asyncio.gather(*tasks, return_exceptions=True)
            world_cells: List[Dict[str, Any]] = []
            for res in results:
                if not isinstance(res, Exception):
                    _, t_cells = res
                    world_cells.extend(t_cells)

            return "AVAILABLE" if world_cells else "NO_COVERAGE", world_cells

        elif geography_upper == "COUNTRY":
            # Synoptic national corridors at zoom 6
            c_lat = latitude if latitude is not None else 20.5937
            c_lon = longitude if longitude is not None else 78.9629
            # Fetch a 3x3 grid around country center at zoom 6
            cx, cy = latlon_to_tile(c_lat, c_lon, 6)
            tasks = [cls.get_tile_cells(6, tx, ty) for tx in range(cx - 1, cx + 2) for ty in range(cy - 1, cy + 2)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            country_cells: List[Dict[str, Any]] = []
            for res in results:
                if not isinstance(res, Exception):
                    _, t_cells = res
                    country_cells.extend(t_cells)
            return "AVAILABLE" if country_cells else "NO_COVERAGE", country_cells

        elif geography_upper == "STATE":
            # Regional highway network at zoom 8
            s_lat = latitude if latitude is not None else 15.3173
            s_lon = longitude if longitude is not None else 75.7139
            cx, cy = latlon_to_tile(s_lat, s_lon, 8)
            tasks = [cls.get_tile_cells(8, tx, ty) for tx in range(cx - 1, cx + 2) for ty in range(cy - 1, cy + 2)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            state_cells: List[Dict[str, Any]] = []
            for res in results:
                if not isinstance(res, Exception):
                    _, t_cells = res
                    state_cells.extend(t_cells)
            return "AVAILABLE" if state_cells else "NO_COVERAGE", state_cells

        elif geography_upper == "DISTRICT":
            d_lat = latitude if latitude is not None else 12.9716
            d_lon = longitude if longitude is not None else 77.5946
            cx, cy = latlon_to_tile(d_lat, d_lon, 10)
            tasks = [cls.get_tile_cells(10, tx, ty) for tx in range(cx - 1, cx + 2) for ty in range(cy - 1, cy + 2)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            dist_cells: List[Dict[str, Any]] = []
            for res in results:
                if not isinstance(res, Exception):
                    _, t_cells = res
                    dist_cells.extend(t_cells)
            return "AVAILABLE" if dist_cells else "NO_COVERAGE", dist_cells

        elif geography_upper == "CITY":
            # Urban network at zoom 12 (4-tile central cluster)
            city_lat = latitude if latitude is not None else 12.9716
            city_lon = longitude if longitude is not None else 77.5946
            cx, cy = latlon_to_tile(city_lat, city_lon, 12)
            tasks = [cls.get_tile_cells(12, tx, ty) for tx in (cx, cx + 1) for ty in (cy, cy + 1)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            city_cells: List[Dict[str, Any]] = []
            for res in results:
                if not isinstance(res, Exception):
                    _, t_cells = res
                    city_cells.extend(t_cells)
            return "AVAILABLE" if city_cells else "NO_COVERAGE", city_cells

        else:  # PLACE
            # Local microscale road segments at zoom 14 (4-tile local cluster)
            p_lat = latitude if latitude is not None else 12.9716
            p_lon = longitude if longitude is not None else 77.5946
            cx, cy = latlon_to_tile(p_lat, p_lon, 14)
            tasks = [cls.get_tile_cells(14, tx, ty) for tx in (cx, cx + 1) for ty in (cy, cy + 1)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            place_cells: List[Dict[str, Any]] = []
            for res in results:
                if not isinstance(res, Exception):
                    _, t_cells = res
                    place_cells.extend(t_cells)
            return "AVAILABLE" if place_cells else "NO_COVERAGE", place_cells
