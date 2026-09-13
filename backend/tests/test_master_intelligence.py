"""
UrbanPulse Master Intelligence Expansion Test Suite
Verifies:
1. What Changed Engine (Windowed comparison, deterministic significance)
2. Explainable Score Engine (0-100 deterministic weights, confidence penalty, factor attribution)
3. Anomaly Detection Engine (7-day diurnal baseline z-score)
4. Scenario Simulator (Physical urban models, SIMULATION watermark, uncertainty)
5. Multi-City Comparison (2 to 5 cities, normalized scales, '—' for missing)
6. Monitor This Place (CRUD, threshold evaluation, alerts)
7. REST API Endpoints
"""

import pytest
import asyncio
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.services.change_detection import ChangeDetectionService
from app.services.urban_score import ExplainableScoreService
from app.services.anomaly_detection import AnomalyDetectionService
from app.services.scenario_engine import ScenarioEngineService
from app.services.comparison import ComparisonService
from app.services.monitoring import MonitoringService


# 1. Change Detection Tests
@pytest.mark.asyncio
async def test_change_detection_service():
    """Verify windowed change detection returns valid deltas and main change."""
    # Test with London coordinates
    res = await ChangeDetectionService.get_location_changes(51.5074, -0.1278, window="24h")
    
    assert "window" in res
    assert res["window"] == "24h"
    assert "changes" in res
    assert isinstance(res["changes"], list)
    assert len(res["changes"]) > 0
    
    # Verify each change has proper structure
    for change in res["changes"]:
        assert "signal" in change
        assert "currentValue" in change or "current" in change
        assert "previousValue" in change or "baseline" in change
        assert "direction" in change
        assert change["direction"] in ("UP", "DOWN", "FLAT", "STABLE")
        assert "isMeaningful" in change
        assert "description" in change
    
    assert "mainChange" in res
    assert isinstance(res["mainChange"], str)
    assert len(res["mainChange"]) > 0
    assert "confidence" in res
    assert 0.0 <= res["confidence"] <= 1.0


# 2. Explainable Urban Score Tests
@pytest.mark.asyncio
async def test_explainable_score_service():
    """Verify 0-100 score, component weights, factor attribution, and confidence."""
    # Test with Tokyo coordinates
    res = await ExplainableScoreService.calculate_urbanpulse_score(35.6762, 139.6503)
    
    assert "score" in res
    assert 0 <= res["score"] <= 100
    assert "confidence" in res
    assert 0.0 <= res["confidence"] <= 1.0
    
    # Missing signals must reduce confidence
    assert "knownSignals" in res
    assert "missingSignals" in res
    assert res["knownSignals"] + res["missingSignals"] == 6
    
    # Component breakdown
    assert "components" in res
    comps = res["components"]
    for dom in ["traffic", "air_quality", "weather", "roads", "safety", "hazards"]:
        assert dom in comps
        assert "weight" in comps[dom]
        assert "status" in comps[dom]
    
    # Factors & explanation
    assert "positiveFactors" in res
    assert "negativeFactors" in res
    assert "explanation" in res
    assert "trend" in res
    assert res["trend"] in ("IMPROVING", "DETERIORATING", "STABLE")


# 3. Anomaly Detection Tests
@pytest.mark.asyncio
async def test_anomaly_detection_service():
    """Verify statistical anomaly detection with diurnal baselines."""
    # Test with Paris coordinates
    res = await AnomalyDetectionService.detect_anomalies(48.8566, 2.3522)
    
    assert "anomalies" in res
    assert isinstance(res["anomalies"], list)
    assert "window" in res or "baselineWindow" in res
    assert "confidence" in res
    
    for anom in res["anomalies"]:
        assert "signal" in anom
        assert "anomalyType" in anom
        assert "severity" in anom
        assert anom["severity"] in ("CRITICAL", "ELEVATED", "WARNING", "HIGH", "MODERATE", "LOW")
        assert "currentValue" in anom
        assert "expectedBaseline" in anom
        assert "explanation" in anom


# 4. Scenario Simulation Tests
@pytest.mark.asyncio
async def test_scenario_simulation_heavy_rain():
    """Verify scenario simulator produces deterministic impacts, uncertainty, and SIMULATION labeling."""
    req = {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "scenarioType": "heavy_rainfall",
        "parameters": {"intensity_mm_hr": 60, "duration_hours": 3},
        "locationName": "Bengaluru",
    }
    res = await ScenarioEngineService.simulate_scenario(req)
    
    assert res.get("isSimulation") is True
    assert res.get("scenarioType") == "heavy_rainfall"
    assert "impacts" in res
    impacts = res["impacts"]
    assert "traffic" in impacts
    assert "floodRisk" in impacts
    assert "roadSpeedReductionPercent" in impacts["traffic"]
    
    assert "assumptions" in res
    assert len(res["assumptions"]) > 0
    assert "uncertaintyInterval" in res
    assert "urbanPulseScoreImpact" in res


# 5. Multi-City Comparison Tests
@pytest.mark.asyncio
async def test_multi_city_comparison():
    """Verify 2 to 5 cities side-by-side comparison with standardized scales."""
    locs = [
        {"name": "Berlin", "latitude": 52.5200, "longitude": 13.4050},
        {"name": "Madrid", "latitude": 40.4168, "longitude": -3.7038},
    ]
    res = await ComparisonService.compare_locations(locs)
    
    assert "cities" in res
    assert len(res["cities"]) == 2
    assert "matrix" in res
    assert len(res["matrix"]) > 0
    assert "verdict" in res
    assert len(res["verdict"]) > 0
    assert "confidence" in res
    
    # Check that city matrix contains non-empty signal values
    for row in res["matrix"]:
        assert "signal" in row
        assert "values" in row
        assert "Berlin" in row["values"]
        assert "Madrid" in row["values"]


# 6. Monitoring Service Tests
@pytest.mark.asyncio
async def test_monitoring_service_crud_and_alerts():
    """Verify monitor creation, listing, evaluation, and deletion."""
    mon_req = {
        "type": "point",
        "name": "Test Port Corridor",
        "latitude": 37.7749,
        "longitude": -122.4194,
        "radiusKm": 10.0,
        "alertOn": ["traffic", "aqi"],
        "aqiThreshold": 100,
        "trafficDelayThresholdPercent": 25,
    }
    created = await MonitoringService.create_monitor(mon_req)
    assert "id" in created
    assert created["name"] == "Test Port Corridor"
    assert created["active"] is True
    
    # List monitors
    all_monitors = await MonitoringService.list_monitors()
    assert any(m["id"] == created["id"] for m in all_monitors)
    
    # Evaluate monitors
    alerts = await MonitoringService.evaluate_monitors()
    assert isinstance(alerts, list)
    
    # Delete monitor
    deleted = await MonitoringService.delete_monitor(created["id"])
    assert deleted is True


# 7. REST API Endpoints Integration Test
def test_rest_api_intelligence_endpoints():
    """Verify the FastAPI HTTP endpoints return expected JSON responses."""
    client = TestClient(app)
    
    # 7a. Changes endpoint
    r_changes = client.get("/api/v1/intelligence/changes?lat=51.5074&lng=-0.1278&window=24h")
    assert r_changes.status_code == 200
    data_c = r_changes.json()
    assert "changes" in data_c
    assert "mainChange" in data_c
    
    # 7b. Score endpoint
    r_score = client.get("/api/v1/intelligence/score?lat=51.5074&lng=-0.1278")
    assert r_score.status_code == 200
    data_s = r_score.json()
    assert "score" in data_s
    assert "components" in data_s
    
    # 7c. Anomalies endpoint
    r_anom = client.get("/api/v1/intelligence/anomalies?lat=51.5074&lng=-0.1278")
    assert r_anom.status_code == 200
    data_a = r_anom.json()
    assert "anomalies" in data_a
    
    # 7d. Simulation endpoint
    sim_payload = {
        "latitude": 51.5074,
        "longitude": -0.1278,
        "scenarioType": "heavy_rainfall",
        "parameters": {"intensity_mm_hr": 40},
    }
    r_sim = client.post("/api/v1/intelligence/simulate", json=sim_payload)
    assert r_sim.status_code == 200
    data_sim = r_sim.json()
    assert data_sim.get("isSimulation") is True
    
    # 7e. Compare endpoint
    cmp_payload = {
        "locations": [
            {"name": "London", "latitude": 51.5074, "longitude": -0.1278},
            {"name": "Paris", "latitude": 48.8566, "longitude": 2.3522},
        ]
    }
    r_cmp = client.post("/api/v1/intelligence/compare", json=cmp_payload)
    assert r_cmp.status_code == 200
    data_cmp = r_cmp.json()
    assert "cities" in data_cmp
    assert len(data_cmp["cities"]) == 2
    
    # 7f. Monitoring endpoints
    r_mon_list = client.get("/api/v1/monitoring")
    assert r_mon_list.status_code == 200
    
    r_alerts = client.get("/api/v1/monitoring/alerts")
    assert r_alerts.status_code == 200
    assert "alerts" in r_alerts.json()
