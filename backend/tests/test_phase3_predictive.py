"""
Unit and Integration Tests for UrbanPulse Phase 3 Predictive Intelligence:
- Predictive Traffic Intelligence & Diurnal Baselines
- Multi-Horizon Risk Forecasting (8 Horizons, 8 Domains)
- Deterministic Scenario Engine & Road Closure Simulation
- Smart Routes Multi-Criteria Optimization
- Travel Mission Mode & Departure Timing
- Find Me a Place Multi-Signal Recommendation
- Incident Cascade Detection
- Monitoring & Alert State Lifecycle
- Unfabricated Predictions & Missing Data Handling
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.predictive_traffic import PredictiveTrafficService
from app.services.risk_forecast import RiskForecastService
from app.services.scenario_engine import ScenarioEngineService
from app.services.smart_routes import SmartRoutesService
from app.services.mission_service import MissionService
from app.services.place_recommender import PlaceRecommenderService
from app.services.cascade_service import CascadeService
from app.services.monitoring import MonitoringService
from app.services.agent.location_agent import LocationAgentService


# ==============================================================================
# 1. Predictive Traffic Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_predictive_traffic_diurnal_baseline():
    """Verify diurnal baseline calculations across peak, off-peak, and weekend."""
    # Weekday morning rush (08:30)
    morning_peak = PredictiveTrafficService.calculate_diurnal_baseline(8.5, is_weekend=False)
    assert morning_peak >= 60, f"Expected morning rush baseline >= 60, got {morning_peak}"

    # Weekday night trough (02:00)
    night_trough = PredictiveTrafficService.calculate_diurnal_baseline(2.0, is_weekend=False)
    assert night_trough <= 25, f"Expected night trough <= 25, got {night_trough}"

    # Weekend midday
    weekend_midday = PredictiveTrafficService.calculate_diurnal_baseline(14.0, is_weekend=True)
    assert 30 <= weekend_midday <= 65


@pytest.mark.asyncio
async def test_predictive_traffic_live_forecast():
    """Verify traffic forecast generation with deviation and 2-hour window."""
    mock_traffic = {
        "status": "AVAILABLE",
        "available": True,
        "trafficStatus": "HEAVY",
        "delayMinutes": 18,
        "detail": "Slow moving",
        "corridors": [{"name": "Main Corridor", "delayMinutes": 18}],
    }
    with patch("app.services.google_traffic.GoogleTrafficService.get_traffic_summary", new_callable=AsyncMock) as m_mock:
        m_mock.return_value = mock_traffic
        fc = await PredictiveTrafficService.get_traffic_forecast(12.9716, 77.5946, radius_km=25.0)

        assert fc["status"] == "AVAILABLE"
        assert fc["currentLevel"] == "HEAVY"
        assert fc["forecastWindow"] == "Next 2 hours"
        assert fc["confidence"] > 0.7
        assert "baseline" in fc
        assert "deviationPercent" in fc["baseline"]
        assert fc["baseline"]["trend"] in ["INCREASING", "STABLE", "DECREASING"]
        assert "expectedPeakTime" in fc


@pytest.mark.asyncio
async def test_predictive_traffic_unavailable_fallback():
    """Verify honest UNAVAILABLE declaration when telemetry is absent."""
    mock_empty = {
        "status": "UNAVAILABLE",
        "available": False,
        "delayMinutes": 0,
        "trafficStatus": "NORMAL",
        "corridors": [],
    }
    with patch("app.services.google_traffic.GoogleTrafficService.get_traffic_summary", new_callable=AsyncMock) as m_mock:
        m_mock.return_value = mock_empty
        fc = await PredictiveTrafficService.get_traffic_forecast(0.0, 0.0)

        assert fc["status"] == "UNAVAILABLE"
        assert fc["currentLevel"] == "UNKNOWN"
        assert fc["confidence"] == 0.0
        assert "Predictive traffic unavailable" in fc["summary"]


# ==============================================================================
# 2. Risk Forecast Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_risk_forecast_multi_horizon():
    """Verify RiskForecastService produces all 8 horizons across all 8 domains with decaying confidence."""
    fc = await RiskForecastService.get_risk_forecast(12.2958, 76.6394)

    assert "horizons" in fc
    horizons = fc["horizons"]
    expected_horizons = [
        "NOW", "1_HOUR", "3_HOURS", "6_HOURS", "12_HOURS", "24_HOURS", "7_DAYS", "30_DAY_OUTLOOK"
    ]
    for h in expected_horizons:
        assert h in horizons, f"Missing horizon {h}"
        h_data = horizons[h]
        assert "overallLevel" in h_data
        assert "confidence" in h_data
        assert "domains" in h_data
        # Verify all 8 domains exist
        for dom in ["FLOOD", "FIRE", "WEATHER", "TRAFFIC", "ROAD", "SAFETY", "AQI", "HAZARDS"]:
            assert dom in h_data["domains"], f"Missing domain {dom} in horizon {h}"
            # Safety forecast must be marked UNKNOWN to prevent fabricated assertions
            if dom == "SAFETY":
                assert h_data["domains"][dom]["forecastLevel"] == "UNKNOWN"

    # Verify confidence degrades from NOW to 30_DAY_OUTLOOK
    assert horizons["NOW"]["confidence"] > horizons["30_DAY_OUTLOOK"]["confidence"]


# ==============================================================================
# 3. Scenario Engine Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_scenario_rainfall_simulation():
    """Verify rainfall +40% deterministic simulation output and strict SIMULATION labeling."""
    sim = await ScenarioEngineService.simulate_scenario(
        latitude=12.2958,
        longitude=76.6394,
        scenario_type="heavy_rainfall",
        parameters={"percent_increase": 40.0, "duration_hours": 3.0},
    )

    assert sim["isSimulation"] is True
    assert sim["label"] == "SIMULATION"
    assert sim["notObservedReality"] is True
    assert "baseline" in sim
    assert "scenario" in sim
    assert "difference" in sim
    assert sim["difference"]["scoreDelta"] < 0
    assert sim["difference"]["trafficDelayIncreasePercent"] > 0
    assert "FLOOD" in sim["affectedDomains"]
    assert sim["affectedAreaKm2"] > 0
    assert len(sim["assumptions"]) > 0


@pytest.mark.asyncio
async def test_scenario_road_closure_simulation():
    """Verify road closure simulation produces affected corridor polylines and alternate routes."""
    sim = await ScenarioEngineService.simulate_scenario(
        latitude=12.9716,
        longitude=77.5946,
        scenario_type="road_closure",
        parameters={"corridor_name": "Outer Ring Road Arterial"},
    )

    assert sim["isSimulation"] is True
    assert "ROADS" in sim["affectedDomains"]
    assert sim["closedRoadPolyline"] is not None
    assert len(sim["closedRoadPolyline"]) >= 2
    assert sim["alternateRoutePolyline"] is not None
    assert len(sim["alternateRoutePolyline"]) >= 2


@pytest.mark.asyncio
async def test_scenario_extreme_heat():
    """Verify temperature +5°C scenario impact on heat index and AQI."""
    sim = await ScenarioEngineService.simulate_scenario(
        latitude=28.6139,
        longitude=77.2090,
        scenario_type="extreme_heat",
        parameters={"temperature_delta_c": 5.0},
    )

    assert sim["isSimulation"] is True
    assert "WEATHER" in sim["affectedDomains"]
    assert "AQI" in sim["affectedDomains"]
    assert sim["difference"]["scoreDelta"] < 0


# ==============================================================================
# 4. Smart Routes Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_smart_routes_multi_criteria():
    """Verify 4 distinct route options with transparent weighted scores."""
    routes_plan = await SmartRoutesService.compute_smart_routes(
        origin_lat=12.9716,
        origin_lon=77.5946,
        dest_lat=12.2958,
        dest_lon=76.6394,
        travel_mode="drive",
    )

    assert "options" in routes_plan
    options = routes_plan["options"]
    assert "FASTEST" in options
    assert "LOWEST_TRAFFIC" in options
    assert "LOWEST_RISK" in options
    assert "BALANCED" in options

    rec = routes_plan["recommendedRoute"]
    assert rec["category"] in ["BALANCED", "FASTEST", "LOWEST_TRAFFIC", "LOWEST_RISK"]
    assert "scoreBreakdown" in rec
    sb = rec["scoreBreakdown"]
    assert "travelTimeScore" in sb
    assert "trafficScore" in sb
    assert "riskScore" in sb
    assert "totalScore" in sb
    assert "whyThisRoute" in rec
    assert len(routes_plan["tradeOffs"]) > 0


# ==============================================================================
# 5. Mission Mode Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_mission_service_plan():
    """Verify travel mission planning from Mysuru to Bengaluru."""
    mission = await MissionService.plan_mission(
        origin_query="Mysuru",
        destination_query="Bengaluru",
        preference="BALANCED",
    )

    assert "missionId" in mission
    assert "Mysuru" in mission["title"]
    assert "departureWindow" in mission
    assert "recommendedDepartureTime" in mission
    assert "recommendedDepartureReason" in mission
    assert "expectedConditions" in mission
    assert "traffic" in mission["expectedConditions"]
    assert "weather" in mission["expectedConditions"]
    assert len(mission["whyRecommendation"]) > 0


# ==============================================================================
# 6. Place Recommender Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_place_recommender():
    """Verify multi-signal place recommendations."""
    places = await PlaceRecommenderService.recommend_places(
        latitude=12.9716,
        longitude=77.5946,
        intent_type="peaceful",
        radius_km=15.0,
        limit=3,
    )

    assert isinstance(places, list)
    if places:
        top = places[0]
        assert "name" in top
        assert "overallRecommendationScore" in top
        assert "whyThisPlace" in top
        assert "distanceKm" in top


# ==============================================================================
# 7. Incident Cascade Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_cascade_detection():
    """Verify cascade chain detection returns valid schema and evidence."""
    cascades = await CascadeService.detect_cascades(12.9716, 77.5946, radius_km=25.0)
    assert isinstance(cascades, list)
    for c in cascades:
        assert c["classification"] == "POSSIBLE_CONTRIBUTING_CHAIN"
        assert "chain" in c
        assert "possibleNextImpact" in c
        assert "potentialConsequence" in c
        assert "confidence" in c


# ==============================================================================
# 8. Monitoring & Alert State Lifecycle Tests
# ==============================================================================

@pytest.mark.asyncio
async def test_monitoring_alert_lifecycle():
    """Verify alert generation, retrieval, and status transitions."""
    mon = await MonitoringService.create_monitor(
        location={"latitude": 12.9716, "longitude": 77.5946, "displayName": "Silk Board Junction"},
        radius_km=10.0,
        signals=["traffic", "aqi"],
    )
    assert mon["id"].startswith("mon-")

    # Evaluate monitors
    alerts = await MonitoringService.evaluate_monitors()
    all_alerts = await MonitoringService.get_alerts(limit=50)
    assert isinstance(all_alerts, list)

    if all_alerts:
        alt_id = all_alerts[0]["id"]
        # Transition state
        updated = await MonitoringService.update_alert_state(alt_id, "ACKNOWLEDGED")
        assert updated is not None
        assert updated["state"] == "ACKNOWLEDGED"

        resolved = await MonitoringService.update_alert_state(alt_id, "RESOLVED")
        assert resolved is not None
        assert resolved["state"] == "RESOLVED"


# ==============================================================================
# 9. Location Agent Heuristics Intent Tests
# ==============================================================================

def test_location_agent_phase3_intents():
    """Verify heuristic extraction of Phase 3 user intents."""
    # Mission mode
    res = LocationAgentService._parse_intent_heuristics("I need to travel from Mysuru to Bengaluru tomorrow morning")
    assert res.intent == "MISSION_MODE"

    # Smart route
    res = LocationAgentService._parse_intent_heuristics("Which route is better to the airport?")
    assert res.intent == "SMART_ROUTE"

    # Recommend place
    res = LocationAgentService._parse_intent_heuristics("Find me a peaceful place nearby with good air quality")
    assert res.intent == "RECOMMEND_PLACE"

    # Cascade
    res = LocationAgentService._parse_intent_heuristics("Are there any cascading domino effects happening?")
    assert res.intent == "CASCADE"

    # Predict
    res = LocationAgentService._parse_intent_heuristics("What is likely to happen in Mysuru?")
    assert res.intent == "PREDICT"

    # Risk forecast
    res = LocationAgentService._parse_intent_heuristics("Show me the risk forecast for the next 24 hours")
    assert res.intent == "RISK_FORECAST"
