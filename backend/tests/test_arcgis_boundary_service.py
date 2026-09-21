"""
Unit and Integration Tests for UrbanPulse ArcGIS Boundary Service
Tests World Bank Global Administrative Divisions FeatureServer:
- Layer 1: WB_GAD_ADM0 (Country boundaries)
- Layer 2: WB_GAD_ADM1 (State / Region boundaries)
- Layer 3: WB_GAD_ADM2 (District / County boundaries)
- Server-side caching
- Point-in-polygon spatial constraints
- BOUNDARY_PROVIDER_ERROR handling (Never generic INSUFFICIENT DATA)
"""

import pytest
import time
from app.services.arcgis_boundary_service import (
    ArcGISBoundaryService,
    ArcGISBoundaryProviderError,
    point_in_polygon,
    point_in_geometry,
)
from app.services.heatmap_service import HeatmapService


@pytest.mark.asyncio
async def test_arcgis_country_boundary_india():
    boundary = await ArcGISBoundaryService.get_country_boundary("India")
    assert boundary["type"] == "Feature"
    assert boundary["layerId"] == 1
    assert boundary["layerName"] == "WB_GAD_ADM0"
    props = boundary["properties"]
    assert props.get("ISO_A2") == "IN" or props.get("NAM_0") == "India"
    assert "bbox" in boundary
    bbox = boundary["bbox"]
    assert bbox[0] < bbox[2]  # min_lon < max_lon
    assert bbox[1] < bbox[3]  # min_lat < max_lat
    assert "centroid" in boundary
    assert 6.0 <= boundary["centroid"]["latitude"] <= 36.0
    assert 68.0 <= boundary["centroid"]["longitude"] <= 98.0


@pytest.mark.asyncio
async def test_arcgis_state_boundary_karnataka():
    boundary = await ArcGISBoundaryService.get_state_boundary("Karnataka")
    assert boundary["type"] == "Feature"
    assert boundary["layerId"] == 2
    assert boundary["layerName"] == "WB_GAD_ADM1"
    props = boundary["properties"]
    assert "Karnataka" in props.get("NAM_1", "")
    assert "bbox" in boundary
    assert "centroid" in boundary
    assert 11.0 <= boundary["centroid"]["latitude"] <= 19.0
    assert 74.0 <= boundary["centroid"]["longitude"] <= 79.0


@pytest.mark.asyncio
async def test_arcgis_district_boundary_bangalore():
    boundary = await ArcGISBoundaryService.get_district_boundary("Bangalore")
    assert boundary["type"] == "Feature"
    assert boundary["layerId"] == 3
    assert boundary["layerName"] == "WB_GAD_ADM2"
    props = boundary["properties"]
    assert "Bangalore" in props.get("NAM_2", "")
    assert "bbox" in boundary
    assert "centroid" in boundary
    assert 12.0 <= boundary["centroid"]["latitude"] <= 14.0
    assert 76.5 <= boundary["centroid"]["longitude"] <= 78.5


@pytest.mark.asyncio
async def test_arcgis_server_side_caching():
    # Clear cache and fetch once
    ArcGISBoundaryService.clear_cache()
    t0 = time.time()
    b1 = await ArcGISBoundaryService.get_country_boundary("India")
    first_duration = time.time() - t0

    # Second fetch should hit cache instantly (< 5ms)
    t1 = time.time()
    b2 = await ArcGISBoundaryService.get_country_boundary("India")
    second_duration = time.time() - t1

    assert b1["bbox"] == b2["bbox"]
    assert second_duration < 0.05
    assert second_duration < first_duration


def test_point_in_polygon_ray_casting():
    # Simple 10x10 square: (0,0) to (10,10)
    square = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]
    assert point_in_polygon(5.0, 5.0, square) is True
    assert point_in_polygon(15.0, 5.0, square) is False
    assert point_in_polygon(5.0, 15.0, square) is False
    assert point_in_polygon(-1.0, 5.0, square) is False

    # Square with hole in center (3,3) to (7,7)
    square_with_hole = [
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],  # Outer
        [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]],       # Hole
    ]
    assert point_in_polygon(1.0, 1.0, square_with_hole) is True
    assert point_in_polygon(5.0, 5.0, square_with_hole) is False  # Inside hole


@pytest.mark.asyncio
async def test_arcgis_spatial_constraint_check():
    country_b = await ArcGISBoundaryService.get_country_boundary("India")
    # Delhi is inside India
    assert ArcGISBoundaryService.is_point_in_boundary(28.6139, 77.2090, country_b) is True
    # London is outside India
    assert ArcGISBoundaryService.is_point_in_boundary(51.5074, -0.1278, country_b) is False

    state_b = await ArcGISBoundaryService.get_state_boundary("Karnataka")
    # Bengaluru is inside Karnataka
    assert ArcGISBoundaryService.is_point_in_boundary(12.9716, 77.5946, state_b) is True
    # Mumbai is outside Karnataka
    assert ArcGISBoundaryService.is_point_in_boundary(19.0760, 72.8777, state_b) is False


@pytest.mark.asyncio
async def test_arcgis_boundary_error_handling():
    with pytest.raises(ArcGISBoundaryProviderError) as exc_info:
        await ArcGISBoundaryService.get_country_boundary("NonExistentCountryXYZ98765")
    assert "No boundary feature found" in str(exc_info.value) or "error" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_heatmap_country_with_arcgis_boundary():
    res = await HeatmapService.get_heatmap_data(geography="COUNTRY", country="India", metric="AQI")
    assert res["status"] == "READY"
    assert res["geography"] == "COUNTRY"
    assert "boundary" in res and res["boundary"] is not None
    assert res["boundary"]["layerName"] == "WB_GAD_ADM0"
    assert len(res["cells"]) > 0
    # Center should be derived from the boundary centroid
    assert "ArcGIS ADM0 Boundary" in res["diagnostics"]["centerUsed"]


@pytest.mark.asyncio
async def test_heatmap_state_with_arcgis_boundary():
    res = await HeatmapService.get_heatmap_data(geography="STATE", region="Karnataka", metric="WEATHER")
    assert res["status"] == "READY"
    assert res["geography"] == "STATE"
    assert "boundary" in res and res["boundary"] is not None
    assert res["boundary"]["layerName"] == "WB_GAD_ADM1"
    assert len(res["cells"]) > 0
    assert "ArcGIS ADM1 Boundary" in res["diagnostics"]["centerUsed"]


@pytest.mark.asyncio
async def test_heatmap_district_with_arcgis_boundary():
    res = await HeatmapService.get_heatmap_data(geography="DISTRICT", district="Bangalore", metric="POPULATION")
    assert res["status"] == "READY"
    assert res["geography"] == "DISTRICT"
    assert "boundary" in res and res["boundary"] is not None
    assert res["boundary"]["layerName"] == "WB_GAD_ADM2"
    assert len(res["cells"]) > 0
    assert "ArcGIS ADM2 Boundary" in res["diagnostics"]["centerUsed"]


@pytest.mark.asyncio
async def test_heatmap_boundary_provider_error_returned():
    """
    CRITICAL USER CONTRACT:
    If an ArcGIS request fails, return BOUNDARY_PROVIDER_ERROR.
    Do NOT return generic INSUFFICIENT DATA.
    Do NOT crash the application.
    """
    res = await HeatmapService.get_heatmap_data(
        geography="COUNTRY",
        country="NonExistentCountry999999",
        metric="AQI",
    )
    assert res["status"] == "BOUNDARY_PROVIDER_ERROR"
    assert res["availabilityStatus"] == "BOUNDARY_PROVIDER_ERROR"
    assert res["status"] != "INSUFFICIENT_DATA"
    assert res["availabilityStatus"] != "INSUFFICIENT_SPATIAL_DATA"
    assert res["diagnostics"]["status"] == "BOUNDARY_PROVIDER_ERROR"
    assert "error" in res
    assert len(res["cells"]) == 0
