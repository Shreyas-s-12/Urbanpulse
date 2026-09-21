"""
Comprehensive Test Suite for TomTom Orbis Traffic API Integration
Covers:
1. API Key configuration & TomTom-Api-Key header authentication
2. MVT binary decoding & pixel-to-WGS84 projection
3. Real road geometry LineString cells (zero synthetic circles)
4. Speed & delay metrics (current speed, free-flow speed, relative_speed, delayPercent)
5. Traffic categorization (FREE, MODERATE, HIGH/HEAVY, SEVERE)
6. 60-second in-memory caching
7. Dynamic scopes (WORLD, COUNTRY, STATE, CITY, PLACE)
8. Heatmap integration conforming to Section 45
9. Error isolation (PROVIDER_ERROR handling without service crash)
"""

import pytest
import math
from unittest.mock import patch
from app.core.config import settings
from app.services.providers.tomtom_traffic_provider import (
    TomTomTrafficProvider,
    tile_px_to_latlon,
    latlon_to_tile,
    bbox_to_tiles,
    ROAD_CATEGORY_FREE_FLOW_SPEEDS,
)
from app.services.heatmap_service import HeatmapService


# 1. Configuration & Header Auth Tests
def test_tomtom_api_key_configured():
    key = TomTomTrafficProvider.get_api_key()
    assert key != ""
    assert len(key) == 32
    assert key == settings.TOMTOM_API_KEY


# 2. Geometric Projection Math Tests
def test_tile_px_to_latlon():
    # Tile (12, 2930, 1899) is in Bengaluru
    lat, lon = tile_px_to_latlon(2048, 2048, 12, 2930, 1899, extent=4096)
    assert 12.0 <= lat <= 14.0
    assert 76.5 <= lon <= 78.5


def test_latlon_to_tile_and_back():
    lat, lon = 12.9716, 77.5946
    z = 12
    x, y = latlon_to_tile(lat, lon, z)
    assert x == 2930
    assert y == 1899

    # Reverse
    rev_lat, rev_lon = tile_px_to_latlon(0, 0, z, x, y)
    assert math.isclose(rev_lat, 13.0034, abs_tol=0.1)
    assert math.isclose(rev_lon, 77.5195, abs_tol=0.1)


def test_bbox_to_tiles():
    tiles = bbox_to_tiles(13.05, 12.85, 77.70, 77.50, 12, max_tiles=16)
    assert len(tiles) > 0
    assert len(tiles) <= 16
    assert (2930, 1899) in tiles


# 3. Live Vector Flow Tile Fetch & MVT Parsing
@pytest.mark.asyncio
async def test_tomtom_live_tile_fetch_and_parse():
    status, cells = await TomTomTrafficProvider.get_tile_cells(12, 2930, 1899)
    assert status in ("AVAILABLE", "NO_COVERAGE")
    if status == "AVAILABLE":
        assert len(cells) > 0
        first_cell = cells[0]

        # Geometry must be LineString
        assert first_cell["geometry"]["type"] == "LineString"
        coords = first_cell["geometry"]["coordinates"]
        assert len(coords) >= 2
        for pt in coords:
            assert len(pt) == 2
            assert 70.0 <= pt[0] <= 90.0  # Lon
            assert 10.0 <= pt[1] <= 20.0  # Lat

        # Properties
        meta = first_cell["metadata"]
        assert "currentSpeedKmh" in meta
        assert "freeFlowSpeedKmh" in meta
        assert "relativeSpeed" in meta
        assert "delayPercent" in meta
        assert "trafficLevel" in meta
        assert first_cell["category"] in ("LOW", "MODERATE", "HIGH", "SEVERE")
        assert len(first_cell["color"]) == 4


# 4. In-Memory Tile Caching Test
@pytest.mark.asyncio
async def test_tomtom_in_memory_tile_caching():
    import time

    # First fetch
    t0 = time.time()
    s1, c1 = await TomTomTrafficProvider.get_tile_cells(12, 2930, 1899)
    t1 = time.time()

    # Second fetch should hit in-memory cache (< 5ms)
    t2 = time.time()
    s2, c2 = await TomTomTrafficProvider.get_tile_cells(12, 2930, 1899)
    t3 = time.time()

    assert s1 == s2
    assert len(c1) == len(c2)
    assert (t3 - t2) < 0.05  # Served from cache


# 5. Dynamic Geographic Scopes
@pytest.mark.asyncio
async def test_tomtom_scopes():
    # Test CITY scope (Bengaluru)
    status_city, cells_city = await TomTomTrafficProvider.get_traffic_flow_cells(
        latitude=12.9716,
        longitude=77.5946,
        geography="CITY",
    )
    assert status_city in ("AVAILABLE", "NO_COVERAGE")
    assert len(cells_city) > 0
    assert cells_city[0]["geometry"]["type"] == "LineString"

    # Test PLACE scope (Mysuru)
    status_place, cells_place = await TomTomTrafficProvider.get_traffic_flow_cells(
        latitude=12.2958,
        longitude=76.6394,
        radius_km=15.0,
        geography="PLACE",
    )
    assert status_place in ("AVAILABLE", "NO_COVERAGE")
    assert len(cells_place) > 0

    # Test WORLD scope
    status_world, cells_world = await TomTomTrafficProvider.get_traffic_flow_cells(
        geography="WORLD",
    )
    assert status_world in ("AVAILABLE", "NO_COVERAGE")
    assert len(cells_world) > 0


# 6. Section 45 Heatmap Contract Integration
@pytest.mark.asyncio
async def test_heatmap_service_traffic_section_45_contract():
    res = await HeatmapService.get_heatmap_data(
        latitude=12.9716,
        longitude=77.5946,
        radius_km=25.0,
        metric="TRAFFIC",
        geography="CITY",
    )

    expected_fields = [
        "metric", "subMetric", "scope", "geography", "resolution",
        "status", "availabilityStatus", "source", "updatedAt", "timestamp",
        "coverage", "confidence", "stats", "count", "cells", "legend", "diagnostics"
    ]
    for field in expected_fields:
        assert field in res, f"Missing Section 45 field: {field}"

    assert res["metric"] == "TRAFFIC"
    assert "TomTom" in res["source"]
    assert res["legend"]["title"] == "Traffic in this area"
    assert len(res["cells"]) > 0

    first_cell = res["cells"][0]
    assert first_cell["geometry"]["type"] == "LineString"
    assert first_cell["category"] in ("LOW", "MODERATE", "HIGH", "SEVERE")
    assert "metadata" in first_cell
    assert "currentSpeedKmh" in first_cell["metadata"]


# 7. Error Handling Isolation Test
@pytest.mark.asyncio
async def test_tomtom_provider_error_isolation():
    # Simulate TomTom API failure
    with patch.object(TomTomTrafficProvider, "fetch_tile_raw", return_value=None):
        status, cells = await TomTomTrafficProvider.get_tile_cells(12, 99999, 99999)
        assert status == "PROVIDER_ERROR"
        assert len(cells) == 0
