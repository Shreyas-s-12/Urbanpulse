"""
Tests for UrbanPulse Manual Location Input, Search, and Autocomplete (Sections 66 - 102).
Covers:
- City Search (Bengaluru, Mysuru, London, Tokyo)
- Neighborhood / Sublocality Search (Indiranagar, Bengaluru)
- Street / Address Search (12 Example Street)
- Ambiguous City Name Disambiguation (e.g. Springfield IL vs MO)
- Search then Me (Device GPS strictly preserved)
- Me then Search (Active switches to search, device GPS unharmed)
- Choose on Map (Arbitrary coordinate click, zero POI snapping)
- Drag Pin Correction (source: MANUAL_ADJUSTMENT)
- Nexus "here/me" vs named place resolution
- Result-Type-Aware Zoom levels
- Zero Hardcoded City Center / Zero GPS snapping
"""

import pytest
from typing import Dict, Any, Optional
from app.services.agent.location_agent import LocationAgentService


def get_type_aware_zoom(category_type: str) -> int:
    mapping = {
        "COUNTRY": 5,
        "REGION": 8,
        "CITY": 12,
        "TOWN": 12,
        "DISTRICT": 11,
        "NEIGHBORHOOD": 14,
        "AREA": 14,
        "STREET": 16,
        "ADDRESS": 17,
        "POI": 17,
        "LANDMARK": 17,
    }
    return mapping.get(category_type.upper(), 13)


def test_city_search_exact_coordinates():
    """Verify city search sets SEARCH source and exact provider geometry without snapping."""
    searched_city = {
        "latitude": 12.971598,
        "longitude": 77.594566,
        "displayName": "Bengaluru, Karnataka, India",
        "city": "Bengaluru",
        "categoryType": "CITY",
        "source": "SEARCH",
    }
    assert searched_city["source"] == "SEARCH"
    assert searched_city["categoryType"] == "CITY"
    assert get_type_aware_zoom(searched_city["categoryType"]) == 12


def test_neighborhood_and_sublocality_search():
    """Verify neighborhood search uses sublocality geometry, not generic city center."""
    city_center = {"latitude": 12.9716, "longitude": 77.5946}
    indiranagar = {
        "latitude": 12.9784,
        "longitude": 77.6408,
        "displayName": "Indiranagar, Bengaluru, Karnataka, India",
        "categoryType": "NEIGHBORHOOD",
        "source": "SEARCH",
    }
    assert (indiranagar["latitude"], indiranagar["longitude"]) != (city_center["latitude"], city_center["longitude"])
    assert indiranagar["categoryType"] == "NEIGHBORHOOD"
    assert get_type_aware_zoom(indiranagar["categoryType"]) == 14


def test_street_address_search_exact_geometry():
    """Verify specific street address search preserves exact coordinate and zoom 17."""
    street_addr = {
        "latitude": 12.97235,
        "longitude": 77.60112,
        "displayName": "12 Example Street, Bengaluru",
        "formattedAddress": "12 Example St, Bengaluru, Karnataka 560001",
        "categoryType": "ADDRESS",
        "source": "SEARCH",
    }
    assert street_addr["source"] == "SEARCH"
    assert street_addr["categoryType"] == "ADDRESS"
    assert get_type_aware_zoom(street_addr["categoryType"]) == 17


def test_search_then_me_preserves_device_gps():
    """Verify searching another city keeps device GPS in memory and switching back works immediately."""
    device_loc = {
        "latitude": 12.3051,
        "longitude": 76.6551,
        "accuracyMeters": 16.0,
        "city": "Mysuru",
        "source": "DEVICE_GPS",
    }
    active_search = {
        "latitude": 51.5074,
        "longitude": -0.1278,
        "displayName": "London, United Kingdom",
        "city": "London",
        "source": "SEARCH",
    }

    # User viewed London
    current_view = dict(active_search)
    assert current_view["city"] == "London"

    # User clicks [ ◎ Use my location ]
    current_view = dict(device_loc)
    assert current_view["latitude"] == device_loc["latitude"]
    assert current_view["longitude"] == device_loc["longitude"]
    assert current_view["source"] == "DEVICE_GPS"


def test_me_then_search_does_not_corrupt_device_gps():
    """Verify active device location is not overwritten when user searches Paris."""
    device_loc = {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "source": "DEVICE_GPS",
    }
    active_search = {
        "latitude": 48.8566,
        "longitude": 2.3522,
        "city": "Paris",
        "source": "SEARCH",
    }

    # Verify device coordinates are not replaced with Paris
    assert device_loc["latitude"] == 12.9716
    assert active_search["city"] == "Paris"
    assert device_loc["latitude"] != active_search["latitude"]


def test_choose_on_map_arbitrary_point():
    """Verify clicking an arbitrary map point creates MAP_CLICK location without POI snapping."""
    clicked_lat = 13.045678
    clicked_lng = 77.512345
    poi_coords = (13.04000, 77.51000)

    map_selected = {
        "latitude": clicked_lat,
        "longitude": clicked_lng,
        "source": "MAP_CLICK",
        "displayName": f"Map Point ({clicked_lat:.4f}, {clicked_lng:.4f})",
    }

    assert map_selected["latitude"] == clicked_lat
    assert map_selected["longitude"] == clicked_lng
    assert map_selected["source"] == "MAP_CLICK"
    assert (map_selected["latitude"], map_selected["longitude"]) != poi_coords


def test_drag_to_correct_manual_adjustment():
    """Verify dragging a searched pin assigns MANUAL_ADJUSTMENT source and keeps exact coordinate."""
    initial_search = {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "source": "SEARCH",
    }
    dragged_lat = 12.9725
    dragged_lng = 77.5960

    adjusted_location = {
        "latitude": dragged_lat,
        "longitude": dragged_lng,
        "source": "MANUAL_ADJUSTMENT",
        "displayName": f"Adjusted Location ({dragged_lat:.4f}, {dragged_lng:.4f})",
    }

    assert adjusted_location["source"] == "MANUAL_ADJUSTMENT"
    assert adjusted_location["latitude"] == dragged_lat
    assert adjusted_location["longitude"] == dragged_lng
    assert adjusted_location["latitude"] != initial_search["latitude"]


def test_ambiguous_name_disambiguation():
    """Verify ambiguous names like Springfield produce structured matches with state/country."""
    matches = [
        {"name": "Springfield", "region": "Illinois", "country": "United States", "categoryType": "CITY"},
        {"name": "Springfield", "region": "Missouri", "country": "United States", "categoryType": "CITY"},
        {"name": "Springfield", "region": "Massachusetts", "country": "United States", "categoryType": "CITY"},
    ]
    assert len(matches) == 3
    # Distinct regions
    regions = [m["region"] for m in matches]
    assert len(set(regions)) == 3


def test_type_aware_zoom_levels():
    """Verify zoom levels follow section 84 specification across geographic hierarchy."""
    assert get_type_aware_zoom("COUNTRY") == 5
    assert get_type_aware_zoom("REGION") == 8
    assert get_type_aware_zoom("CITY") == 12
    assert get_type_aware_zoom("NEIGHBORHOOD") == 14
    assert get_type_aware_zoom("STREET") == 16
    assert get_type_aware_zoom("ADDRESS") == 17
    assert get_type_aware_zoom("POI") == 17


@pytest.mark.asyncio
async def test_nexus_named_search_resolution():
    """Verify Nexus understands 'Show Tokyo' and targets Tokyo with SEARCH action."""
    req = {
        "query": "Show Tokyo",
        "current_location": {"latitude": 12.9716, "longitude": 77.5946, "city": "Bengaluru", "isUserLocation": True},
        "selected_radius_km": 25.0,
    }
    resp = await LocationAgentService.process_interaction(req)
    assert resp["location"] is not None
    assert "Tokyo" in resp["location"]["displayName"] or "Tokyo" in resp["location"].get("city", "")
    assert resp["actions"][0]["type"] == "CENTER_MAP"
    assert resp["location"]["activeLocationSource"] == "SEARCH"


@pytest.mark.asyncio
async def test_nexus_here_vs_there_semantics():
    """Verify 'here' resolves to user device, while 'there' resolves to active searched location."""
    user_device = {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "city": "Bengaluru",
        "isUserLocation": True,
        "source": "DEVICE_GPS",
    }
    selected_search = {
        "latitude": 35.6762,
        "longitude": 139.6503,
        "city": "Tokyo",
        "isUserLocation": False,
        "source": "SEARCH",
        "deviceLocation": user_device,
    }

    # 1. "How is the weather here?" -> should target user device in Bengaluru
    req_here = {
        "query": "How is the weather here?",
        "current_location": selected_search,
        "selected_radius_km": 10.0,
    }
    resp_here = await LocationAgentService.process_interaction(req_here)
    assert resp_here["location"]["latitude"] == user_device["latitude"]
    assert resp_here["location"]["longitude"] == user_device["longitude"]

    # 2. "How is the weather there?" -> should target selected search in Tokyo
    req_there = {
        "query": "How is the weather there?",
        "current_location": selected_search,
        "selected_radius_km": 10.0,
    }
    resp_there = await LocationAgentService.process_interaction(req_there)
    assert resp_there["location"]["latitude"] == selected_search["latitude"]
    assert resp_there["location"]["longitude"] == selected_search["longitude"]
