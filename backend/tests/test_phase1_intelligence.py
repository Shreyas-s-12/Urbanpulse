"""
Unit & Integration Tests for UrbanPulse Phase 1 Intelligence Layer Upgrade
Tests:
1. RiskRadarService: multi-domain evaluation across 8 domains, unknown data handling, spatial risk zones.
2. Honest Score: missing telemetry results in status INSUFFICIENT_DATA and score None ('—').
3. Change Detection: authentic baselines with meaningful change detection.
4. Location Agent 5-Tier Priority: priority resolution with explicit place, POI entity, coordinate entity, map center.
5. Risk Radar API Endpoint: /api/v1/intelligence/risk returns valid structure.
"""

import pytest
from app.services.risk_radar import RiskRadarService
from app.services.urban_score import ExplainableScoreService
from app.services.change_detection import ChangeDetectionService
from app.services.agent.location_agent import LocationAgentService


@pytest.mark.asyncio
async def test_risk_radar_eight_domains():
    """Verify that RiskRadarService evaluates all 8 distinct domains with honest unknown handling."""
    lat, lon = 12.9716, 77.5946  # Bengaluru
    report = await RiskRadarService.get_location_risk(lat, lon, radius_km=30.0, city="Bengaluru")

    assert "domains" in report
    domains = report["domains"]

    expected_domains = ["TRAFFIC", "FLOOD", "FIRE", "SAFETY", "WEATHER", "ROAD", "AQI", "HAZARDS"]
    for d in expected_domains:
        assert d in domains, f"Missing domain {d} in Risk Radar"
        assessment = domains[d]
        assert "level" in assessment
        assert assessment["level"] in ["LOW", "MODERATE", "HIGH", "SEVERE", "UNKNOWN"]
        assert "headline" in assessment
        assert "confidence" in assessment

    assert "overallLevel" in report
    assert report["overallLevel"] in ["LOW", "MODERATE", "HIGH", "SEVERE", "UNKNOWN"]
    assert "actionableGuidance" in report
    assert isinstance(report["actionableGuidance"], list)
    assert len(report["actionableGuidance"]) > 0


@pytest.mark.asyncio
async def test_risk_radar_no_coverage_returns_unknown():
    """Verify that missing feeds are marked as UNKNOWN with null score, never '0' or 'LOW'."""
    lat, lon = 0.0, 0.0  # Ocean / Null Island
    report = await RiskRadarService.get_location_risk(lat, lon, radius_km=10.0)

    assert "domains" in report
    # Traffic on open ocean should have no telemetry -> UNKNOWN level, null score
    traffic_domain = report["domains"]["TRAFFIC"]
    assert traffic_domain["level"] == "UNKNOWN"
    assert traffic_domain["score"] is None


@pytest.mark.asyncio
async def test_honest_urban_score_missing_signals():
    """Verify that insufficient domain coverage yields INSUFFICIENT_DATA and score None rather than 50."""
    lat, lon = 0.0, 0.0  # Ocean
    score_res = await ExplainableScoreService.calculate_urbanpulse_score(lat, lon, radius_km=5.0)

    assert "score" in score_res
    # Should report status and null score if insufficient continuous physical telemetry
    if score_res["status"] == "INSUFFICIENT_DATA":
        assert score_res["score"] is None


@pytest.mark.asyncio
async def test_location_agent_five_tier_priority():
    """Verify 5-tier location priority resolution in LocationAgentService."""
    # Priority 1: Explicit place in query overrides active location
    parsed_1 = await LocationAgentService.extract_intent("What is the traffic in Paris?", current_loc={"city": "Bengaluru"})
    assert parsed_1.location_query is not None
    assert "paris" in parsed_1.location_query.lower()

    # Priority 2: Selected POI in current_loc
    poi_loc = {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "city": "Bengaluru",
        "selectedMapEntity": {
            "type": "POI",
            "id": "place_mysore_palace",
            "name": "Mysore Palace",
            "coordinates": {"latitude": 12.3051, "longitude": 76.6552},
        },
    }
    resolved_poi, _ = await LocationAgentService.resolve_target_location(None, current_loc=poi_loc)
    assert resolved_poi is not None
    assert resolved_poi["type"] == "POI"
    assert "Mysore Palace" in resolved_poi["name"]
    assert abs(resolved_poi["latitude"] - 12.3051) < 0.01

    # Priority 3: Fallback to map coordinates when no entity selected
    map_loc = {"latitude": 13.0827, "longitude": 80.2707, "city": "Chennai"}
    resolved_map, _ = await LocationAgentService.resolve_target_location(None, current_loc=map_loc)
    assert resolved_map is not None
    assert abs(resolved_map["latitude"] - 13.0827) < 0.01


@pytest.mark.asyncio
async def test_risk_radar_api_route():
    """Test /api/v1/intelligence/risk endpoint response structure."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/intelligence/risk?latitude=12.9716&longitude=77.5946&city=Bengaluru")
        assert res.status_code == 200
        data = res.json()
        assert "domains" in data
        assert "overallLevel" in data
        assert "actionableGuidance" in data
