"""
Automated unit and integration tests for:
1. Google Traffic multi-corridor telemetry and delay calculation
2. Truthful handling of unavailable traffic (no fake delays, no fabricated data)
3. Civil Safety stream separation (official police feeds vs alerts vs recent bulletins vs stable guidance)
4. RAG knowledge partitioning (STABLE_KNOWLEDGE vs RECENT_UPDATE)
"""

import pytest
import asyncio
from unittest.mock import patch, AsyncMock, MagicMock
import httpx

from app.services.google_traffic import GoogleTrafficService, parse_duration_seconds
from app.services.providers.civil_safety_registry import CivilSafetyRegistry
from app.services.rag.rag_service import LocationAwareRAGService
from app.services.urban_intel import UrbanIntelService


def test_parse_duration_seconds():
    assert parse_duration_seconds("600s") == 600
    assert parse_duration_seconds("125.5s") == 125
    assert parse_duration_seconds(None) == 0
    assert parse_duration_seconds("") == 0
    assert parse_duration_seconds("invalid") == 0


@pytest.mark.asyncio
async def test_google_traffic_delay_calculation_and_intervals():
    """
    Verifies that Google Traffic calculates delay strictly as duration - staticDuration,
    extracts speed reading intervals, and correctly maps severity levels.
    """
    fake_response = {
        "routes": [
            {
                "duration": "1200s",
                "staticDuration": "900s",
                "distanceMeters": 14000,
                "description": "Outer Ring Road Express",
                "travelAdvisory": {
                    "speedReadingIntervals": [
                        {"startPolylinePointIndex": 0, "endPolylinePointIndex": 10, "speed": "NORMAL"},
                        {"startPolylinePointIndex": 11, "endPolylinePointIndex": 20, "speed": "SLOW"},
                        {"startPolylinePointIndex": 21, "endPolylinePointIndex": 30, "speed": "TRAFFIC_JAM"},
                    ]
                },
            }
        ]
    }

    mock_client = AsyncMock()
    mock_post_res = MagicMock()
    mock_post_res.status_code = 200
    mock_post_res.json.return_value = fake_response
    mock_client.post.return_value = mock_post_res

    res = await GoogleTrafficService._query_corridor(
        client=mock_client,
        api_key="test-key",
        name="Test Corridor",
        origin_lat=12.97,
        origin_lon=77.59,
        dest_lat=12.98,
        dest_lon=77.60,
    )

    assert res is not None
    assert res["name"] == "Outer Ring Road Express"
    assert res["durationSeconds"] == 1200
    assert res["staticDurationSeconds"] == 900
    assert res["delaySeconds"] == 300  # 1200 - 900
    assert res["delayRatio"] == 1.33  # 1200 / 900
    assert res["speedIntervals"]["normal"] == 1
    assert res["speedIntervals"]["slow"] == 1
    assert res["speedIntervals"]["trafficJam"] == 1


@pytest.mark.asyncio
async def test_google_traffic_unavailable_when_no_key():
    """Verifies that missing API key returns clean UNAVAILABLE without fabricating traffic."""
    with patch("app.services.google_traffic.settings.GOOGLE_MAPS_API_KEY", None), \
         patch("app.services.google_traffic.settings.GOOGLE_API_KEY", None):
        summary = await GoogleTrafficService.get_traffic_summary(12.3051, 76.6551)
        assert summary["status"] == "UNAVAILABLE"
        assert summary["trafficStatus"] == "UNAVAILABLE"
        assert summary["delayMinutes"] == 0
        assert summary["averageDelaySeconds"] == 0
        assert summary["coverageType"] == "NO_COVERAGE"
        assert len(summary["sampledCorridors"]) == 0


@pytest.mark.asyncio
async def test_rag_service_partitions_stable_vs_recent():
    """Verifies that LocationAwareRAGService partitions STABLE_KNOWLEDGE from RECENT_UPDATE."""
    # 1. Retrieve stable knowledge
    stable = LocationAwareRAGService.search_knowledge(
        query="earthquake safety",
        doc_type="STABLE_KNOWLEDGE",
        limit=5,
    )
    for doc in stable:
        assert doc.get("docType") == "STABLE_KNOWLEDGE" or doc.get("category") == "STABLE"

    # 2. Retrieve recent bulletins
    recent = LocationAwareRAGService.search_knowledge(
        query="transit advisory",
        doc_type="RECENT_UPDATE",
        limit=5,
    )
    for doc in recent:
        assert doc.get("docType") == "RECENT_UPDATE" or doc.get("category") == "RECENT"


@pytest.mark.asyncio
async def test_civil_safety_does_not_count_stable_guidance_as_active_updates():
    """
    Verifies that for a location without direct police API or recent city bulletins (e.g. Mysore),
    stable guidance documents do NOT inflate updateCount or mark status as fake PARTIAL.
    """
    # Force cache bypass
    CivilSafetyRegistry._cache.clear()

    res = await CivilSafetyRegistry.get_civil_safety(
        latitude=12.2958,
        longitude=76.6394,
        radius_km=25.0,
        country_code="IN",
        city="Mysore",
    )

    # In Mysore: no direct police API, no specific Mysore bulletins
    # Stable guidance exists as reference protocols, but updateCount must be 0!
    assert res["status"] == "NO_COVERAGE"
    assert res["incidentCount"] is None  # Never fake 0!
    assert res["updateCount"] == 0
    assert res["guidanceCount"] > 0
    assert len(res["guidance"]) > 0
    # Provenance check: no fake "Location-Aware Civil Defense RAG"
    for s in res["sources"]:
        assert s["name"] != "Location-Aware Civil Defense RAG"


@pytest.mark.asyncio
async def test_civil_safety_uk_police_feed():
    """Verifies that UK coordinates connect to real UK police API."""
    CivilSafetyRegistry._cache.clear()

    with patch.object(CivilSafetyRegistry, "_fetch_uk_police", new_callable=AsyncMock) as mock_uk:
        mock_uk.return_value = {
            "success": True,
            "incidents": [
                {
                    "eventId": "UK-POLICE-1",
                    "title": "Anti Social Behaviour incident recorded",
                    "latitude": 51.5074,
                    "longitude": -0.1278,
                    "source": "data.police.uk",
                }
            ],
        }

        res = await CivilSafetyRegistry.get_civil_safety(
            latitude=51.5074,
            longitude=-0.1278,
            radius_km=10.0,
            country_code="GB",
            city="London",
        )

        assert res["status"] == "AVAILABLE"
        assert res["feedCapability"] == "OFFICIAL_PUBLIC_SAFETY_FEED"
        assert res["incidentCount"] == 1
        assert len(res["incidents"]) == 1
        assert any("police" in s["name"].lower() for s in res["sources"])


@pytest.mark.asyncio
async def test_urban_intel_six_pillars_structure():
    """Verifies that UrbanIntelService builds the Six Pillars with truthful traffic and civil safety."""
    intel = await UrbanIntelService.get_full_intelligence(
        latitude=12.2958,
        longitude=76.6394,
        radius_km=25.0,
    )

    pillars = intel["condition"]["pillars"]
    assert len(pillars) == 6

    traffic_pillar = next(p for p in pillars if "Traffic" in p["name"])
    safety_pillar = next(p for p in pillars if "Safety" in p["name"])

    # Traffic pillar has structured details
    assert "details" in traffic_pillar
    assert "coverageType" in traffic_pillar

    # Civil safety pillar has structured counts
    assert "updateCount" in safety_pillar
    assert "incidentCount" in safety_pillar
    assert "guidanceCount" in safety_pillar
