"""
Comprehensive Test Suite for Open-Meteo Air Quality & Weather Integration
Covers:
1. Dynamic coordinate input (no hardcoded coordinates)
2. Multi-location batch querying via openmeteo_requests
3. CPCB India vs US EPA AQI standard calculations
4. Weather variables (temp, precip, wind, humidity, weather code)
5. Heatmap Section 45 response structure & status contract (AVAILABLE, PARTIAL, EMPTY_DATA, NO_COVERAGE, INSUFFICIENT_SPATIAL_DATA, PROVIDER_ERROR)
6. Scopes: WORLD, COUNTRY, STATE, CITY, PLACE
"""

import pytest
from unittest.mock import patch
from app.services.providers.air_quality_provider import AirQualityProvider, calculate_cpcb_india_aqi, classify_us_aqi
from app.services.providers.weather_provider import WeatherProvider
from app.services.heatmap_service import HeatmapService


# 1. Dynamic Coordinate & Batching Tests for Air Quality
@pytest.mark.asyncio
async def test_air_quality_dynamic_batch():
    points = [
        (12.9716, 77.5946, "Bengaluru, India"),
        (12.2958, 76.6394, "Mysuru, India"),
        (51.5074, -0.1278, "London, UK"),
        (35.6762, 139.6503, "Tokyo, Japan"),
    ]
    results = await AirQualityProvider.get_batch_air_quality(points)
    assert len(results) == 4

    # Bengaluru should use CPCB India AQI
    blr = results[0]
    assert blr["latitude"] == 12.9716
    assert blr["scale"] == "CPCB_INDIA_AQI"
    assert blr["status"] in ("AVAILABLE", "NO_COVERAGE")
    if blr["status"] == "AVAILABLE":
        assert blr["value"] > 0
        assert blr["unit"] == "AQI"
        assert blr["category"] in ("Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe")
        assert "pm2_5" in blr["pollutants"]

    # London should use US_AQI or EUROPEAN_AQI
    london = results[2]
    assert london["latitude"] == 51.5074
    assert london["scale"] in ("US_AQI", "EUROPEAN_AQI")
    if london["status"] == "AVAILABLE":
        assert london["unit"] == "AQI"
        assert london["category"] in (
            "Good", "Moderate", "Unhealthy for Sensitive Groups",
            "Unhealthy", "Very Unhealthy", "Hazardous"
        )


# 2. Dynamic Coordinate & Batching Tests for Weather
@pytest.mark.asyncio
async def test_weather_dynamic_batch():
    points = [
        (12.9716, 77.5946, "Bengaluru, India"),
        (28.6139, 77.2090, "Delhi, India"),
        (40.7128, -74.0060, "New York, USA"),
        (50.1109, 8.6821, "Frankfurt, Germany"),
    ]
    results = await WeatherProvider.get_batch_weather(points)
    assert len(results) == 4

    for obs in results:
        assert obs["metric"] == "WEATHER"
        assert obs["status"] in ("AVAILABLE", "NO_COVERAGE")
        if obs["status"] == "AVAILABLE":
            assert "temperatureC" in obs["metadata"]
            assert "precipitationMm" in obs["metadata"]
            assert "windSpeedKmh" in obs["metadata"]
            assert "weatherCode" in obs["metadata"]
            assert obs["unit"] == "°C"


# 3. Calculation Accuracy Tests
def test_cpcb_india_aqi_breakpoints():
    val_good, cat_good = calculate_cpcb_india_aqi(pm2_5=15.0, pm10=30.0)
    assert val_good <= 50
    assert cat_good == "Good"

    val_sat, cat_sat = calculate_cpcb_india_aqi(pm2_5=45.0, pm10=75.0)
    assert 50 < val_sat <= 100
    assert cat_sat == "Satisfactory"

    val_mod, cat_mod = calculate_cpcb_india_aqi(pm2_5=75.0, pm10=150.0)
    assert 100 < val_mod <= 200
    assert cat_mod == "Moderate"

    val_poor, cat_poor = calculate_cpcb_india_aqi(pm2_5=105.0, pm10=280.0)
    assert 200 < val_poor <= 300
    assert cat_poor == "Poor"

    val_vpoor, cat_vpoor = calculate_cpcb_india_aqi(pm2_5=200.0, pm10=390.0)
    assert 300 < val_vpoor <= 400
    assert cat_vpoor == "Very Poor"

    val_sev, cat_sev = calculate_cpcb_india_aqi(pm2_5=280.0, pm10=450.0)
    assert val_sev > 400
    assert cat_sev == "Severe"


def test_us_aqi_classification():
    assert classify_us_aqi(40) == "Good"
    assert classify_us_aqi(75) == "Moderate"
    assert classify_us_aqi(120) == "Unhealthy for Sensitive Groups"
    assert classify_us_aqi(160) == "Unhealthy"
    assert classify_us_aqi(250) == "Very Unhealthy"
    assert classify_us_aqi(350) == "Hazardous"


# 4. Section 45 Response Contract Tests for Heatmap Service
@pytest.mark.asyncio
async def test_heatmap_section_45_contract_aqi():
    res = await HeatmapService.get_heatmap_data(
        latitude=12.9716,
        longitude=77.5946,
        radius_km=30.0,
        metric="AQI",
        sub_metric="AQI_LEVEL",
        geography="CITY",
    )
    # Required Section 45 root fields
    expected_fields = [
        "metric", "subMetric", "scope", "geography", "resolution",
        "status", "availabilityStatus", "source", "updatedAt", "timestamp",
        "coverage", "confidence", "stats", "count", "cells", "legend", "diagnostics"
    ]
    for field in expected_fields:
        assert field in res, f"Missing required Section 45 field: {field}"

    assert res["metric"] == "AQI"
    assert res["scope"] == "CITY"
    assert res["geography"] == "CITY"
    assert res["source"] in ("Open-Meteo CAMS/SILAM", "Open-Meteo Air Quality API")
    assert res["status"] in ("READY", "EMPTY_DATA", "PARTIAL")
    assert res["availabilityStatus"] in ("AVAILABLE", "PARTIAL", "EMPTY_DATA", "NO_COVERAGE", "INSUFFICIENT_SPATIAL_DATA", "PROVIDER_ERROR")
    assert isinstance(res["cells"], list)
    assert len(res["cells"]) > 0

    first_cell = res["cells"][0]
    cell_fields = [
        "id", "latitude", "longitude", "geometry", "center",
        "metric", "subMetric", "value", "rawValue", "normalizedValue",
        "unit", "category", "status", "confidence", "coverage", "timestamp", "source"
    ]
    for cfield in cell_fields:
        assert cfield in first_cell, f"Missing required cell field: {cfield}"


@pytest.mark.asyncio
async def test_heatmap_section_45_contract_weather():
    res = await HeatmapService.get_heatmap_data(
        latitude=12.9716,
        longitude=77.5946,
        radius_km=30.0,
        metric="WEATHER",
        sub_metric="TEMPERATURE_STRESS",
        geography="CITY",
    )
    assert res["metric"] == "WEATHER"
    assert res["scope"] == "CITY"
    assert "Open-Meteo" in res["source"]
    assert len(res["cells"]) > 0
    first_cell = res["cells"][0]
    assert first_cell["unit"] == "°C"
    assert "metadata" in first_cell
    assert "temperatureC" in first_cell["metadata"]


# 5. Scopes: WORLD, COUNTRY, STATE, CITY, PLACE
@pytest.mark.asyncio
async def test_heatmap_scopes_coverage():
    scopes_to_test = [
        ("WORLD", 0.0, 0.0, 5000.0, None, None),
        ("COUNTRY", 20.5937, 78.9629, 1500.0, "India", None),
        ("STATE", 15.3173, 75.7139, 400.0, "India", "Karnataka"),
        ("PLACE", 12.2958, 76.6394, 25.0, None, None),
    ]

    for scope, lat, lon, radius, country, region in scopes_to_test:
        res = await HeatmapService.get_heatmap_data(
            latitude=lat,
            longitude=lon,
            radius_km=radius,
            metric="AQI",
            geography=scope,
            country=country,
            region=region,
        )
        assert res["scope"] == scope
        assert res["metric"] == "AQI"
        assert res["count"] == len(res["cells"])
        assert res["count"] > 0


# 6. Strict Provider Error Simulation
@pytest.mark.asyncio
async def test_heatmap_provider_error_handling():
    # Mock get_batch_air_quality returning all PROVIDER_ERROR cells
    mock_error_cells = [
        {
            "latitude": 12.9716,
            "longitude": 77.5946,
            "status": "PROVIDER_ERROR",
            "source": "Open-Meteo CAMS/SILAM",
            "metadata": {"areaName": "Test Station", "note": "Provider error"},
        }
    ]

    with patch.object(AirQualityProvider, "get_batch_air_quality", return_value=mock_error_cells):
        res = await HeatmapService.get_heatmap_data(
            latitude=12.9716,
            longitude=77.5946,
            radius_km=25.0,
            metric="AQI",
            geography="CITY",
        )
        assert res["status"] == "PROVIDER_ERROR"
        assert res["availabilityStatus"] == "PROVIDER_ERROR"
        assert res["confidence"] == 0.0
