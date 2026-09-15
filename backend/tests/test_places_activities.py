"""
Tests for Place Selection, POI Context Preservation, Activities Intent, and GooglePlacesService.
"""

import asyncio
import pytest
from app.services.agent.location_agent import LocationAgentService
from app.services.google_places import GooglePlacesService


def test_activities_intent_heuristic():
    """Verify that queries about activities and things to do map to ACTIVITIES intent."""
    intent_obj = LocationAgentService._parse_intent_heuristics("What activities are near Mysore Palace?")
    assert intent_obj.intent == "ACTIVITIES"

    intent_obj2 = LocationAgentService._parse_intent_heuristics("What are things to do around Central Park?")
    assert intent_obj2.intent == "ACTIVITIES"

    intent_obj3 = LocationAgentService._parse_intent_heuristics("Show attractions near Eiffel Tower")
    assert intent_obj3.intent == "ACTIVITIES"


def test_place_context_retention():
    """Verify that when a canonical place is active, queries retain the place location and zoom."""
    async def _run():
        current_loc = {
            "type": "PLACE",
            "placeId": "ChIJb8Wwz52trzsR_3qA3tWk7-w",
            "name": "Mysore Palace",
            "address": "Sayyaji Rao Rd, Agrahara, Chamrajpura, Mysuru, Karnataka 570001",
            "latitude": 12.3052,
            "longitude": 76.6552,
            "city": "Mysore Palace",
            "displayName": "Mysore Palace — Sayyaji Rao Rd",
        }

        resolved_loc, activities = await LocationAgentService.resolve_target_location(
            "Mysore Palace", current_loc=current_loc
        )

        assert resolved_loc is not None
        assert resolved_loc["latitude"] == 12.3052
        assert resolved_loc["longitude"] == 76.6552
        assert resolved_loc.get("type") == "PLACE"

        zoom = LocationAgentService._determine_zoom(resolved_loc)
        assert zoom == 16

    asyncio.run(_run())


def test_no_raw_urls_in_response():
    """Verify that responses do not contain visible raw URL strings."""
    async def _run():
        req = {
            "query": "What are the live conditions and status around Mysore Palace?",
            "current_location": {
                "type": "PLACE",
                "placeId": "ChIJb8Wwz52trzsR_3qA3tWk7-w",
                "name": "Mysore Palace",
                "latitude": 12.3052,
                "longitude": 76.6552,
            },
        }
        res = await LocationAgentService.process_interaction(req)
        assert "https://" not in res["message"]
        assert "http://" not in res["message"]
        assert "www." not in res["message"]

    asyncio.run(_run())
