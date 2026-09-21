"""
Unit and Integration Test Suite: WorldPop Demographic Statistics & ArcGIS PopDensity
===================================================================================
Tests:
1. ArcGIS PopDensity MapServer health & metadata verification (2010 dataset, non-live)
2. ArcGIS live tile retrieval verification (256x256 Web Mercator PNG)
3. WorldPop GeoJSON polygon creation helpers
4. WorldPop SDI Advanced API task submission, async polling, and population calculation
5. WorldPop in-memory polygon caching
6. WorldPop geographic scopes dispatching (WORLD, COUNTRY, CITY, PLACE)
7. HeatmapService POPULATION Section 45 schema, honest dataset year, and legend contract
8. Provider error isolation (timeout / failure returns 'Population statistics unavailable.')
9. FastAPI population endpoints (/api/v1/population/status and /api/v1/population/stats)
"""

import pytest
import asyncio
import time
from typing import Dict, Any

from app.services.providers.worldpop_provider import WorldPopProvider, ArcGISPopDensityProvider
from app.services.heatmap_service import HeatmapService
from fastapi.testclient import TestClient
from app.main import app


@pytest.mark.asyncio
async def test_arcgis_popdensity_metadata_and_health():
    """Verify ArcGIS PopDensity MapServer metadata and health check."""
    health = await ArcGISPopDensityProvider.check_health()
    assert health["available"] is True
    assert health["status"] == "AVAILABLE"
    assert health["datasetYear"] == 2010
    assert health["isLive"] is False
    assert "NASA" in health["source"]
    assert "tile/{z}/{y}/{x}" in health["tileUrlTemplate"]


@pytest.mark.asyncio
async def test_arcgis_popdensity_tile_retrieval():
    """Verify ArcGIS MapServer serves real 256x256 PNG tiles."""
    import httpx
    # Zoom 2, row 1, col 2 covers parts of Europe / Africa
    url = "https://tiles.arcgis.com/tiles/WSiUmUhlFx4CtMBB/arcgis/rest/services/PopDensity/MapServer/tile/2/1/2"
    async with httpx.AsyncClient(timeout=8.0) as client:
        res = await client.get(url, headers={"User-Agent": "UrbanPulse/1.0"})
        assert res.status_code == 200
        assert "image/png" in res.headers.get("content-type", "")
        assert len(res.content) > 1000  # Valid PNG image


def test_worldpop_geojson_helpers():
    """Verify bounding box and radius polygon generation for WorldPop SDI queries."""
    bbox_poly = WorldPopProvider.bbox_to_polygon_geojson(77.5, 12.9, 77.7, 13.1)
    assert bbox_poly["type"] == "FeatureCollection"
    assert len(bbox_poly["features"]) == 1
    geom = bbox_poly["features"][0]["geometry"]
    assert geom["type"] == "Polygon"
    assert len(geom["coordinates"][0]) == 5  # Closed ring

    radius_poly = WorldPopProvider.point_radius_to_polygon_geojson(12.9716, 77.5946, radius_km=2.0)
    assert radius_poly["type"] == "FeatureCollection"
    assert len(radius_poly["features"][0]["geometry"]["coordinates"][0]) == 13  # 12 sides + closed


@pytest.mark.asyncio
async def test_worldpop_sdi_api_task_submission_and_poll():
    """Verify authentic WorldPop SDI stats submission and polling or clean provider error isolation."""
    test_poly = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[77.58, 12.96], [77.60, 12.96], [77.60, 12.98], [77.58, 12.98], [77.58, 12.96]]],
            },
            "properties": {},
        }],
    }
    res = await WorldPopProvider.get_population_stats_for_geojson(test_poly, year=2020, max_poll_seconds=20.0)
    assert res["status"] in ("AVAILABLE", "PROVIDER_ERROR")
    if res["status"] == "AVAILABLE":
        assert res["error"] is False
        assert res["totalPopulation"] is not None
        assert res["totalPopulation"] > 1000
        assert res["datasetYear"] == 2020
        assert res["isLive"] is False
    else:
        assert res["error"] is True
        assert res["errorMessage"] == "Population statistics unavailable."


@pytest.mark.asyncio
async def test_worldpop_in_memory_caching():
    """Verify repeated queries for identical polygon return cached results instantly."""
    test_poly = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[77.58, 12.96], [77.60, 12.96], [77.60, 12.98], [77.58, 12.98], [77.58, 12.96]]],
            },
            "properties": {},
        }],
    }
    # Pre-seed cache entry to verify caching mechanism independently of upstream network
    key = WorldPopProvider._cache_key(test_poly, 2020)
    cached_entry = {
        "status": "AVAILABLE",
        "error": False,
        "errorMessage": None,
        "totalPopulation": 222267,
        "datasetYear": 2020,
        "source": "WorldPop Global Project (100m)",
        "coverage": "100m gridded resolution",
        "executionTime": 3,
        "taskId": "cached-test-task",
        "isLive": False,
    }
    WorldPopProvider._cache[key] = (time.time(), cached_entry)

    t0 = time.time()
    res = await WorldPopProvider.get_population_stats_for_geojson(test_poly, year=2020)
    elapsed = time.time() - t0

    assert res["status"] == "AVAILABLE"
    assert res["totalPopulation"] == 222267
    assert elapsed < 0.05  # Cache hit is sub-millisecond


@pytest.mark.asyncio
async def test_worldpop_scopes_dispatching():
    """Verify scope-based population retrieval across WORLD, COUNTRY, CITY, and PLACE."""
    # WORLD scope: instant baseline
    world_res = await WorldPopProvider.get_population_for_scope("WORLD", 20.0, 0.0)
    assert world_res["status"] == "AVAILABLE"
    assert world_res["totalPopulation"] > 7000000000
    assert world_res["datasetYear"] == 2020
    assert world_res["isLive"] is False

    # PLACE scope: local radius query
    place_res = await WorldPopProvider.get_population_for_scope("PLACE", 12.9716, 77.5946, radius_km=1.0)
    assert place_res["status"] in ("AVAILABLE", "PROVIDER_ERROR")
    if place_res["status"] == "AVAILABLE":
        assert place_res["totalPopulation"] is not None
    else:
        assert place_res["errorMessage"] == "Population statistics unavailable."


@pytest.mark.asyncio
async def test_heatmap_service_population_section_45_contract():
    """Verify HeatmapService returns Section 45 schema with honest 2010/2020 labeling."""
    res = await HeatmapService.get_heatmap_data(
        geography="CITY",
        place_name="Bengaluru",
        metric="POPULATION",
    )
    assert res["status"] in ("READY", "AVAILABLE")
    assert res["metric"] == "POPULATION"
    assert "ArcGIS" in res["source"] or "WorldPop" in res["source"]
    assert "stats" in res
    assert "legend" in res
    legend = res["legend"]
    assert legend["metric"] == "POPULATION"
    assert legend["datasetYear"] == 2010
    assert legend["isLive"] is False
    assert "Never labeled LIVE" in legend["note"]
    assert len(legend["stops"]) >= 3
    # Check stop colors match Low=Green, Moderate=Yellow, High=Red
    colors = [s["color"] for s in legend["stops"]]
    assert "#22C55E" in colors  # Green
    assert "#EAB308" in colors  # Yellow
    assert "#EF4444" in colors  # Red

    # Verify diagnostics contains tiled service url template
    diag = res.get("diagnostics", {})
    assert "tiledServiceUrl" in diag
    assert "WSiUmUhlFx4CtMBB/arcgis/rest/services/PopDensity/MapServer" in diag["tiledServiceUrl"]
    assert diag["visualDatasetYear"] == 2010
    assert diag["statsDatasetYear"] == 2020
    assert diag["isLive"] is False


@pytest.mark.asyncio
async def test_worldpop_error_isolation():
    """Verify invalid polygon returns isolated error without raising uncaught exception."""
    invalid_poly = {"type": "FeatureCollection", "features": []}
    res = await WorldPopProvider.get_population_stats_for_geojson(invalid_poly, max_poll_seconds=1.0)
    assert res["status"] == "PROVIDER_ERROR"
    assert res["error"] is True
    assert res["errorMessage"] == "Population statistics unavailable."
    assert res["totalPopulation"] is None


def test_population_fastapi_endpoints():
    """Verify FastAPI GET /population/status and /population/stats endpoints."""
    client = TestClient(app)

    # Health status endpoint
    status_res = client.get("/api/v1/population/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert "arcgisPopDensity" in status_data
    assert "worldPopStats" in status_data
    assert "disclaimer" in status_data

    # Coordinate stats endpoint
    stats_res = client.get("/api/v1/population/stats?lat=12.9716&lon=77.5946&radius_km=1.0")
    assert stats_res.status_code == 200
    stats_data = stats_res.json()
    assert "status" in stats_data
    assert "datasetYear" in stats_data
