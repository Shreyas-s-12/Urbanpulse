"""
UrbanPulse Google Traffic Service
Fetches and normalizes real-time Google Traffic conditions from Google Routes API v2
using TRAFFIC_AWARE_OPTIMAL routing and TRAFFIC_ON_POLYLINE speed readings.
Never hallucinates, mocks, or fabricates traffic data.
"""

from typing import Any, Dict, List, Optional
import math
import logging
from datetime import datetime, timezone
import httpx
from app.core.config import settings

logger = logging.getLogger("urbanpulse.traffic")


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def parse_duration_seconds(duration_str: Optional[str]) -> int:
    if not duration_str:
        return 0
    clean = duration_str.rstrip("s").strip()
    try:
        return int(float(clean))
    except (ValueError, TypeError):
        return 0


class GoogleTrafficService:
    @staticmethod
    async def get_traffic_summary(
        latitude: float,
        longitude: float,
        radius_km: float = 50.0,
    ) -> Dict[str, Any]:
        """
        Queries Google Routes API for live traffic conditions around the specified coordinates.
        Uses TRAFFIC_AWARE_OPTIMAL and TRAFFIC_ON_POLYLINE to extract authentic congestion telemetry.
        """
        api_key = settings.GOOGLE_MAPS_API_KEY or settings.GOOGLE_API_KEY
        if not api_key or api_key == "your-google-maps-api-key":
            logger.warning(
                "Google Traffic unavailable: No API key configured. location=(%.4f, %.4f)",
                latitude,
                longitude,
            )
            return {
                "status": "UNAVAILABLE",
                "trafficStatus": "UNAVAILABLE",
                "label": "UNAVAILABLE",
                "delayMinutes": 0,
                "delayRatio": 1.0,
                "detail": "No verified Google traffic data available for this area",
                "reason": "Google API key unconfigured",
                "location": {"latitude": latitude, "longitude": longitude},
                "radiusKm": radius_km,
                "source": "Google Routes API",
                "lastUpdated": datetime.now(timezone.utc).isoformat(),
            }

        # Calculate a representative transit corridor across the local urban area
        # Using ~4km span scaled by radius, aligned with local road network
        corridor_span_km = min(8.0, max(3.0, radius_km * 0.12))
        cos_lat = max(0.2, math.cos(math.radians(latitude)))
        delta_lat = (corridor_span_km / 2.0) / 111.0
        delta_lon = (corridor_span_km / 2.0) / (111.0 * cos_lat)

        # Origin slightly SW, destination slightly NE across the center
        origin_lat = round(latitude - delta_lat, 6)
        origin_lon = round(longitude - delta_lon, 6)
        dest_lat = round(latitude + delta_lat, 6)
        dest_lon = round(longitude + delta_lon, 6)

        url = "https://routes.googleapis.com/directions/v2:computeRoutes"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": (
                "routes.duration,"
                "routes.staticDuration,"
                "routes.distanceMeters,"
                "routes.travelAdvisory.speedReadingIntervals,"
                "routes.description"
            ),
        }

        payload: Dict[str, Any] = {
            "origin": {
                "location": {
                    "latLng": {
                        "latitude": origin_lat,
                        "longitude": origin_lon,
                    }
                }
            },
            "destination": {
                "location": {
                    "latLng": {
                        "latitude": dest_lat,
                        "longitude": dest_lon,
                    }
                }
            },
            "travelMode": "DRIVE",
            "routingPreference": "TRAFFIC_AWARE_OPTIMAL",
            "extraComputations": ["TRAFFIC_ON_POLYLINE"],
        }

        logger.info(
            "Fetching Google Traffic telemetry: provider=GoogleRoutes location=(%.4f, %.4f) radius=%.1f corridor=%.1fkm",
            latitude,
            longitude,
            radius_km,
            corridor_span_km,
        )

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=headers)
        except Exception as exc:
            logger.error(
                "Google Traffic HTTP connection error: location=(%.4f, %.4f) error=%s",
                latitude,
                longitude,
                str(exc),
            )
            return {
                "status": "UNAVAILABLE",
                "trafficStatus": "UNAVAILABLE",
                "label": "UNAVAILABLE",
                "delayMinutes": 0,
                "delayRatio": 1.0,
                "detail": "No verified Google traffic data available for this area",
                "reason": f"Connection error: {str(exc)}",
                "location": {"latitude": latitude, "longitude": longitude},
                "radiusKm": radius_km,
                "source": "Google Routes API",
                "lastUpdated": datetime.now(timezone.utc).isoformat(),
            }

        logger.info(
            "Google Traffic response received: status_code=%d location=(%.4f, %.4f)",
            res.status_code,
            latitude,
            longitude,
        )

        if res.status_code != 200:
            logger.warning(
                "Google Routes API traffic query returned error (%d): %s",
                res.status_code,
                res.text[:200],
            )
            return {
                "status": "UNAVAILABLE",
                "trafficStatus": "UNAVAILABLE",
                "label": "UNAVAILABLE",
                "delayMinutes": 0,
                "delayRatio": 1.0,
                "detail": "No verified Google traffic data available for this area",
                "reason": f"Google Routes API returned {res.status_code}",
                "location": {"latitude": latitude, "longitude": longitude},
                "radiusKm": radius_km,
                "source": "Google Routes API",
                "lastUpdated": datetime.now(timezone.utc).isoformat(),
            }

        data = res.json()
        routes = data.get("routes", [])

        if not routes:
            logger.info("No driving route available for traffic analysis at (%.4f, %.4f)", latitude, longitude)
            return {
                "status": "UNAVAILABLE",
                "trafficStatus": "UNAVAILABLE",
                "label": "UNAVAILABLE",
                "delayMinutes": 0,
                "delayRatio": 1.0,
                "detail": "No verified Google traffic data available for this area",
                "reason": "No drivable corridors in selected coordinates",
                "location": {"latitude": latitude, "longitude": longitude},
                "radiusKm": radius_km,
                "source": "Google Routes API",
                "lastUpdated": datetime.now(timezone.utc).isoformat(),
            }

        primary_route = routes[0]
        duration_sec = parse_duration_seconds(primary_route.get("duration"))
        static_duration_sec = parse_duration_seconds(primary_route.get("staticDuration"))
        corridor_name = primary_route.get("description") or "Primary Transit Corridor"

        # Extract speed intervals
        travel_advisory = primary_route.get("travelAdvisory", {})
        speed_intervals = travel_advisory.get("speedReadingIntervals", [])

        normal_count = sum(1 for i in speed_intervals if i.get("speed") == "NORMAL")
        slow_count = sum(1 for i in speed_intervals if i.get("speed") == "SLOW")
        jam_count = sum(1 for i in speed_intervals if i.get("speed") == "TRAFFIC_JAM")

        # Delay calculations
        delay_seconds = max(0, duration_sec - static_duration_sec) if static_duration_sec > 0 else 0
        delay_minutes = round(delay_seconds / 60.0)
        delay_ratio = round(duration_sec / max(static_duration_sec, 1), 2) if static_duration_sec > 0 else 1.0

        # Deterministic status mapping according to verified Google traffic telemetry
        if delay_ratio >= 1.60 or jam_count >= 3:
            traffic_status = "SEVERE"
        elif delay_ratio >= 1.25 or jam_count >= 1:
            traffic_status = "HEAVY"
        elif delay_ratio >= 1.08 or slow_count >= 1:
            traffic_status = "MODERATE"
        else:
            traffic_status = "NORMAL"

        # Detail description
        if jam_count > 0:
            detail = f"{jam_count} bottleneck zone{'' if jam_count == 1 else 's'} (+{delay_minutes}m delay)"
        elif slow_count > 0:
            detail = f"{slow_count} moderate slowdown{'' if slow_count == 1 else 's'} (+{delay_minutes}m delay)"
        elif delay_minutes > 0:
            detail = f"+{delay_minutes}m delay across key corridors"
        else:
            detail = "Free-flowing traffic conditions"

        logger.info(
            "Parsed Google Traffic: status=%s delay=%dm ratio=%.2f slow=%d jams=%d",
            traffic_status,
            delay_minutes,
            delay_ratio,
            slow_count,
            jam_count,
        )

        return {
            "status": "AVAILABLE",
            "trafficStatus": traffic_status,
            "label": traffic_status,
            "delayMinutes": delay_minutes,
            "delayRatio": delay_ratio,
            "detail": detail,
            "corridor": corridor_name,
            "speedIntervals": {
                "normal": normal_count,
                "slow": slow_count,
                "trafficJam": jam_count,
                "total": len(speed_intervals),
            },
            "location": {"latitude": latitude, "longitude": longitude},
            "radiusKm": radius_km,
            "source": "Google Routes API (v2 Traffic-Aware)",
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
        }
