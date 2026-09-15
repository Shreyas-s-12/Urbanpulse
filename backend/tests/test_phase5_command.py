"""
UrbanPulse Phase 5 Command Center & Intelligence Engine Test Suite
Verifies:
1. Command Center Overview (Top-level Urban Status, Confidence, Situation Awareness)
2. Unified Intelligence Endpoint (/api/v1/urban-intelligence)
3. Cross-Domain Intelligence Graph (Nodes, Edges, OBSERVED vs INFERRED tags)
4. Incident Command Mode & Spatial Impact Analysis (Area km², roads, POIs, lifecycle transition)
5. City Health Dashboard & Urban Resilience Score (8 operational domains)
6. Decision Support & Recommendation Engine (Actionable options, trade-offs)
7. Advanced Comparison & Time Travel (Multi-entity comparison, "Why?" attribution)
8. Provider Health, Data Quality, Observability, and Lineage Trace
9. Intelligence Replay (Historical timelines, strict watermarks)
10. Executive & Technical Intelligence Reports
11. Mission Adaptation on Disruption
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_command_center_overview():
    """Verify master operational overview and top-level Urban Status."""
    res = client.get("/api/v1/command-center/overview?lat=51.5074&lng=-0.1278&city=London")
    assert res.status_code == 200
    data = res.json()
    assert "urbanStatus" in data
    status = data["urbanStatus"]
    assert "traffic" in status
    assert "weather" in status
    assert "overallConfidence" in status
    assert 0.0 <= status["overallConfidence"] <= 1.0
    assert "situationAwareness" in data
    assert isinstance(data["situationAwareness"], list)


def test_unified_intelligence():
    """Verify unified intelligence endpoint aggregating multi-subsystem telemetry."""
    res = client.get("/api/v1/urban-intelligence?lat=51.5074&lng=-0.1278&city=London&time_window=24h")
    assert res.status_code == 200
    data = res.json()
    assert "location" in data
    assert "urbanStatus" in data
    assert "situation" in data
    assert "changes" in data
    assert "riskRadar" in data
    assert "confidence" in data


def test_cross_domain_intelligence_graph():
    """Verify cross-domain graph nodes and strict OBSERVED vs INFERRED relationship labeling."""
    res = client.get("/api/v1/command-center/graph?lat=12.9716&lng=77.5946&city=Bengaluru")
    assert res.status_code == 200
    data = res.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) > 0
    # Verify node structure
    for node in data["nodes"]:
        assert "id" in node
        assert "type" in node
        assert node["type"] in ("EVENT", "LOCATION", "ROAD", "WEATHER", "TRAFFIC", "RISK", "ALERT", "FORECAST", "POI", "INFRASTRUCTURE", "NEWS", "SAFETY", "ENVIRONMENT")
        assert "label" in node
        assert "confidence" in node
    # Verify edge structure and nature tags
    for edge in data["edges"]:
        assert "source" in edge
        assert "target" in edge
        assert "relationship" in edge
        assert "nature" in edge
        assert edge["nature"] in ("OBSERVED", "INFERRED")


def test_incident_command_and_impact_analysis():
    """Verify incident command dossier, spatial area calculation, dependencies, and state transition."""
    # 1. Fetch incident dossier
    res = client.get("/api/v1/command-center/incident/inc-test-99?lat=12.9716&lng=77.5946&radius_km=3.0&event_type=FLOOD&title=Waterlogging")
    assert res.status_code == 200
    data = res.json()
    assert data["incidentId"] == "inc-test-99"
    assert "spatialImpact" in data
    impact = data["spatialImpact"]
    assert "affectedAreaSqKm" in impact
    assert impact["affectedAreaSqKm"] > 0.0
    assert "affectedRoadsCount" in impact
    assert "infrastructureDependencies" in data
    assert len(data["infrastructureDependencies"]) > 0
    assert "cascadeChain" in data
    for step in data["cascadeChain"]:
        assert step["stage"] in ("OBSERVED", "INFERRED", "FORECAST")

    # 2. Transition lifecycle state
    patch_res = client.post(
        "/api/v1/command-center/incident/inc-test-99/state",
        json={"new_state": "ESCALATING", "evidence_note": "Field report escalation verified"},
    )
    assert patch_res.status_code == 200
    patch_data = patch_res.json()
    assert patch_data["state"] == "ESCALATING"


def test_city_health_and_resilience_score():
    """Verify 8-domain urban system health and resilience scoring."""
    res = client.get("/api/v1/command-center/city-health?lat=35.6762&lng=139.6503&city=Tokyo")
    assert res.status_code == 200
    data = res.json()
    assert "overallStatus" in data
    assert data["overallStatus"] in ("HEALTHY", "STABLE", "WATCH", "AT_RISK", "UNKNOWN")
    assert "resilienceScore" in data
    assert 0.0 <= data["resilienceScore"] <= 100.0
    assert "domains" in data
    assert len(data["domains"]) == 8
    domain_names = [d["domain"] for d in data["domains"]]
    for expected in ["Mobility", "Environment", "Safety", "Infrastructure", "Weather Resilience", "Hazard Exposure", "Urban Activity", "Data Reliability"]:
        assert expected in domain_names


def test_decision_support_engine():
    """Verify trade-off evaluated decision options."""
    req = {
        "latitude": 51.5074,
        "longitude": -0.1278,
        "radius_km": 25.0,
        "objective": "reach_airport_on_time",
        "constraints": ["avoid_flooded_underpass"],
        "city_name": "London",
    }
    res = client.post("/api/v1/command-center/decision-support", json=req)
    assert res.status_code == 200
    data = res.json()
    assert "options" in data
    assert len(data["options"]) > 0
    for opt in data["options"]:
        assert "optionId" in opt
        assert "title" in opt
        assert "benefits" in opt
        assert "tradeOffs" in opt
        assert "confidence" in opt


def test_advanced_comparison_and_attribution():
    """Verify multi-city comparison and deterministic 'Why?' explanation."""
    req = {
        "queries": [
            {"name": "London", "geographyType": "CITY"},
            {"name": "Paris", "geographyType": "CITY"},
        ],
        "time_window": "NOW",
    }
    res = client.post("/api/v1/command-center/compare", json=req)
    assert res.status_code == 200
    data = res.json()
    assert "entities" in data
    assert len(data["entities"]) == 2
    assert "comparisonMatrix" in data
    assert "explanation" in data
    exp = data["explanation"]
    assert "leader" in exp
    assert "scoreMargin" in exp
    assert "primaryFactors" in exp
    assert "verdict" in exp


def test_provider_health_and_data_quality():
    """Verify provider health, data quality center, and observability metrics."""
    # Providers
    r_prov = client.get("/api/v1/command-center/providers")
    assert r_prov.status_code == 200
    assert "providers" in r_prov.json()

    # Observability
    r_obs = client.get("/api/v1/command-center/observability")
    assert r_obs.status_code == 200
    assert "telemetry" in r_obs.json()

    # Data Quality
    r_qual = client.get("/api/v1/command-center/data-quality?lat=51.5074&lng=-0.1278")
    assert r_qual.status_code == 200
    data_q = r_qual.json()
    assert "compositeCoveragePercent" in data_q
    assert "domains" in data_q


def test_intelligence_replay_timeline():
    """Verify historical replay scrubbing and watermark labeling."""
    res = client.get("/api/v1/command-center/replay?lat=51.5074&lng=-0.1278&window=24H&steps=6")
    assert res.status_code == 200
    data = res.json()
    assert "timeline" in data
    assert len(data["timeline"]) == 6
    for frame in data["timeline"]:
        assert "watermark" in frame
        assert frame["watermark"] in ("HISTORICAL", "CURRENT", "FORECAST", "SIMULATION")
        assert "conditions" in frame


def test_report_generation():
    """Verify executive and technical report generation."""
    req = {
        "latitude": 51.5074,
        "longitude": -0.1278,
        "city_name": "London",
        "report_mode": "EXECUTIVE",
    }
    res = client.post("/api/v1/command-center/report", json=req)
    assert res.status_code == 200
    data = res.json()
    assert "reportId" in data
    assert "executiveSummary" in data
    assert "recommendations" in data


def test_mission_adaptation():
    """Verify mission reassessment and alternative route generation upon disruption."""
    req = {
        "origin": {"latitude": 12.3051, "longitude": 76.6551},
        "destination": {"latitude": 12.9716, "longitude": 77.5946},
    }
    res = client.post("/api/v1/command-center/mission-adapt", json=req)
    assert res.status_code == 200
    data = res.json()
    assert data["missionStatus"] == "AT_RISK"
    assert "adaptedAlternative" in data
    alt = data["adaptedAlternative"]
    assert "additionalDurationMinutes" in alt
    assert "confidence" in alt
