"""
Unit tests for UrbanPulse Intelligence Heatmap Service & Endpoints
Verifies:
- All 5 metrics (AQI, TRAFFIC, WEATHER, RISK, COMBINED)
- Spatial statistics computation (min, max, mean, stdDev, isUniform)
- Empty data and no coverage handling (no fake data)
- Geographic scopes and radial scaling
"""

import pytest
from app.services.heatmap_service import HeatmapService, compute_spatial_stats


@pytest.mark.asyncio
async def test_compute_spatial_stats_gradient():
    cells = [
        {"value": 20.0},
        {"value": 40.0},
        {"value": 60.0},
        {"value": 80.0},
    ]
    stats = compute_spatial_stats(cells)
    assert stats["min"] == 20.0
    assert stats["max"] == 80.0
    assert stats["mean"] == 50.0
    assert stats["stdDev"] > 0
    assert stats["isUniform"] is False
    assert stats["validCount"] == 4
    assert stats["missingCount"] == 0


@pytest.mark.asyncio
async def test_compute_spatial_stats_uniform():
    cells = [
        {"value": 55.0},
        {"value": 55.0},
        {"value": 55.0},
    ]
    stats = compute_spatial_stats(cells)
    assert stats["min"] == 55.0
    assert stats["max"] == 55.0
    assert stats["mean"] == 55.0
    assert stats["stdDev"] == 0.0
    assert stats["isUniform"] is True
    assert stats["uniformReason"] in ("UNIFORM DATA", "Limited spatial variation")


@pytest.mark.asyncio
async def test_compute_spatial_stats_empty():
    stats = compute_spatial_stats([])
    assert stats["validCount"] == 0
    assert stats["isUniform"] is True


@pytest.mark.asyncio
async def test_heatmap_service_risk_metric():
    # Bengaluru coordinates
    res = await HeatmapService.get_heatmap_data(
        latitude=12.9716,
        longitude=77.5946,
        radius_km=25.0,
        metric="RISK",
        geography="CITY",
    )
    assert res["status"] in ("READY", "NO_DATA")
    assert res["metric"] == "RISK"
    assert "stats" in res
    assert "cells" in res
    if res["cells"]:
        cell = res["cells"][0]
        assert "latitude" in cell
        assert "longitude" in cell
        assert "normalizedValue" in cell
        assert 0.0 <= cell["normalizedValue"] <= 1.0


@pytest.mark.asyncio
async def test_heatmap_service_weather_metric():
    res = await HeatmapService.get_heatmap_data(
        latitude=12.9716,
        longitude=77.5946,
        radius_km=15.0,
        metric="WEATHER",
        geography="CITY",
    )
    assert res["status"] in ("READY", "NO_DATA")
    assert res["metric"] == "WEATHER"
    assert "stats" in res
    assert "cells" in res


@pytest.mark.asyncio
async def test_heatmap_service_combined_metric():
    res = await HeatmapService.get_heatmap_data(
        latitude=12.9716,
        longitude=77.5946,
        radius_km=30.0,
        metric="COMBINED",
        geography="CITY",
    )
    assert res["status"] in ("READY", "NO_DATA", "NO_COVERAGE")
    assert res["metric"] == "COMBINED"
    assert "stats" in res


@pytest.mark.asyncio
async def test_heatmap_service_submetrics_and_scopes():
    # Test COUNTRY scope with PM25
    res_country = await HeatmapService.get_heatmap_data(
        latitude=20.5937,
        longitude=78.9629,
        radius_km=50.0,
        metric="AQI",
        sub_metric="PM25",
        geography="COUNTRY",
        time_window="24H",
    )
    assert res_country["status"] in ("READY", "NO_DATA")
    assert res_country["metric"] == "AQI"
    assert res_country["subMetric"] == "PM25"
    assert res_country["geography"] == "COUNTRY"
    assert res_country["timeWindow"] == "24H"
    assert len(res_country["cells"]) > 0

    first_cell = res_country["cells"][0]
    assert "geometry" in first_cell
    assert "category" in first_cell
    assert "subMetric" in first_cell
    valid_cats = {
        "GOOD", "SATISFACTORY", "MODERATE", "POOR", "VERY POOR", "SEVERE",
        "UNHEALTHY FOR SENSITIVE GROUPS", "UNHEALTHY", "VERY UNHEALTHY", "HAZARDOUS",
        "HIGH", "LOW", "CRITICAL", "UNKNOWN"
    }
    assert first_cell["category"].upper() in valid_cats


@pytest.mark.asyncio
async def test_heatmap_service_traffic_corridors():
    res_traffic = await HeatmapService.get_heatmap_data(
        latitude=12.9716,
        longitude=77.5946,
        radius_km=25.0,
        metric="TRAFFIC",
        sub_metric="CORRIDOR_CONGESTION",
        geography="CITY",
        time_window="NOW",
    )
    assert res_traffic["status"] == "READY"
    assert res_traffic["subMetric"] == "CORRIDOR_CONGESTION"
    assert len(res_traffic["cells"]) > 0
    # Check that cells have corridor line coordinates
    has_corridor = any(c.get("geometry", {}).get("type") == "LineString" for c in res_traffic["cells"])
    assert has_corridor is True


@pytest.mark.asyncio
async def test_heatmap_api_endpoint():
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/intelligence/heatmap",
            params={
                "lat": 12.9716,
                "lng": 77.5946,
                "metric": "RISK",
                "sub_metric": "MULTI_HAZARD_INDEX",
                "geography": "CITY",
                "time_window": "NOW",
                "radius_km": 25.0,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["metric"] == "RISK"
        assert data["subMetric"] == "MULTI_HAZARD_INDEX"
        assert "stats" in data
        assert "cells" in data
        assert len(data["cells"]) > 0


@pytest.mark.asyncio
async def test_heatmap_world_scope_no_coords():
    """Test WORLD scope requires no lat/lng, returns 40+ continental cells and centerUsed='NONE for WORLD'."""
    res = await HeatmapService.get_heatmap_data(
        metric="AQI",
        geography="WORLD",
    )
    assert res["status"] in ("READY", "NO_DATA")
    assert res["metric"] == "AQI"
    assert res["geography"] == "WORLD"
    assert "diagnostics" in res
    assert res["diagnostics"]["centerUsed"] == "NONE for WORLD"
    assert res["diagnostics"]["scope"] == "WORLD"
    assert len(res["cells"]) >= 40

    # Ensure coverage across Americas, Europe, Asia, Oceania
    longitudes = [c["longitude"] for c in res["cells"]]
    assert any(lon < -70 for lon in longitudes), "Missing Western Hemisphere (Americas)"
    assert any(lon > 100 for lon in longitudes), "Missing Eastern Hemisphere (Asia/Oceania)"


@pytest.mark.asyncio
async def test_heatmap_country_scope():
    """Test COUNTRY scope defaults to national boundaries without requiring user coords."""
    res = await HeatmapService.get_heatmap_data(
        metric="WEATHER",
        geography="COUNTRY",
    )
    assert res["status"] in ("READY", "NO_DATA")
    assert res["geography"] == "COUNTRY"
    assert ("ArcGIS ADM0 Boundary" in res["diagnostics"]["centerUsed"] or "Scope Anchor" in res["diagnostics"]["centerUsed"])
    assert len(res["cells"]) >= 20


@pytest.mark.asyncio
async def test_heatmap_api_world_no_coords():
    """API endpoint test: /api/v1/intelligence/heatmap with no lat/lng and WORLD scope."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/intelligence/heatmap",
            params={
                "metric": "AQI",
                "geography": "WORLD",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["metric"] == "AQI"
        assert data["geography"] == "WORLD"
        assert data["diagnostics"]["centerUsed"] == "NONE for WORLD"
        assert len(data["cells"]) >= 40

