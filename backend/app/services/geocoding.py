"""
UrbanPulse Location Resolution & Geocoding Service
Converts GPS coordinates into reverse-geocoded cities, and supports manual search queries for any location worldwide.
"""

from typing import Any, Dict, List, Optional
import httpx
import re
from app.core.config import settings


class GeocodingService:
    @staticmethod
    async def resolve_coordinates(latitude: float, longitude: float) -> Dict[str, Any]:
        """
        Reverse-geocode coordinates to city, district, state/region, country, and timezone.
        """
        url = "https://nominatim.openstreetmap.org/reverse"
        headers = {"User-Agent": settings.NOMINATIM_USER_AGENT}
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
                        or "Unknown City"
                    )
                    district = addr.get("county") or addr.get("state_district") or ""
                    region = addr.get("state") or addr.get("province") or ""
                    country = addr.get("country") or ""

                    return {
                        "latitude": latitude,
                        "longitude": longitude,
                        "city": city,
                        "district": district,
                        "region": region,
                        "country": country,
                        "displayName": data.get("display_name", f"{city}, {country}"),
                        "isUserLocation": True,
                    }
        except Exception:
            pass

        return {
            "latitude": latitude,
            "longitude": longitude,
            "city": f"{latitude:.3f}°N",
            "district": "",
            "region": "",
            "country": f"{longitude:.3f}°E",
            "displayName": f"Location ({latitude:.4f}, {longitude:.4f})",
            "isUserLocation": True,
        }

    @staticmethod
    async def search_location(query: str) -> List[Dict[str, Any]]:
        """
        Search for city, address, landmark, or coordinates worldwide.
        """
        query_clean = query.strip()

        # Check if coordinates input like "12.2958, 76.6394"
        coord_match = re.match(r"^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$", query_clean)
        if coord_match:
            lat = float(coord_match.group(1))
            lon = float(coord_match.group(2))
            resolved = await GeocodingService.resolve_coordinates(lat, lon)
            resolved["isUserLocation"] = False
            return [resolved]

        url = "https://nominatim.openstreetmap.org/search"
        headers = {"User-Agent": settings.NOMINATIM_USER_AGENT}
        params = {
            "q": query_clean,
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 5,
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
                            or item.get("name")
                            or "Location"
                        )
                        district = addr.get("county") or addr.get("state_district") or ""
                        region = addr.get("state") or addr.get("province") or ""
                        country = addr.get("country") or ""

                        results.append({
                            "latitude": float(item.get("lat")),
                            "longitude": float(item.get("lon")),
                            "city": city,
                            "district": district,
                            "region": region,
                            "country": country,
                            "displayName": item.get("display_name", f"{city}, {country}"),
                            "isUserLocation": False,
                        })
                    return results
        except Exception:
            pass

        return []
