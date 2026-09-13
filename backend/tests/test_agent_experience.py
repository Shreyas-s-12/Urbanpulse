"""
End-to-end integration tests for the UrbanPulse Location Intelligence Agent experience.
Verifies all 7 core user scenarios, intent resolution, real data grounding, map action emission,
multi-location switching, and comparison requests.
"""

import pytest
import asyncio
from app.services.agent.location_agent import LocationAgentService


def test_scenario_1_mysore_traffic():
    """
    Scenario 1: 'Current traffic in Mysore'
    Expected:
    - Resolves Mysore
    - Queries Google Traffic
    - Emits CENTER_MAP and SHOW_TRAFFIC_LAYER
    - Live data grounding in response
    """
    async def _run():
        req = {"query": "Current traffic in Mysore", "selected_radius_km": 50.0}
        res = await LocationAgentService.process_interaction(req)

        assert res["intent"] == "TRAFFIC"
        assert res["location"] is not None
        assert "Mys" in (res["location"].get("city") or "") or "Mys" in res["location"]["displayName"]
        assert res["location"]["latitude"] > 0 and res["location"]["longitude"] > 0

        action_types = [a["type"] for a in res["actions"]]
        assert "CENTER_MAP" in action_types
        assert "SHOW_TRAFFIC_LAYER" in action_types
        assert "traffic" in res["data"]
        assert len(res["sources"]) > 0

    asyncio.run(_run())


def test_scenario_2_new_york_weather():
    """
    Scenario 2: 'Current weather in New York'
    Expected:
    - Resolves New York
    - Fetches Open-Meteo weather
    - Emits CENTER_MAP to New York coordinates
    - Response includes temperature, humidity, wind
    """
    async def _run():
        req = {"query": "Current weather in New York"}
        res = await LocationAgentService.process_interaction(req)

        assert res["intent"] == "WEATHER"
        assert res["location"] is not None
        assert "New York" in (res["location"].get("city") or "") or "New York" in res["location"]["displayName"]

        action_types = [a["type"] for a in res["actions"]]
        assert "CENTER_MAP" in action_types
        assert "weather" in res["data"]
        assert res["data"]["weather"]["status"] == "AVAILABLE"
        assert "°C" in res["message"]

    asyncio.run(_run())


def test_scenario_3_bangalore_traffic():
    """
    Scenario 3: 'Current traffic in Bangalore'
    Expected:
    - Resolves Bangalore/Bengaluru
    - Fetches Google traffic
    - Emits CENTER_MAP + SHOW_TRAFFIC_LAYER
    """
    async def _run():
        req = {"query": "Current traffic in Bangalore"}
        res = await LocationAgentService.process_interaction(req)

        assert res["intent"] == "TRAFFIC"
        assert res["location"] is not None
        action_types = [a["type"] for a in res["actions"]]
        assert "CENTER_MAP" in action_types
        assert "SHOW_TRAFFIC_LAYER" in action_types
        assert "traffic" in res["data"]

    asyncio.run(_run())


def test_scenario_4_delhi_air_quality():
    """
    Scenario 4: 'Current air quality in Delhi'
    Expected:
    - Resolves Delhi
    - Fetches CPCB India AQI
    - Emits SHOW_AQI_LAYER
    - Standard is CPCB_INDIA_AQI
    """
    async def _run():
        req = {"query": "Current air quality in Delhi"}
        res = await LocationAgentService.process_interaction(req)

        assert res["intent"] == "AIR_QUALITY"
        assert res["location"] is not None
        assert "Delhi" in res["location"]["displayName"]

        action_types = [a["type"] for a in res["actions"]]
        assert "CENTER_MAP" in action_types
        assert "SHOW_AQI_LAYER" in action_types

        aqi = res["data"]["airQuality"]
        assert aqi["status"] == "AVAILABLE"
        assert aqi["scale"] == "CPCB_INDIA_AQI"
        assert aqi["value"] is not None

    asyncio.run(_run())


def test_scenario_5_bangalore_overall_rating():
    """
    Scenario 5: 'Give me the overall rating for Bangalore'
    Expected:
    - All available signals fetched
    - Rating calculated deterministically
    - Confidence penalized for missing feeds
    - CENTER_MAP emitted
    """
    async def _run():
        req = {"query": "Give me the overall rating for Bangalore"}
        res = await LocationAgentService.process_interaction(req)

        assert res["intent"] == "OVERALL_RATING"
        assert res["location"] is not None
        assert "condition" in res["data"]

        cond = res["data"]["condition"]
        assert cond["overallScore"] is not None
        assert cond["confidence"] <= 1.0
        assert cond["missingSignals"] > 0
        assert "/ 100" in res["message"]

    asyncio.run(_run())


def test_scenario_6_multi_location_switch():
    """
    Scenario 6: 'Now check Tokyo.' after Bangalore
    Expected:
    - Tokyo replaces Bangalore as active location
    - No Bangalore data remains in response
    """
    async def _run():
        bengaluru_context = {
            "city": "Bengaluru",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "country": "India",
            "countryCode": "IN",
            "displayName": "Bengaluru, Karnataka, India",
        }
        req = {
            "query": "Now check Tokyo.",
            "current_location": bengaluru_context,
        }
        res = await LocationAgentService.process_interaction(req)

        assert res["location"] is not None
        assert "Tokyo" in (res["location"].get("city") or "") or "Tokyo" in res["location"]["displayName"]
        assert res["location"]["countryCode"] == "JP"
        # Ensure no leftover Bangalore coordinates in center action
        center_act = next(a for a in res["actions"] if a["type"] == "CENTER_MAP")
        assert abs(center_act["payload"]["latitude"] - 35.6) < 1.0

    asyncio.run(_run())


def test_scenario_7_follow_up_question():
    """
    Scenario 7: 'How is the air quality?' with Tokyo as active location
    Expected:
    - Inherits Tokyo context
    - Returns Tokyo air quality
    - Emits SHOW_AQI_LAYER for Tokyo
    """
    async def _run():
        tokyo_context = {
            "city": "Tokyo",
            "latitude": 35.6762,
            "longitude": 139.6503,
            "country": "Japan",
            "countryCode": "JP",
            "displayName": "Tokyo, Japan",
        }
        req = {
            "query": "How is the air quality?",
            "current_location": tokyo_context,
        }
        res = await LocationAgentService.process_interaction(req)

        assert res["intent"] == "AIR_QUALITY"
        assert res["location"]["city"] == "Tokyo"
        action_types = [a["type"] for a in res["actions"]]
        assert "SHOW_AQI_LAYER" in action_types
        assert res["data"]["airQuality"]["status"] == "AVAILABLE"

    asyncio.run(_run())


def test_comparison_delhi_and_mumbai():
    """
    Comparison test: 'Compare air quality in Delhi and Mumbai'
    Expected:
    - Recognizes COMPARISON
    - Fetches both cities
    - Generates comparative verdict
    """
    async def _run():
        req = {"query": "Compare air quality in Delhi and Mumbai"}
        res = await LocationAgentService.process_interaction(req)

        assert res["intent"] == "COMPARISON"
        assert "comparison" in res["data"]
        comp = res["data"]["comparison"]
        assert comp["locationA"]["summary"]["value"] is not None
        assert comp["locationB"]["summary"]["value"] is not None
        assert "Air Quality Comparison" in res["message"]

    asyncio.run(_run())
