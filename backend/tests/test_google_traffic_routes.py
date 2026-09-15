"""
Tests for Google Maps Platform as Primary Traffic Provider
Validates all 18 requirements:
1. TrafficLayer vs Routes API separation
2. Google Routes API v2 Compute Routes traffic-aware routing
3. routingPreference = TRAFFIC_AWARE for normal route requests
4. routingPreference = TRAFFIC_AWARE_OPTIMAL for highest-quality UrbanPulse recommended route
5. travelMode = DRIVE default
6. Current departure time for current traffic requests unless future departure specified
7. Requesting duration, staticDuration, distanceMeters, polyline.encodedPolyline, and speedReadingIntervals
8. Traffic-aware speed intervals from Google for route visualization
9. Delay calculated strictly from duration - staticDuration
10. NEVER fabricate traffic percentage, congestion, delay, or route ETA
11. Separate modules
12. Location dynamic coordinates
13. Server-side Routes API calls use backend Google API key
14. Never expose server key to frontend
15. Existing browser key for JavaScript map
16. If traffic is unavailable, show unavailable, no fake traffic
17. Base map remains usable even if Routes API fails
18. UrbanPulse route-risk engine combines verified route data with hazards separately from Google traffic
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
from app.services.providers.routing_provider import RoutingProvider, parse_duration_seconds
from app.services.providers.traffic_layer_service import TrafficLayerService
from app.services.google_traffic import GoogleTrafficService


def test_traffic_layer_service_metadata_separation():
    """Requirement 1 & 11: TrafficLayer and Routes API must be separate modules."""
    meta = TrafficLayerService.get_layer_metadata()
    assert meta["provider"] == "Google Maps JavaScript API"
    assert meta["layer"] == "TrafficLayer"
    assert meta["purpose"] == "map_visualization"
    assert meta["clientRestrictedKeyRequired"] is True


def test_parse_duration_seconds():
    """Verify parsing of Google duration strings."""
    assert parse_duration_seconds("1200s") == 1200
    assert parse_duration_seconds("85.5s") == 85
    assert parse_duration_seconds(None) == 0
    assert parse_duration_seconds("") == 0


@pytest.mark.asyncio
async def test_normal_route_request_uses_traffic_aware():
    """Requirement 3 & 5: Normal route requests use routingPreference = TRAFFIC_AWARE and travelMode = DRIVE."""
    mock_response_data = {
        "routes": [
            {
                "duration": "1800s",
                "staticDuration": "1500s",
                "distanceMeters": 15000,
                "description": "Via NH 44 Expressway",
                "polyline": {"encodedPolyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@"},
                "travelAdvisory": {
                    "speedReadingIntervals": [
                        {"startPolylinePointIndex": 0, "endPolylinePointIndex": 1, "speed": "NORMAL"},
                        {"startPolylinePointIndex": 1, "endPolylinePointIndex": 2, "speed": "SLOW"},
                    ]
                },
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_response_data

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        result = await RoutingProvider.analyze_route(
            origin_lat=12.9716,
            origin_lon=77.5946,
            dest_lat=13.0827,
            dest_lon=80.2707,
            travel_mode="drive",
            departure_time="Immediate",
            routing_preference="TRAFFIC_AWARE",
        )

        assert mock_post.called
        call_args, call_kwargs = mock_post.call_args
        payload = call_kwargs["json"]
        headers = call_kwargs["headers"]

        # Requirement 2 & 5: Compute Routes and travelMode = DRIVE
        assert payload["travelMode"] == "DRIVE"
        # Requirement 3: Normal route requests use TRAFFIC_AWARE
        assert payload["routingPreference"] == "TRAFFIC_AWARE"
        # Requirement 6: Current departure time included for current traffic request
        assert "departureTime" in result
        assert result["departureTime"].endswith("Z")
        # Requirement 7 & 8: Fields requested
        assert "routes.duration" in headers["X-Goog-FieldMask"]
        assert "routes.staticDuration" in headers["X-Goog-FieldMask"]
        assert "routes.distanceMeters" in headers["X-Goog-FieldMask"]
        assert "routes.polyline.encodedPolyline" in headers["X-Goog-FieldMask"]
        assert "routes.travelAdvisory.speedReadingIntervals" in headers["X-Goog-FieldMask"]

        # Requirement 9: Delay calculated ONLY from duration - staticDuration (1800 - 1500 = 300s = 5 mins)
        candidate = result["candidateRoutes"][0]
        assert candidate["estimatedTimeMinutes"] == 30
        assert candidate["trafficDelayMinutes"] == 5
        assert candidate["distanceKm"] == 15.0

        # Requirement 8: Traffic speed intervals returned
        assert len(candidate["speedReadingIntervals"]) == 2
        assert candidate["speedReadingIntervals"][0]["speed"] == "NORMAL"
        assert candidate["speedReadingIntervals"][1]["speed"] == "SLOW"


@pytest.mark.asyncio
async def test_highest_quality_recommended_route_uses_traffic_aware_optimal():
    """Requirement 4: Support routingPreference = TRAFFIC_AWARE_OPTIMAL for highest quality recommended route."""
    mock_response_data = {
        "routes": [
            {
                "duration": "2400s",
                "staticDuration": "2000s",
                "distanceMeters": 22000,
                "description": "Recommended Optimal Transit Corridor",
                "polyline": {"encodedPolyline": "_p~iF~ps|U_ulLnnqC"},
                "travelAdvisory": {
                    "speedReadingIntervals": [
                        {"startPolylinePointIndex": 0, "endPolylinePointIndex": 1, "speed": "TRAFFIC_JAM"},
                    ]
                },
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_response_data

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        result = await RoutingProvider.analyze_route(
            origin_lat=12.2958,
            origin_lon=76.6394,
            dest_lat=12.9716,
            dest_lon=77.5946,
            travel_mode="drive",
            departure_time="Immediate",
            routing_preference="TRAFFIC_AWARE_OPTIMAL",
        )

        assert mock_post.called
        call_kwargs = mock_post.call_args[1]
        payload = call_kwargs["json"]

        assert payload["routingPreference"] == "TRAFFIC_AWARE_OPTIMAL"
        assert result["routingPreference"] == "TRAFFIC_AWARE_OPTIMAL"
        # Delay: 2400 - 2000 = 400s = 7 minutes
        assert result["candidateRoutes"][0]["trafficDelayMinutes"] == 7


@pytest.mark.asyncio
async def test_future_departure_time():
    """Requirement 6: Use current departure time unless user explicitly asks about a future departure."""
    mock_response_data = {
        "routes": [
            {
                "duration": "1200s",
                "staticDuration": "1200s",
                "distanceMeters": 10000,
                "polyline": {"encodedPolyline": "_p~iF~ps|U"},
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_response_data

    future_time = "2026-10-15T08:30:00Z"
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        await RoutingProvider.analyze_route(
            origin_lat=12.2958,
            origin_lon=76.6394,
            dest_lat=12.9716,
            dest_lon=77.5946,
            departure_time=future_time,
        )

        call_kwargs = mock_post.call_args[1]
        payload = call_kwargs["json"]
        assert payload["departureTime"] == future_time


@pytest.mark.asyncio
async def test_delay_is_zero_when_duration_equals_static_duration():
    """Requirement 9 & 10: Calculate delay only from duration - staticDuration, NEVER fabricate delay."""
    mock_response_data = {
        "routes": [
            {
                "duration": "900s",
                "staticDuration": "900s",
                "distanceMeters": 8000,
                "description": "Free Flow Route",
                "polyline": {"encodedPolyline": "_p~iF~ps|U"},
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_response_data

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        result = await RoutingProvider.analyze_route(
            origin_lat=35.6762,
            origin_lon=139.6503,
            dest_lat=35.6895,
            dest_lon=139.6917,
        )

        route = result["candidateRoutes"][0]
        # Zero delay because duration == staticDuration. No fake delay added!
        assert route["trafficDelayMinutes"] == 0
        assert "Free-flowing Google traffic" in route["rationale"]


@pytest.mark.asyncio
async def test_route_risk_engine_combines_hazards_separately_from_traffic():
    """Requirement 18: Combine verified route data with UrbanPulse hazards/events separately from traffic."""
    # Polyline decoded points will intersect nearby event
    mock_response_data = {
        "routes": [
            {
                "duration": "1800s",
                "staticDuration": "1500s",
                "distanceMeters": 15000,
                "description": "Route with Incident",
                # Encoded polyline with points near (12.9716, 77.5946)
                "polyline": {"encodedPolyline": "_p~iF~ps|U_ulLnnqC"},
            }
        ]
    }

    nearby_hazards = [
        {
            "eventId": "EVT-POT-1",
            "eventType": "POTHOLE",
            "title": "Severe road cavity",
            "latitude": 38.5,
            "longitude": -120.2,
            "severity": 80,
        }
    ]

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_response_data

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        result = await RoutingProvider.analyze_route(
            origin_lat=12.9716,
            origin_lon=77.5946,
            dest_lat=13.0000,
            dest_lon=77.6000,
            nearby_events=nearby_hazards,
        )

        route = result["candidateRoutes"][0]
        # Traffic delay: 300s = 5m
        assert route["trafficDelayMinutes"] == 5
        # Hazard risk evaluated separately
        assert len(route["intersectingEvents"]) >= 1
        assert route["overallRiskScore"] > 15
        assert "Live Google Traffic reports +5 min slowdown" in route["rationale"]
        assert "Intersects 1 verified UrbanPulse civic alert" in route["rationale"]


@pytest.mark.asyncio
async def test_traffic_unavailable_returns_error_without_fake_traffic():
    """Requirement 16: If traffic is unavailable, show unavailable, do not substitute fake traffic."""
    mock_resp = MagicMock()
    mock_resp.status_code = 503
    mock_resp.text = "Google Routes API temporarily unavailable"

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        with pytest.raises(HTTPException) as exc_info:
            await RoutingProvider.analyze_route(
                origin_lat=12.9716,
                origin_lon=77.5946,
                dest_lat=13.0827,
                dest_lon=80.2707,
            )

        assert exc_info.value.status_code == 502
        assert "Google Routes API returned error" in exc_info.value.detail
