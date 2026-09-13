"""
UrbanPulse Global Intelligence & Accuracy Test Suite
Validates dynamic location resolution, standard-aware air quality, roads separation,
crime transparency, zero-fabrication guarantees, and location switch isolation.
"""

import pytest
import asyncio
from datetime import datetime
from app.services.urban_intel import UrbanIntelService
from app.services.providers.air_quality_provider import (
    AirQualityProvider,
    calculate_cpcb_india_aqi,
    classify_us_aqi,
    classify_european_aqi,
)
from app.services.providers.road_provider import RoadProvider
from app.services.providers.crime_provider import CrimeProvider
from app.services.providers.geocoding_provider import GeocodingProvider


def test_location_resolution_global_cities():
    """Verify reverse geocoding extracts correct geographic hierarchy and timezone for global cities."""
    async def _run():
        test_cases = [
            {"name": "Delhi, India", "lat": 28.6139, "lon": 77.2090, "expected_country": "India", "country_code": "IN", "tz_prefix": "Asia/"},
            {"name": "Mysuru, India", "lat": 12.2958, "lon": 76.6394, "expected_country": "India", "country_code": "IN", "tz_prefix": "Asia/"},
            {"name": "New York, USA", "lat": 40.7128, "lon": -74.0060, "expected_country": "United States", "country_code": "US", "tz_prefix": "America/"},
            {"name": "London, UK", "lat": 51.5074, "lon": -0.1278, "expected_country": "United Kingdom", "country_code": "GB", "tz_prefix": "Europe/"},
            {"name": "Tokyo, Japan", "lat": 35.6762, "lon": 139.6503, "expected_country": "Japan", "country_code": "JP", "tz_prefix": "Asia/"},
            {"name": "Sydney, Australia", "lat": -33.8688, "lon": 151.2093, "expected_country": "Australia", "country_code": "AU", "tz_prefix": "Australia/"},
            {"name": "Singapore", "lat": 1.3521, "lon": 103.8198, "expected_country": "Singapore", "country_code": "SG", "tz_prefix": "Asia/"},
        ]

        for tc in test_cases:
            resolved = await GeocodingProvider.reverse_geocode(tc["lat"], tc["lon"])
            assert resolved["latitude"] == tc["lat"]
            assert resolved["longitude"] == tc["lon"]
            assert resolved["timezone"] is not None
            assert resolved["timezone"].startswith(tc["tz_prefix"]), f"{tc['name']} timezone mismatch: {resolved['timezone']}"
            if resolved.get("countryCode"):
                assert resolved["countryCode"] == tc["country_code"]
            if resolved.get("country"):
                assert (tc["expected_country"].lower() in resolved["country"].lower()) or (resolved["countryCode"] == tc["country_code"])

    asyncio.run(_run())


def test_remote_and_rural_coordinates():
    """Validates graceful handling of remote offshore coordinates and rural coordinates."""
    async def _run():
        # 1. Rural Kansas
        rural = await UrbanIntelService.get_full_intelligence(38.5000, -98.0000, radius_km=50.0)
        assert rural["location"]["latitude"] == 38.5000
        assert rural["condition"]["confidence"] >= 0.3
        assert "knownSignals" in rural["condition"]
        assert "missingSignals" in rural["condition"]

        # 2. Remote offshore (Mid-Atlantic Ocean)
        offshore = await UrbanIntelService.get_full_intelligence(0.0000, -30.0000, radius_km=50.0)
        assert offshore["location"]["latitude"] == 0.0000
        assert offshore["location"]["longitude"] == -30.0000
        # Roads in the ocean should have no verified surface feed
        assert offshore["roads"]["roadConditionStatus"] == "NO_VERIFIED_FEED"
        # Never fabricates artificial scores
        assert offshore["condition"]["confidence"] <= 0.90

    asyncio.run(_run())


def test_air_quality_standard_awareness():
    """Validates that air quality uses location-appropriate standard (CPCB in India, US AQI in USA)."""
    # 1. Test calculation functions
    cpcb_val, cpcb_cat = calculate_cpcb_india_aqi(pm2_5=35.0, pm10=40.0)
    assert 51 <= cpcb_val <= 100
    assert cpcb_cat == "Satisfactory"

    cpcb_poor_val, cpcb_poor_cat = calculate_cpcb_india_aqi(pm2_5=110.0)
    assert 201 <= cpcb_poor_val <= 300
    assert cpcb_poor_cat == "Poor"

    assert classify_us_aqi(45) == "Good"
    assert classify_us_aqi(85) == "Moderate"
    assert classify_us_aqi(160) == "Unhealthy"

    assert classify_european_aqi(15) == "Very Good"
    assert classify_european_aqi(50) == "Medium"
    assert classify_european_aqi(85) == "Very Poor"

    # 2. Live API with country-aware standard
    async def _run():
        delhi_aq = await AirQualityProvider.get_air_quality(28.6139, 77.2090, country_code="IN")
        if delhi_aq["status"] == "AVAILABLE":
            assert delhi_aq["scale"] == "CPCB_INDIA_AQI"
            assert delhi_aq["value"] is not None
            assert delhi_aq["category"] in ["Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe"]

        nyc_aq = await AirQualityProvider.get_air_quality(40.7128, -74.0060, country_code="US")
        if nyc_aq["status"] == "AVAILABLE":
            assert nyc_aq["scale"] == "US_AQI"
            assert nyc_aq["value"] is not None
            assert nyc_aq["category"] in ["Good", "Moderate", "Unhealthy for Sensitive Groups", "Unhealthy", "Very Unhealthy", "Hazardous"]

    asyncio.run(_run())


def test_road_network_and_condition_separation():
    """Strictly verifies that road network status and road surface condition feeds are separate."""
    # Case with no pothole alerts
    road_status = RoadProvider.get_road_status(51.5074, -0.1278, radius_km=50.0, incident_events=[])
    assert road_status["roadNetworkStatus"] == "AVAILABLE"
    assert road_status["roadConditionStatus"] == "NO_VERIFIED_FEED"
    assert "No physical pavement telemetry" in road_status["roadConditionSource"]
    assert road_status["activeHazardCount"] == 0

    # Case with verified pothole alert
    fake_pothole = [{"eventType": "POTHOLE", "title": "Pothole on Main St", "severity": 60}]
    road_status_active = RoadProvider.get_road_status(51.5074, -0.1278, radius_km=50.0, incident_events=fake_pothole)
    assert road_status_active["roadNetworkStatus"] == "AVAILABLE"
    assert road_status_active["roadConditionStatus"] == "AVAILABLE"
    assert road_status_active["activeHazardCount"] == 1


def test_crime_provider_transparency():
    """Validates that CrimeProvider never reports '0 crimes' when no verified police API exists."""
    crime = CrimeProvider.get_crime_events(40.7128, -74.0060, radius_km=50.0, country_code="US")
    assert crime["status"] == "NO_VERIFIED_FEED"
    assert crime["verifiedCount"] is None  # MUST NOT be 0!
    assert "No verified public safety" in crime["message"]


def test_deterministic_urban_condition_score():
    """Validates that missing feeds reduce confidence and are penalized rather than treated as safe."""
    async def _run():
        intel = await UrbanIntelService.get_full_intelligence(51.5074, -0.1278, radius_km=50.0)
        cond = intel["condition"]
        assert "overallScore" in cond
        assert "confidence" in cond
        assert "knownSignals" in cond
        assert "missingSignals" in cond
        assert cond["knownSignals"] + cond["missingSignals"] == len(cond["pillars"])
        # Confidence must equal knownSignals / totalPillars
        expected_confidence = round(cond["knownSignals"] / len(cond["pillars"]), 2)
        assert cond["confidence"] == expected_confidence

        # If missing signals exist, confidence cannot be 1.0
        if cond["missingSignals"] > 0:
            assert cond["confidence"] < 1.0

    asyncio.run(_run())


def test_location_switch_isolation():
    """
    Validates that querying Location A then Location B produces isolated responses with zero stale data leakage.
    (Delhi -> Tokyo).
    """
    async def _run():
        # Location A: Delhi
        intel_a = await UrbanIntelService.get_full_intelligence(28.6139, 77.2090, radius_km=50.0)
        # Location B: Tokyo
        intel_b = await UrbanIntelService.get_full_intelligence(35.6762, 139.6503, radius_km=50.0)

        # 1. Location hierarchy check
        assert intel_a["location"]["countryCode"] == "IN"
        assert intel_b["location"]["countryCode"] == "JP"
        assert intel_a["location"]["timezone"] == "Asia/Kolkata"
        assert intel_b["location"]["timezone"] == "Asia/Tokyo"

        # 2. Verify no stale names or coordinates remain
        assert intel_a["location"]["city"] != intel_b["location"]["city"]
        assert "Delhi" not in (intel_b["location"]["displayName"] or "")
        assert "India" not in (intel_b["location"]["displayName"] or "")

        # 3. AQI standard isolation
        assert intel_a["airQuality"]["scale"] == "CPCB_INDIA_AQI"
        # Tokyo uses US_AQI or international standard, not CPCB India
        assert intel_b["airQuality"]["scale"] != "CPCB_INDIA_AQI"

        # 4. Weather coordinate isolation
        if intel_a["weather"].get("current") and intel_b["weather"].get("current"):
            assert intel_a["weather"]["current"]["temperatureC"] is not None
            assert intel_b["weather"]["current"]["temperatureC"] is not None

    asyncio.run(_run())
