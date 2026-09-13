"""
Unit & Integration Tests for:
1. 7-Day Multi-Pillar Forecasting & 30-Day Monthly Outlook
2. Live Ingestion Pipeline & Haversine Deduplication
3. Location-Aware RAG Engine & Proximity Scoring
4. Location Intelligence Agent FORECAST & LIVE_UPDATES Map Actions
"""

import pytest
import pytest_asyncio
from app.services.forecast.forecasting_service import ForecastingService
from app.pipelines.live_ingestion.event_ingestion import LiveIngestionPipeline, haversine_km
from app.services.rag.rag_service import LocationAwareRAGService
from app.services.agent.location_agent import LocationAgentService


@pytest.mark.asyncio
async def test_haversine_distance():
    # Tokyo to Yokohama (~27 km)
    dist = haversine_km(35.6762, 139.6503, 35.4437, 139.6380)
    assert 20.0 < dist < 35.0


@pytest.mark.asyncio
async def test_7_day_forecast_generation():
    # Test for London (51.5074, -0.1278)
    res = await ForecastingService.get_7_day_forecast(
        51.5074, -0.1278, location_meta={"city": "London", "countryCode": "GB"}
    )
    assert res["horizon"] == "7_DAYS"
    assert "daily" in res
    assert len(res["daily"]) == 7
    for day in res["daily"]:
        assert "date" in day
        assert "tempHighC" in day
        assert "urbanConditionScore" in day
        assert 0 <= day["urbanConditionScore"] <= 100
        assert "trafficTendency" in day


@pytest.mark.asyncio
async def test_30_day_monthly_outlook():
    # Test for Sydney (-33.8688, 151.2093)
    res = await ForecastingService.get_30_day_outlook(
        -33.8688, 151.2093, location_meta={"city": "Sydney", "countryCode": "AU"}
    )
    assert res["horizon"] == "30_DAYS"
    assert "monthlyOutlook" in res
    assert "expectedRange" in res["monthlyOutlook"]
    assert len(res["monthlyOutlook"]["expectedRange"]) == 2
    assert "riskFactors" in res["monthlyOutlook"]


@pytest.mark.asyncio
async def test_live_ingestion_and_deduplication():
    # Test live ingestion around Tokyo
    events = await LiveIngestionPipeline.ingest_live_events(35.6762, 139.6503, radius_km=300.0)
    assert isinstance(events, list)
    for ev in events:
        assert "eventType" in ev
        assert "freshness" in ev
        assert ev["freshness"] in ("LIVE", "RECENT", "STALE")
        assert "severity" in ev


@pytest.mark.asyncio
async def test_location_aware_rag_retrieval():
    # Test RAG retrieval with city filter
    docs = await LocationAwareRAGService.retrieve_relevant_knowledge(
        12.9716, 77.5946, query="flood water road", city="Bengaluru", limit=3
    )
    assert len(docs) > 0
    assert any("Bengaluru" in d.get("title", "") or "Flood" in d.get("title", "") for d in docs)
    for d in docs:
        assert "authorityScore" in d
        assert "relevanceScore" in d


@pytest.mark.asyncio
async def test_agent_forecast_intent_and_map_action():
    # Test agent with 7-day forecast request for Paris
    req = {
        "query": "Give me the 7-day forecast for Paris",
        "selected_radius_km": 50.0,
    }
    res = await LocationAgentService.process_interaction(req)
    assert res["intent"] == "FORECAST"
    assert res["location"]["city"] == "Paris" or "Paris" in res["location"].get("displayName", "")
    action_types = [a["type"] for a in res["actions"]]
    assert "CENTER_MAP" in action_types
    assert "SHOW_FORECAST" in action_types
    assert res["data"].get("forecast") is not None


@pytest.mark.asyncio
async def test_agent_live_updates_intent_and_map_action():
    # Test agent with live updates request
    req = {
        "query": "Show me live updates in San Francisco",
        "selected_radius_km": 50.0,
    }
    res = await LocationAgentService.process_interaction(req)
    assert res["intent"] == "LIVE_UPDATES"
    action_types = [a["type"] for a in res["actions"]]
    assert "CENTER_MAP" in action_types
    assert "SHOW_LIVE_UPDATES" in action_types
    assert "SHOW_EVENTS_LAYER" in action_types
