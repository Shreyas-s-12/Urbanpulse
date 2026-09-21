"""
Unit and Integration Tests for UrbanPulse Dedicated RAG Intelligence Services
Validates:
- GeoRAG satellite environmental intelligence & evidence retrieval
- CrisisRAG emergency response intelligence, road/shelter readiness, and temporal categorization
- AquaRAG hybrid vector + structured sensor/time-series + geospatial retrieval
- Common prediction engine dynamic year determination (requestedYear = Y, previousYear = Y - 1)
- 4 domain-specific factor generation across all three modules
- Explicit 'INSUFFICIENT HISTORICAL DATA' when horizon is unsupported
- FastAPI endpoints for /api/v1/georag/*, /api/v1/crisisrag/*, and /api/v1/aquarag/*
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.rag_intelligence import (
    CommonPredictionEngine,
    GeoRAGService,
    CrisisRAGService,
    AquaRAGService,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_prediction_engine_dynamic_year_and_four_factors():
    """Verifies that requestedYear = 2028 dynamically sets previousYear = 2027 and yields exactly 4 domain factors."""
    lat, lon = 12.2958, 76.6394  # Mysore Palace
    target_year = 2028

    # 1. GeoRAG Prediction
    geo_pred = CommonPredictionEngine.predict("GEORAG", target_year, lat, lon, "Mysore Palace", "Mysuru")
    assert geo_pred.requestedYear == 2028
    assert geo_pred.previousYear == 2027
    assert len(geo_pred.factors) == 4
    factor_names_geo = [f.factorName for f in geo_pred.factors]
    assert "Coastal / Shoreline Change" in factor_names_geo
    assert "Environmental / Vegetation Change" in factor_names_geo
    assert "Plastic / Waste Accumulation" in factor_names_geo
    assert "Water / Coastal Condition" in factor_names_geo
    for f in geo_pred.factors:
        assert f.status == "AVAILABLE"
        assert 0.0 <= f.confidence <= 1.0
        assert f.source != ""
        assert f.historicalBasis != ""

    # 2. CrisisRAG Prediction
    crisis_pred = CommonPredictionEngine.predict("CRISISRAG", target_year, lat, lon, "Mysore Palace", "Mysuru")
    assert crisis_pred.requestedYear == 2028
    assert crisis_pred.previousYear == 2027
    assert len(crisis_pred.factors) == 4
    factor_names_crisis = [f.factorName for f in crisis_pred.factors]
    assert "Flood Risk" in factor_names_crisis
    assert "Extreme-Weather Risk" in factor_names_crisis
    assert "Infrastructure Disruption" in factor_names_crisis
    assert "Population / Exposure Risk" in factor_names_crisis

    # 3. AquaRAG Prediction
    aqua_pred = CommonPredictionEngine.predict("AQUARAG", target_year, lat, lon, "Mysore Palace", "Mysuru")
    assert aqua_pred.requestedYear == 2028
    assert aqua_pred.previousYear == 2027
    assert len(aqua_pred.factors) == 4
    factor_names_aqua = [f.factorName for f in aqua_pred.factors]
    assert "Water Quality" in factor_names_aqua
    assert "Contamination Risk" in factor_names_aqua
    assert "Groundwater Reserve" in factor_names_aqua
    assert "Ecological Condition" in factor_names_aqua


def test_prediction_engine_insufficient_historical_data_flag():
    """Verifies that an unsupported forecast horizon (e.g. 2045) returns INSUFFICIENT_HISTORICAL_DATA."""
    res = CommonPredictionEngine.predict("GEORAG", 2045, 12.9716, 77.5946, "Bengaluru", "Bengaluru")
    assert res.targetYear == 2045
    assert len(res.factors) == 4
    for f in res.factors:
        assert f.status == "INSUFFICIENT_HISTORICAL_DATA"
        assert f.confidence == 0.0


def test_georag_service_context_and_query():
    """Verifies GeoRAG satellite imagery synthesis and evidence-backed question answering."""
    ctx = GeoRAGService.get_context(12.2958, 76.6394, "Mysore Palace", "Mysuru")
    assert ctx.dataStatus == "AVAILABLE"
    assert "ndviIndex" in ctx.satelliteImagery
    assert len(ctx.environmentalReports) >= 3
    assert ctx.environmentalData["vegetationIndex"] > 0

    query_res = GeoRAGService.query("Why has vegetation changed?", 12.2958, 76.6394, "Mysore Palace", "Mysuru")
    assert query_res.module == "GEORAG"
    assert len(query_res.evidence) >= 1
    assert any(c.evidenceType in ("FACT", "INFERENCE", "HISTORICAL_CONTEXT") for c in query_res.evidence)
    assert "NDVI" in query_res.answer or "vegetation" in query_res.answer.lower()


def test_crisisrag_service_temporal_classification():
    """Verifies CrisisRAG strict temporal separation across CURRENT, RECENT, HISTORICAL, and FORECAST."""
    ctx = CrisisRAGService.get_context(12.2958, 76.6394, "Mysore Palace", "Mysuru")
    assert "CURRENT" in ctx.categorizedEvents
    assert "RECENT" in ctx.categorizedEvents
    assert "HISTORICAL" in ctx.categorizedEvents
    assert "FORECAST" in ctx.categorizedEvents
    assert len(ctx.roadShelterInfo["openCorridors"]) >= 1
    assert len(ctx.roadShelterInfo["designatedShelters"]) >= 1

    # Verify query distinguishing historical flooding from current status
    query_res = CrisisRAGService.query("What areas have historically flooded?", 12.2958, 76.6394, "Mysore Palace", "Mysuru")
    assert query_res.module == "CRISISRAG"
    assert "HISTORICAL" in query_res.temporalClassification
    assert len(query_res.evidence) >= 1


def test_aquarag_hybrid_retrieval_and_sensors():
    """Verifies AquaRAG hybrid physical sensor telemetry + regulatory document retrieval."""
    ctx = AquaRAGService.get_context(12.2958, 76.6394, "Mysore Palace", "Mysuru")
    assert "turbidityNtu" in ctx.sensorStatus
    assert "dissolvedOxygenMgL" in ctx.sensorStatus
    assert "ph" in ctx.sensorStatus
    assert len(ctx.historicalTrends) == 5
    # Verify at least one physical sensor FACT citation
    fact_citations = [c for c in ctx.evidence if c.evidenceType == "FACT"]
    assert len(fact_citations) >= 1

    query_res = AquaRAGService.query("Why did water quality deteriorate?", 12.2958, 76.6394, "Mysore Palace", "Mysuru")
    assert query_res.module == "AQUARAG"
    assert len(query_res.evidence) >= 1


def test_fastapi_endpoints_live(client):
    """Verifies all GeoRAG, CrisisRAG, and AquaRAG endpoints respond with HTTP 200 and typed schemas."""
    # GeoRAG
    geo_ctx = client.get("/api/v1/georag/context?latitude=12.2958&longitude=76.6394&cityName=Mysuru")
    assert geo_ctx.status_code == 200
    assert "satelliteImagery" in geo_ctx.json()

    geo_query = client.post(
        "/api/v1/georag/query",
        json={"query": "What environmental changes occurred here?", "latitude": 12.2958, "longitude": 76.6394, "cityName": "Mysuru"},
    )
    assert geo_query.status_code == 200
    assert geo_query.json()["module"] == "GEORAG"

    geo_pred = client.post(
        "/api/v1/georag/predict",
        json={"targetYear": 2028, "latitude": 12.2958, "longitude": 76.6394, "cityName": "Mysuru"},
    )
    assert geo_pred.status_code == 200
    assert geo_pred.json()["requestedYear"] == 2028
    assert len(geo_pred.json()["factors"]) == 4

    # CrisisRAG
    crisis_ctx = client.get("/api/v1/crisisrag/context?latitude=12.2958&longitude=76.6394&cityName=Mysuru")
    assert crisis_ctx.status_code == 200
    assert "roadShelterInfo" in crisis_ctx.json()

    crisis_pred = client.post(
        "/api/v1/crisisrag/predict",
        json={"targetYear": 2028, "latitude": 12.2958, "longitude": 76.6394, "cityName": "Mysuru"},
    )
    assert crisis_pred.status_code == 200
    assert crisis_pred.json()["requestedYear"] == 2028

    # AquaRAG
    aqua_ctx = client.get("/api/v1/aquarag/context?latitude=12.2958&longitude=76.6394&cityName=Mysuru")
    assert aqua_ctx.status_code == 200
    assert "sensorStatus" in aqua_ctx.json()

    aqua_pred = client.post(
        "/api/v1/aquarag/predict",
        json={"targetYear": 2028, "latitude": 12.2958, "longitude": 76.6394, "cityName": "Mysuru"},
    )
    assert aqua_pred.status_code == 200
    assert aqua_pred.json()["requestedYear"] == 2028
