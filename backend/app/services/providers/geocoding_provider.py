"""
UrbanPulse Geocoding Provider
Translates geographic coordinates into location context and supports global place/coordinate search.
"""

from typing import Any, Dict, List, Optional
import httpx
import re
from app.core.config import settings


class GeocodingProvider:
    @staticmethod
    async def resolve_timezone(latitude: float, longitude: float) -> str:
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m",
            "timezone": "auto",
        }

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(settings.OPENMETEO_API_URL, params=params)
                if res.status_code == 200:
                    timezone_name = res.json().get("timezone")
                    if timezone_name:
                        return timezone_name
        except Exception:
            pass

        return "UTC"

    @staticmethod
    async def reverse_geocode(latitude: float, longitude: float, accuracy: Optional[float] = None) -> Dict[str, Any]:
        """
        Reverse geocodes coordinates to country, region/state, district, city, and timezone.
        Works globally for any latitude/longitude including rural or offshore coordinates.
        """
        url = "https://nominatim.openstreetmap.org/reverse"
        headers = {
            "User-Agent": settings.NOMINATIM_USER_AGENT,
            "Accept-Language": "en, *;q=0.5",
        }
        params = {
            "lat": latitude,
            "lon": longitude,
            "format": "jsonv2",
            "addressdetails": 1,
        }

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url, params=params, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    addr = data.get("address", {})

                    city = (
                        addr.get("city")
                        or addr.get("town")
                        or addr.get("village")
                        or addr.get("municipality")
                        or addr.get("suburb")
                        or addr.get("hamlet")
                        or addr.get("locality")
                        or None
                    )
                    district = addr.get("county") or addr.get("state_district") or None
                    state = addr.get("state") or addr.get("province") or None
                    region = state
                    country = addr.get("country") or None
                    country_code = addr.get("country_code", "").upper() or None
                    region_code = addr.get("ISO3166-2-lvl4") or None

                    display_name = data.get("display_name")
                    if not display_name:
                        parts = [p for p in [city, state, country] if p]
                        display_name = ", ".join(parts) if parts else f"{latitude:.4f}°, {longitude:.4f}°"

                    timezone_name = await GeocodingProvider.resolve_timezone(latitude, longitude)

                    return {
                        "latitude": latitude,
                        "longitude": longitude,
                        "accuracy": accuracy,
                        "city": city,
                        "district": district,
                        "state": state,
                        "region": region,
                        "country": country,
                        "countryCode": country_code,
                        "regionCode": region_code,
                        "timezone": timezone_name,
                        "displayName": display_name,
                        "isUserLocation": True,
                    }
        except Exception:
            pass

        # Fallback coordinate representation (e.g. offshore or offline)
        return {
            "latitude": latitude,
            "longitude": longitude,
            "accuracy": accuracy,
            "city": None,
            "district": None,
            "state": None,
            "region": None,
            "country": None,
            "countryCode": None,
            "regionCode": None,
            "timezone": await GeocodingProvider.resolve_timezone(latitude, longitude),
            "displayName": f"Coordinates ({latitude:.4f}, {longitude:.4f})",
            "isUserLocation": True,
        }

    @staticmethod
    async def geocode(query: str) -> Optional[Dict[str, Any]]:
        """
        Geocodes a single location query string to a location context dict.
        """
        results = await GeocodingProvider.search(query)
        if results and len(results) > 0:
            return results[0]
        return None

    @staticmethod
    async def search(query: str) -> List[Dict[str, Any]]:
        """
        Searches any city, district, address, landmark, or raw coordinates worldwide.
        """
        q = query.strip()
        if not q:
            return []

        # Check if coordinates input like "12.2958, 76.6394" or "35.6762 139.6503"
        coord_match = re.match(r"^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$", q)
        if coord_match:
            lat = float(coord_match.group(1))
            lon = float(coord_match.group(2))
            resolved = await GeocodingProvider.reverse_geocode(lat, lon)
            resolved["isUserLocation"] = False
            return [resolved]

        url = "https://nominatim.openstreetmap.org/search"
        headers = {
            "User-Agent": settings.NOMINATIM_USER_AGENT,
            "Accept-Language": "en, *;q=0.5",
        }
        params = {
            "q": q,
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 6,
        }

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url, params=params, headers=headers)
                if res.status_code == 200:
                    results = []
                    for item in res.json():
                        addr = item.get("address", {})
                        city = (
                            addr.get("city")
                            or addr.get("town")
                            or addr.get("village")
                            or addr.get("municipality")
                            or addr.get("suburb")
                            or addr.get("hamlet")
                            or item.get("name")
                            or None
                        )
                        district = addr.get("county") or addr.get("state_district") or None
                        state = addr.get("state") or addr.get("province") or None
                        region = state
                        country = addr.get("country") or None
                        country_code = addr.get("country_code", "").upper() or None
                        region_code = addr.get("ISO3166-2-lvl4") or None

                        item_lat = float(item.get("lat"))
                        item_lon = float(item.get("lon"))
                        timezone_name = await GeocodingProvider.resolve_timezone(item_lat, item_lon)

                        results.append({
                            "latitude": item_lat,
                            "longitude": item_lon,
                            "accuracy": None,
                            "city": city,
                            "district": district,
                            "state": state,
                            "region": region,
                            "country": country,
                            "countryCode": country_code,
                            "regionCode": region_code,
                            "timezone": timezone_name,
                            "displayName": item.get("display_name", f"{city or 'Location'}, {country or ''}"),
                            "isUserLocation": False,
                        })
                    return results
        except Exception:
            pass

        return []
