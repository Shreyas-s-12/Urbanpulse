"""
Unit and Integration Tests for UrbanPulse Research Intelligence Layer
Validates:
- Observation normalization and source trust tiers (Sections 3, 4)
- Deterministic confidence engine and explanation decomposition (Sections 5, 6, 20)
- Uncertainty propagation across fusion pipeline (Section 66)
- Adaptive multi-resolution planner & source constraints (Sections 7, 8, 9, 64)
- Multimodal spatial fusion & non-causal anomaly associations (Sections 10–16, 43, 91)
- Explainability & evidence chain resolution ("Ask Why" engine) (Sections 21–23, 48)
- Scenario simulation with uncertainty bounds & decision support (Sections 38–40)
- Empirical ablation experiment records & RQ1–RQ5 (Sections 57, 58, 69)
- FastAPI /api/v1/intelligence/* endpoints (Section 72)
"""

import pytest
from app.services.research.observation_normalizer import ObservationNormalizer
from app.services.research.confidence_engine import ConfidenceEngine
from app.services.research.adaptive_resolution_engine import AdaptiveResolutionEngine
from app.services.research.multimodal_fusion import MultimodalFusionEngine
from app.services.research.explainability_engine import ExplainabilityEngine
from app.services.research.scenario_simulation import ScenarioSimulationEngine
from app.services.research.evaluation_framework import EvaluationFramework


def test_observation_normalization_and_trust_tiers():
    """Verifies that raw provider observations normalize into canonical NormalizedObservation records with trust tiers."""
    lat, lon = 12.9716, 77.5946

    # 1. AQI Normalization
    raw_aqi = {
        "value": 115.0,
        "pm2_5": 42.0,
        "pm10": 88.0,
        "status": "AVAILABLE",
        "category": "UNHEALTHY FOR SENSITIVE GROUPS",
        "timestamp": "2026-09-19T08:00:00Z",
    }
    norm_aqi = ObservationNormalizer.normalize_aqi(raw_aqi, lat, lon)
    assert norm_aqi.metric == "AQI"
    assert norm_aqi.sourceTier == "TIER_1_OFFICIAL"
    assert norm_aqi.sourceType == "MODEL_FORECAST"
    assert norm_aqi.value == 115.0
    assert 0.0 <= norm_aqi.normalizedValue <= 1.0
    assert norm_aqi.geometry["type"] in ("Point", "Polygon")
    assert "pm2_5" in norm_aqi.metadata

    # 2. Traffic Normalization
    raw_traffic = {
        "currentSpeedKmh": 28.0,
        "freeFlowSpeedKmh": 55.0,
        "delayMinutes": 14.0,
        "status": "AVAILABLE",
        "metadata": {"roadName": "Outer Ring Road"},
    }
    norm_traffic = ObservationNormalizer.normalize_traffic(raw_traffic, lat, lon)
    assert norm_traffic.metric == "TRAFFIC"
    assert norm_traffic.sourceTier == "TIER_1_OFFICIAL"
    assert norm_traffic.value == 28.0
    assert norm_traffic.rawValue == 14.0
    assert norm_traffic.metadata["roadName"] == "Outer Ring Road"

    # 3. Population Normalization
    raw_pop = {"density": 11800.0, "count": 18500.0, "status": "AVAILABLE"}
    norm_pop = ObservationNormalizer.normalize_population(raw_pop, lat, lon)
    assert norm_pop.metric == "POPULATION"
    assert norm_pop.value == 11800.0
    assert norm_pop.metadata["exposureRole"] == "EXPOSURE"
    assert "datasetYear" in norm_pop.metadata


def test_deterministic_confidence_engine_breakdown():
    """Verifies deterministic confidence score formula and explainable breakdown decomposition."""
    # Test Tier 1, fresh, high coverage
    breakdown = ConfidenceEngine.compute_observation_confidence(
        source_tier="TIER_1_OFFICIAL",
        freshness_minutes=10.0,
        spatial_resolution_km=10.0,
        target_scope="CITY",
        coverage_fraction=0.95,
    )
    assert 0.85 <= breakdown.overallConfidence <= 0.99
    assert breakdown.sourceQualityLabel == "HIGH"
    assert breakdown.freshnessLabel == "LIVE"
    assert "Coverage (95.0%)" in breakdown.explanation
    assert breakdown.missingnessPenalty == 0.0

    # Test Stale observation decay
    stale_breakdown = ConfidenceEngine.compute_observation_confidence(
        source_tier="TIER_2_REPUTABLE_MODEL",
        freshness_minutes=300.0,
        spatial_resolution_km=25.0,
        target_scope="PLACE",
        coverage_fraction=0.60,
    )
    assert stale_breakdown.freshnessLabel == "STALE"
    assert stale_breakdown.overallConfidence < breakdown.overallConfidence


def test_uncertainty_propagation_and_missingness():
    """Verifies uncertainty propagation across multimodal synthesis and penalties for missing domains."""
    # Fused across 4 domains
    confidences = {"environment": 0.92, "mobility": 0.88, "weather": 0.94, "population": 0.95}
    fused_conf = ConfidenceEngine.propagate_fusion_uncertainty(
        domain_confidences=confidences,
        missing_domains_count=1,
        total_domains_count=5,
    )
    assert 0.70 <= fused_conf.overallConfidence <= 0.95
    assert fused_conf.missingnessPenalty > 0.0
    assert "Missing domain penalty" in fused_conf.explanation

    # All domains missing
    empty_fused = ConfidenceEngine.propagate_fusion_uncertainty({}, 5, 5)
    assert empty_fused.overallConfidence == 0.0
    assert empty_fused.sourceQualityLabel == "LOW"


def test_adaptive_multi_resolution_constraints():
    """Verifies adaptive resolution binds to provider native resolution and tracks trade-offs."""
    # Requesting LOCAL 0.8km for AQI (native is 10km) -> must constrain to 10km native to avoid false precision
    plan_aqi = AdaptiveResolutionEngine.plan_resolution("PLACE", 15, "AQI")
    assert plan_aqi["isSourceConstrained"] is True
    assert plan_aqi["actualResolutionKm"] == 10.0
    assert "exceeds AQI provider native resolution" in plan_aqi["reasonChosen"]

    # Requesting WORLD for Weather -> unconstrained coarse resolution
    plan_world = AdaptiveResolutionEngine.plan_resolution("WORLD", 3, "WEATHER")
    assert plan_world["isSourceConstrained"] is False
    assert plan_world["actualResolutionKm"] >= 100.0
    assert plan_world["gridDimension"]["rows"] > 0

    # Test Multi-Scale Quality Evaluation
    eval_quality = AdaptiveResolutionEngine.evaluate_multi_scale_quality([], "TRAFFIC", "CITY")
    assert "researchQuestion" in eval_quality
    assert len(eval_quality["resolutionTradeoffs"]) == 5


def test_multimodal_spatial_fusion_and_non_causal_anomalies():
    """Verifies multimodal fusion, decomposable score, and strict non-causal association semantics."""
    lat, lon = 12.9716, 77.5946

    aqi_mock = {"value": 140.0, "status": "AVAILABLE"}
    weather_mock = {"temperatureC": 26.0, "precipitationMm": 14.5, "status": "AVAILABLE"}
    traffic_mock = {"currentSpeedKmh": 22.0, "delayMinutes": 18.0, "status": "AVAILABLE"}
    pop_mock = {"density": 11500.0, "status": "AVAILABLE"}
    incidents_mock = [{"id": "ev-1", "title": "Waterlogging", "severity": 70.0, "eventType": "FLOOD"}]

    state = MultimodalFusionEngine.fuse_urban_state(
        lat=lat,
        lon=lon,
        aqi_obs=aqi_mock,
        weather_obs=weather_mock,
        traffic_obs=traffic_mock,
        pop_obs=pop_mock,
        incidents=incidents_mock,
        city_name="Bengaluru",
    )

    assert state.location["label"] == "Bengaluru"
    assert "environment" in state.components
    assert "mobility" in state.components
    assert "weather" in state.components
    assert "population" in state.components
    assert "civic" in state.components

    # Check Decomposable Score
    score = state.overallScore
    assert score.score is not None
    assert score.baseScore == 100
    assert "traffic" in score.contributors
    assert "aqi" in score.contributors
    assert "dataConfidenceAdjustment" in score.contributors
    assert score.formula.startswith("Score = Base (100)")

    # Check Anomaly and Non-Causal Semantics (Section 11, 16, 91)
    assert len(state.activeAnomalies) > 0
    anom = state.activeAnomalies[0]
    assert anom.associationType in ("TEMPORAL_ASSOCIATION", "CORRELATED_ANOMALY", "SPATIAL_ALIGNMENT")
    assert any("non-causal" in ev.lower() for ev in anom.evidence)
    assert anom.evidenceChain is not None
    assert anom.evidenceChain.claim is not None


def test_pearson_spatial_correlation():
    """Verifies Pearson correlation and small sample size guard."""
    # Valid positive correlation
    res_pos = MultimodalFusionEngine.calculate_pearson_correlation([10, 20, 30, 40, 50], [12, 22, 35, 38, 48])
    assert res_pos["coefficient"] is not None
    assert res_pos["coefficient"] > 0.90
    assert res_pos["relationshipLabel"] == "POSSIBLE_ASSOCIATION"

    # Tiny sample size guard (N < 4)
    res_tiny = MultimodalFusionEngine.calculate_pearson_correlation([10, 20], [15, 25])
    assert res_tiny["coefficient"] is None
    assert "Sample size too small" in res_tiny["warning"]


def test_explainability_engine_ask_why():
    """Verifies all 4 'Ask Why' queries: WHY_THIS_AREA, WHY_THIS_VALUE, WHY_THIS_ANOMALY, WHY_THIS_SCORE."""
    lat, lon = 12.9716, 77.5946
    state = MultimodalFusionEngine.fuse_urban_state(
        lat=lat,
        lon=lon,
        aqi_obs={"value": 120.0, "status": "AVAILABLE"},
        weather_obs={"temperatureC": 25.0, "precipitationMm": 5.0, "status": "AVAILABLE"},
        traffic_obs={"currentSpeedKmh": 30.0, "delayMinutes": 15.0, "status": "AVAILABLE"},
        pop_obs={"density": 9000.0, "status": "AVAILABLE"},
        incidents=[],
        city_name="Bengaluru",
    )

    # 1. WHY_THIS_AREA
    exp_area = ExplainabilityEngine.explain_why_this_area(state)
    assert exp_area["query"] == "WHY_THIS_AREA"
    assert "evidenceChain" in exp_area
    assert "activeConcerns" in exp_area

    # 2. WHY_THIS_VALUE
    exp_val = ExplainabilityEngine.explain_why_this_value(
        "AQI", 120.0, "Open-Meteo CAMS", state.confidenceSummary.model_dump()
    )
    assert exp_val["query"] == "WHY_THIS_VALUE"
    assert exp_val["value"] == 120.0
    assert "evidenceChain" in exp_val

    # 3. WHY_THIS_ANOMALY
    exp_anom = ExplainabilityEngine.explain_why_this_anomaly("anom-fake-id", state)
    assert exp_anom["query"] == "WHY_THIS_ANOMALY"
    assert "nonCausalNotice" in exp_anom

    # 4. WHY_THIS_SCORE
    exp_score = ExplainabilityEngine.explain_why_this_score(state)
    assert exp_score["query"] == "WHY_THIS_SCORE"
    assert "formula" in exp_score
    assert "contributors" in exp_score


def test_scenario_simulation_with_uncertainty():
    """Verifies Scenario Simulation produces bounded uncertainty and actionable decision support options."""
    lat, lon = 12.9716, 77.5946
    state = MultimodalFusionEngine.fuse_urban_state(
        lat=lat,
        lon=lon,
        aqi_obs={"value": 80.0, "status": "AVAILABLE"},
        weather_obs={"temperatureC": 24.0, "precipitationMm": 2.0, "status": "AVAILABLE"},
        traffic_obs={"currentSpeedKmh": 45.0, "delayMinutes": 3.0, "status": "AVAILABLE"},
        pop_obs={"density": 8000.0, "status": "AVAILABLE"},
        incidents=[],
        city_name="Bengaluru",
    )

    sim = ScenarioSimulationEngine.run_simulation(state, "PRECIPITATION_SURGE", 40.0)
    assert sim.label == "SIMULATION"
    assert "Precipitation" in sim.title
    assert "uncertaintyRange" in sim.model_dump()
    assert len(sim.uncertaintyRange["projectedSpeedKmh"]) == 2
    assert sim.uncertaintyRange["projectedSpeedKmh"][0] < sim.uncertaintyRange["projectedSpeedKmh"][1]
    assert len(sim.decisionOptions) >= 2
    assert "priority" in sim.decisionOptions[0]
    assert "action" in sim.decisionOptions[0]


def test_ablation_framework_and_research_questions():
    """Verifies empirical ablation comparing Model A, Model B, and Model C."""
    res = EvaluationFramework.run_ablation_experiment("Bengaluru", "7D")
    assert "models" in res
    assert "modelA" in res["models"]
    assert "modelB" in res["models"]
    assert "modelC" in res["models"]

    mA = res["models"]["modelA"]["metrics"]
    mB = res["models"]["modelB"]["metrics"]
    mC = res["models"]["modelC"]["metrics"]

    # Empirical validation: Multimodal improves F1 over single-domain
    assert mB["f1"] > mA["f1"]
    # Confidence weighting further improves precision
    assert mC["precision"] > mB["precision"]
    assert "reproducibilityHash" in res["models"]["modelC"]

    # Verify RQ1-RQ5 answers
    rqs = EvaluationFramework.evaluate_research_questions()
    assert len(rqs["researchQuestions"]) == 5
    assert all(rq["status"] == "VALIDATED" for rq in rqs["researchQuestions"])
    assert len(rqs["benchmarkGeographies"]) == 7


@pytest.mark.asyncio
async def test_intelligence_research_endpoints():
    """Verifies FastAPI endpoints for research intelligence."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. /intelligence/confidence
        resp_conf = await client.get("/api/v1/intelligence/confidence?metric=AQI&source_tier=TIER_1_OFFICIAL&freshness_minutes=12&target_scope=CITY")
        assert resp_conf.status_code == 200
        data_conf = resp_conf.json()
        assert "overallConfidence" in data_conf
        assert data_conf["sourceQualityLabel"] == "HIGH"

        # 2. /intelligence/evaluation
        resp_eval = await client.get("/api/v1/intelligence/evaluation?geography=Bengaluru&time_window=7D")
        assert resp_eval.status_code == 200
        data_eval = resp_eval.json()
        assert "ablation" in data_eval
        assert "researchQuestions" in data_eval

        # 3. /intelligence/coverage
        resp_cov = await client.get("/api/v1/intelligence/coverage?lat=12.9716&lon=77.5946&scope=CITY")
        assert resp_cov.status_code == 200
        data_cov = resp_cov.json()
        assert "domains" in data_cov
        assert "missingnessPolicy" in data_cov

        # 4. /intelligence/provenance
        resp_prov = await client.get("/api/v1/intelligence/provenance?lat=12.9716&lon=77.5946")
        assert resp_prov.status_code == 200
        data_prov = resp_prov.json()
        assert "dataSources" in data_prov
        assert "nonCausalDeclaration" in data_prov
