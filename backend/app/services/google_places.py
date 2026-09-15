"""
UrbanPulse Google Places Service
Fetches verified points of interest, attractions, and activities using Google Places API.
Strictly returns real Google Places data or verified NO_NEARBY_RESULTS.
Never fabricates places, reviews, or links.
"""

from typing import Any, Dict, List, Optional
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger("urbanpulse.places")


class GooglePlacesService:
    @classmethod
    async def get_nearby_activities(
        cls,
        lat: float,
        lon: float,
        radius_meters: int = 2500,
        query_type: str = "tourist_attraction",
    ) -> Dict[str, Any]:
        """
        Queries Google Places Nearby Search for real-world activities, attractions, and points of interest.
        Returns strictly genuine Google Places data or NO_NEARBY_RESULTS.
        """
        api_key = settings.GOOGLE_MAPS_API_KEY or settings.GOOGLE_API_KEY
        if not api_key:
            return {
                "status": "UNAVAILABLE",
                "message": "Google Places API key is not configured.",
                "activities": [],
            }

        url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        params = {
            "location": f"{lat},{lon}",
            "radius": min(radius_meters, 5000),
            "type": query_type,
            "key": api_key,
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url, params=params)
                if res.status_code != 200:
                    logger.warning(f"Google Places API responded with HTTP {res.status_code}")
                    return {
                        "status": "ERROR",
                        "message": f"Google Places API returned HTTP {res.status_code}",
                        "activities": [],
                    }

                data = res.json()
                api_status = data.get("status")
                if api_status in ("ZERO_RESULTS", "NOT_FOUND"):
                    # Fallback try point_of_interest if tourist_attraction was empty
                    if query_type == "tourist_attraction":
                        params["type"] = "point_of_interest"
                        res2 = await client.get(url, params=params)
                        if res2.status_code == 200:
                            data2 = res2.json()
                            if data2.get("status") == "OK" and data2.get("results"):
                                return cls._format_results(data2.get("results", []))

                    return {
                        "status": "NO_NEARBY_RESULTS",
                        "message": "No verified tourist attractions or activities found within the active radius.",
                        "activities": [],
                    }

                if api_status != "OK":
                    return {
                        "status": "UNAVAILABLE",
                        "message": f"Places feed status: {api_status}",
                        "activities": [],
                    }

                return cls._format_results(data.get("results", []))

        except Exception as e:
            logger.error(f"Failed to query Google Places Nearby Search: {e}")
            return {
                "status": "ERROR",
                "message": "Network error while connecting to Google Places feed.",
                "activities": [],
            }

    @classmethod
    def _format_results(cls, raw_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        activities = []
        for p in raw_results[:8]:
            activities.append({
                "placeId": p.get("place_id"),
                "name": p.get("name"),
                "rating": p.get("rating"),
                "userRatingsTotal": p.get("user_ratings_total"),
                "vicinity": p.get("vicinity") or "",
                "types": [
                    t.replace("_", " ")
                    for t in p.get("types", [])
                    if t not in ("point_of_interest", "establishment")
                ][:3],
                "latitude": p.get("geometry", {}).get("location", {}).get("lat"),
                "longitude": p.get("geometry", {}).get("location", {}).get("lng"),
            })

        return {
            "status": "AVAILABLE",
            "count": len(activities),
            "activities": activities,
        }
