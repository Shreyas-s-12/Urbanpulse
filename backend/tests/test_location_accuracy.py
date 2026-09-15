import pytest
from app.services.providers.geocoding_provider import GeocodingProvider


@pytest.mark.asyncio
async def test_search_mysuru_disambiguation():
    """Verify searching 'Mysuru' resolves to Mysuru, Karnataka, India without hardcoded special-cases."""
    results = await GeocodingProvider.search("Mysuru")
    assert len(results) > 0
    top = results[0]
    assert "Mysuru" in top["city"]
    assert top["countryCode"] == "IN"
    assert "India" in (top["country"] or "")
    assert 12.0 <= top["latitude"] <= 12.6
    assert 76.4 <= top["longitude"] <= 77.0


@pytest.mark.asyncio
async def test_search_paris_with_proximity_bias():
    """Verify 'Paris' resolves to France by default, and Texas/US when biased to North America."""
    global_results = await GeocodingProvider.search("Paris")
    assert len(global_results) > 0
    assert global_results[0]["countryCode"] == "FR"

    us_results = await GeocodingProvider.search("Paris", country_code="US")
    assert len(us_results) > 0
    assert us_results[0]["countryCode"] == "US"


@pytest.mark.asyncio
async def test_reverse_geocode_preserves_exact_coordinates():
    """Verify reverse geocoding preserves input coordinates without snapping."""
    raw_lat = 12.312345
    raw_lon = 76.654321
    res = await GeocodingProvider.reverse_geocode(raw_lat, raw_lon, accuracy=14.5)
    assert res["latitude"] == raw_lat
    assert res["longitude"] == raw_lon
    assert res["accuracy"] == 14.5
