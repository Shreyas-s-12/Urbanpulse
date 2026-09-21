"""
WorldPop Demographic Statistics & ArcGIS Population Density Tile Provider
========================================================================

Architecture:
1. ArcGISPopDensityProvider:
   - Manages metadata and health checking for public tiled ArcGIS population density service:
     https://tiles.arcgis.com/tiles/WSiUmUhlFx4CtMBB/arcgis/rest/services/PopDensity/MapServer
   - Standard 256x256 PNG tiles rendered directly via Google Maps ImageMapType.
   - Documented historical dataset: Year 2010 (NASA SEDAC).
   - NEVER labeled as 'LIVE'.
   - Avoids downloading massive WorldPop GeoTIFF files to the browser.

2. WorldPopProvider:
   - Queries the official WorldPop SDI Advanced API:
     https://api.worldpop.org/v1/services/stats
   - Submits GeoJSON polygon queries and polls task completion at /v1/tasks/{taskid}.
   - Returns polygon total population estimates (year 2020, 100m resolution).
   - In-memory cache (24-hour TTL) keyed by polygon geometry hash.
   - Error isolation: returns 'Population statistics unavailable.' on timeout/failure
     without crashing the application.
"""

import asyncio
import hashlib
import json
import logging
import math
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)


class ArcGISPopDensityProvider:
    """
    Metadata, URL resolution, and health validation for the public
    ArcGIS PopDensity tiled MapServer layer.
    """
    SERVICE_URL = "https://tiles.arcgis.com/tiles/WSiUmUhlFx4CtMBB/arcgis/rest/services/PopDensity/MapServer"
    TILE_URL_TEMPLATE = f"{SERVICE_URL}/tile/{{z}}/{{y}}/{{x}}"
    DATASET_YEAR = 2010
    SOURCE = "NASA Socioeconomic Data Center (SEDAC) / ArcGIS PopDensity MapServer"
    COPYRIGHT = "My NASA Data, https://mynasadata.larc.nasa.gov/"
    IS_LIVE = False

    _health_cache: Dict[str, Any] = {}
    _health_cache_time: float = 0.0
    _HEALTH_CACHE_TTL: float = 300.0  # 5 minutes

    @classmethod
    async def check_health(cls) -> Dict[str, Any]:
        """
        Validates ArcGIS PopDensity service reachability.
        Returns health status and metadata.
        """
        now = time.time()
        if cls._health_cache and (now - cls._health_cache_time) < cls._HEALTH_CACHE_TTL:
            return cls._health_cache

        url = f"{cls.SERVICE_URL}?f=json"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url, headers={"User-Agent": "UrbanPulse/1.0"})
                if res.status_code == 200:
                    data = res.json()
                    cls._health_cache = {
                        "available": True,
                        "status": "AVAILABLE",
                        "datasetYear": cls.DATASET_YEAR,
                        "source": cls.SOURCE,
                        "copyright": cls.COPYRIGHT,
                        "tileUrlTemplate": cls.TILE_URL_TEMPLATE,
                        "minScale": data.get("minScale"),
                        "maxScale": data.get("maxScale"),
                        "isLive": False,
                        "label": "Population Density (Historical 2010)",
                    }
                    cls._health_cache_time = now
                    return cls._health_cache
        except Exception as e:
            logger.warning(f"[ArcGISPopDensity] Health check failed: {e}")

        cls._health_cache = {
            "available": False,
            "status": "UNAVAILABLE",
            "errorMessage": "Population layer unavailable.",
            "datasetYear": cls.DATASET_YEAR,
            "source": cls.SOURCE,
            "isLive": False,
        }
        cls._health_cache_time = now
        return cls._health_cache

    @classmethod
    def get_metadata(cls) -> Dict[str, Any]:
        return {
            "datasetYear": cls.DATASET_YEAR,
            "source": cls.SOURCE,
            "isLive": cls.IS_LIVE,
            "tileUrlTemplate": cls.TILE_URL_TEMPLATE,
            "note": "Historical population density for 2010 courtesy of NASA SEDAC. Not live data.",
            "colorStops": [
                {"category": "LOW", "color": "#22c55e", "label": "Low Density (<500/km²)"},
                {"category": "MODERATE", "color": "#eab308", "label": "Medium Density (500–5,000/km²)"},
                {"category": "HIGH", "color": "#ef4444", "label": "High Density (>5,000/km²)"},
            ],
        }


class WorldPopProvider:
    """
    Client for WorldPop SDI Advanced API:
    https://api.worldpop.org/v1/services/stats
    """
    ROOT_URL = "https://api.worldpop.org/v1/services/stats"
    TASK_URL = "https://api.worldpop.org/v1/tasks"
    DEFAULT_DATASET = "wpgppop"
    DEFAULT_YEAR = 2020
    SOURCE = "WorldPop Global Project (100m)"
    COVERAGE = "100m gridded resolution"

    # In-memory statistics cache: sha256(geojson_str + year) -> (timestamp, result_dict)
    _cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
    _CACHE_TTL: float = 86400.0  # 24 hours

    @classmethod
    def _cache_key(cls, geojson: Dict[str, Any], year: int) -> str:
        s = json.dumps(geojson, sort_keys=True)
        return hashlib.sha256(f"{year}:{s}".encode("utf-8")).hexdigest()

    @classmethod
    async def get_population_stats_for_geojson(
        cls,
        geojson: Dict[str, Any],
        year: int = DEFAULT_YEAR,
        max_poll_seconds: float = 20.0,
    ) -> Dict[str, Any]:
        """
        Submits GeoJSON polygon to WorldPop SDI stats service and polls until finished.
        Uses 24-hour in-memory cache for repeated polygon queries.
        """
        key = cls._cache_key(geojson, year)
        now = time.time()
        if key in cls._cache:
            cached_time, cached_res = cls._cache[key]
            if (now - cached_time) < cls._CACHE_TTL:
                logger.info(f"[WorldPop] Cache hit for polygon hash {key[:10]}")
                return cached_res

        params = {
            "dataset": cls.DEFAULT_DATASET,
            "year": str(year),
            "geojson": json.dumps(geojson),
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(cls.ROOT_URL, params=params, headers={"User-Agent": "UrbanPulse/1.0"})
                if res.status_code != 200:
                    logger.warning(f"[WorldPop] Submission error: {res.status_code} {res.text[:200]}")
                    return cls._error_payload("Population statistics unavailable.")

                data = res.json()
                task_id = data.get("taskid")
                if not task_id:
                    logger.warning(f"[WorldPop] No taskid in response: {data}")
                    return cls._error_payload("Population statistics unavailable.")

                # Poll task status
                poll_start = time.time()
                while (time.time() - poll_start) < max_poll_seconds:
                    await asyncio.sleep(1.5)
                    poll_res = await client.get(f"{cls.TASK_URL}/{task_id}", headers={"User-Agent": "UrbanPulse/1.0"})
                    if poll_res.status_code == 200:
                        poll_data = poll_res.json()
                        status = poll_data.get("status")
                        if status == "finished":
                            total_pop = poll_data.get("data", {}).get("total_population")
                            if total_pop is not None:
                                result = {
                                    "status": "AVAILABLE",
                                    "error": False,
                                    "errorMessage": None,
                                    "totalPopulation": round(float(total_pop)),
                                    "datasetYear": year,
                                    "source": cls.SOURCE,
                                    "coverage": cls.COVERAGE,
                                    "executionTime": poll_data.get("executionTime"),
                                    "taskId": task_id,
                                    "isLive": False,
                                }
                                cls._cache[key] = (now, result)
                                return result
                        elif poll_data.get("error"):
                            logger.warning(f"[WorldPop] Task error: {poll_data}")
                            return cls._error_payload("Population statistics unavailable.")

                logger.warning(f"[WorldPop] Task polling timed out for {task_id}")
                return cls._error_payload("Population statistics unavailable.")

        except Exception as e:
            logger.warning(f"[WorldPop] Exception querying stats: {type(e).__name__}: {e}")
            return cls._error_payload("Population statistics unavailable.")

    @classmethod
    def _error_payload(cls, message: str) -> Dict[str, Any]:
        return {
            "status": "PROVIDER_ERROR",
            "error": True,
            "errorMessage": message,
            "totalPopulation": None,
            "datasetYear": cls.DEFAULT_YEAR,
            "source": cls.SOURCE,
            "coverage": cls.COVERAGE,
            "isLive": False,
        }

    @classmethod
    def bbox_to_polygon_geojson(cls, min_lon: float, min_lat: float, max_lon: float, max_lat: float) -> Dict[str, Any]:
        """
        Creates GeoJSON FeatureCollection containing a bounding box polygon.
        """
        return {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [round(min_lon, 5), round(min_lat, 5)],
                        [round(max_lon, 5), round(min_lat, 5)],
                        [round(max_lon, 5), round(max_lat, 5)],
                        [round(min_lon, 5), round(max_lat, 5)],
                        [round(min_lon, 5), round(min_lat, 5)],
                    ]],
                },
                "properties": {},
            }],
        }

    @classmethod
    def point_radius_to_polygon_geojson(cls, lat: float, lon: float, radius_km: float = 1.0) -> Dict[str, Any]:
        """
        Generates a 12-sided approximating polygon for a radius around lat, lon.
        """
        sides = 12
        coords = []
        d_lat = radius_km / 111.0
        d_lon = radius_km / (111.0 * max(0.1, math.cos(math.radians(lat))))

        for i in range(sides):
            angle = (2 * math.pi / sides) * i
            pt_lat = lat + (d_lat * math.sin(angle))
            pt_lon = lon + (d_lon * math.cos(angle))
            coords.append([round(pt_lon, 5), round(pt_lat, 5)])
        coords.append(coords[0])

        return {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [coords],
                },
                "properties": {"radiusKm": radius_km},
            }],
        }

    @classmethod
    async def get_population_for_scope(
        cls,
        geography: str,
        lat: float,
        lon: float,
        radius_km: float = 10.0,
        country: Optional[str] = None,
        region: Optional[str] = None,
        district: Optional[str] = None,
        boundary_geojson: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Calculates demographic statistics for a specified geographic scope.
        """
        geo_upper = geography.upper()

        # World scope baseline
        if geo_upper == "WORLD":
            return {
                "status": "AVAILABLE",
                "error": False,
                "errorMessage": None,
                "totalPopulation": 7794798739,  # UN / WorldPop 2020 world population
                "datasetYear": 2020,
                "source": "WorldPop / UN WPP (2020)",
                "coverage": "Global Aggregate",
                "isLive": False,
            }

        # If boundary GeoJSON polygon is supplied (e.g. from ArcGIS Boundary Service)
        if boundary_geojson and boundary_geojson.get("type") in ["Polygon", "MultiPolygon", "Feature", "FeatureCollection"]:
            fc = boundary_geojson
            if boundary_geojson.get("type") == "Polygon":
                fc = {
                    "type": "FeatureCollection",
                    "features": [{"type": "Feature", "geometry": boundary_geojson, "properties": {}}],
                }
            return await cls.get_population_stats_for_geojson(fc, year=cls.DEFAULT_YEAR)

        # Fallback: compute bounding box based on geography scope
        if geo_upper == "COUNTRY":
            # National bbox approximation (~300-500km radius)
            poly = cls.point_radius_to_polygon_geojson(lat, lon, radius_km=min(400.0, max(100.0, radius_km)))
        elif geo_upper == "STATE":
            poly = cls.point_radius_to_polygon_geojson(lat, lon, radius_km=min(150.0, max(50.0, radius_km)))
        elif geo_upper == "DISTRICT":
            poly = cls.point_radius_to_polygon_geojson(lat, lon, radius_km=min(50.0, max(20.0, radius_km)))
        elif geo_upper == "CITY":
            poly = cls.point_radius_to_polygon_geojson(lat, lon, radius_km=min(25.0, max(10.0, radius_km)))
        else:  # PLACE
            poly = cls.point_radius_to_polygon_geojson(lat, lon, radius_km=max(1.0, min(10.0, radius_km)))

        return await cls.get_population_stats_for_geojson(poly, year=cls.DEFAULT_YEAR)
