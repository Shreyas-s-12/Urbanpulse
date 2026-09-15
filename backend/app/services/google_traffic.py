"""
UrbanPulse Google Traffic Service
Fetches and normalizes real-time Google Traffic conditions from Google Routes API v2
using TRAFFIC_AWARE_OPTIMAL routing and TRAFFIC_ON_POLYLINE speed readings.
Implements multi-corridor parallel sampling across representative urban axes.
Never hallucinates, mocks, or fabricates traffic data.
"""

from typing import Any, Dict, List, Optional
import math
import logging
import asyncio
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
    @classmethod
    async def _query_corridor(
        cls,
        client: httpx.AsyncClient,
        api_key: str,
        name: str,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
    ) -> Optional[Dict[str, Any]]:
        """Queries Google Routes API for a single corridor and extracts traffic telemetry."""
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
        payload = {
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

        try:
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code != 200:
                logger.debug("Corridor %s failed with status %d: %s", name, res.status_code, res.text[:120])
                return None

            data = res.json()
            routes = data.get("routes", [])
            if not routes:
                return None

            route = routes[0]
            duration_sec = parse_duration_seconds(route.get("duration"))
            static_duration_sec = parse_duration_seconds(route.get("staticDuration"))
            distance_meters = route.get("distanceMeters", 0)
            corridor_desc = route.get("description") or name

            travel_advisory = route.get("travelAdvisory", {})
            speed_intervals = travel_advisory.get("speedReadingIntervals", [])

            normal_count = sum(1 for i in speed_intervals if i.get("speed") == "NORMAL")
            slow_count = sum(1 for i in speed_intervals if i.get("speed") == "SLOW")
            jam_count = sum(1 for i in speed_intervals if i.get("speed") == "TRAFFIC_JAM")

            delay_sec = max(0, duration_sec - static_duration_sec) if static_duration_sec > 0 else 0
            delay_ratio = round(duration_sec / max(static_duration_sec, 1), 2) if static_duration_sec > 0 else 1.0

            return {
                "name": corridor_desc,
                "origin": {"latitude": origin_lat, "longitude": origin_lon},
                "destination": {"latitude": dest_lat, "longitude": dest_lon},
                "distanceMeters": distance_meters,
                "durationSeconds": duration_sec,
                "staticDurationSeconds": static_duration_sec,
                "delaySeconds": delay_sec,
                "delayRatio": delay_ratio,
                "speedIntervals": {
                    "normal": normal_count,
                    "slow": slow_count,
                    "trafficJam": jam_count,
                    "total": len(speed_intervals),
                },
            }
        except Exception as e:
            logger.debug("Corridor query exception for %s: %s", name, e)
            return None

    @classmethod
    async def get_traffic_summary(
        cls,
        latitude: float,
        longitude: float,
        radius_km: float = 50.0,
    ) -> Dict[str, Any]:
        """
        Queries Google Routes API for live traffic conditions around the specified coordinates.
        Samples multiple representative corridors (East-West, North-South, Cross-City Radial)
        in parallel to ensure resilient, truthful coverage without relying on a brittle single vector.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
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
                "level": "UNAVAILABLE",
                "label": "UNAVAILABLE",
                "delayMinutes": 0,
                "averageDelaySeconds": 0,
                "delayRatio": 1.0,
                "detail": "No verified Google traffic data available for this area",
                "reason": "Google API key unconfigured",
                "sampledCorridors": [],
                "coverageType": "NO_COVERAGE",
                "location": {"latitude": latitude, "longitude": longitude},
                "radiusKm": radius_km,
                "provider": "Google Routes API",
                "source": "Google Routes API",
                "observedAt": now_iso,
                "retrievedAt": now_iso,
                "lastUpdated": now_iso,
                "confidence": 0.0,
                "methodology": "Multi-corridor arterial observation attempted via Google Routes API v2.",
            }

        # Calculate representative transit spans scaled by urban radius (3km to 8km)
        corridor_span_km = min(8.0, max(3.0, radius_km * 0.12))
        cos_lat = max(0.2, math.cos(math.radians(latitude)))
        delta_lat = (corridor_span_km / 2.0) / 111.0
        delta_lon = (corridor_span_km / 2.0) / (111.0 * cos_lat)

        corridor_definitions = [
            # 1. East-West Arterial Axis
            (
                "East-West Arterial Axis",
                round(latitude, 6),
                round(longitude - delta_lon, 6),
                round(latitude, 6),
                round(longitude + delta_lon, 6),
            ),
            # 2. North-South Arterial Axis
            (
                "North-South Arterial Axis",
                round(latitude - delta_lat, 6),
                round(longitude, 6),
                round(latitude + delta_lat, 6),
                round(longitude, 6),
            ),
            # 3. Cross-City Radial Axis
            (
                "Cross-City Radial Axis",
                round(latitude - delta_lat * 0.7, 6),
                round(longitude - delta_lon * 0.7, 6),
                round(latitude + delta_lat * 0.7, 6),
                round(longitude + delta_lon * 0.7, 6),
            ),
        ]

        logger.info(
            "Fetching Google Traffic telemetry: provider=GoogleRoutes location=(%.4f, %.4f) radius=%.1f span=%.1fkm",
            latitude,
            longitude,
            radius_km,
            corridor_span_km,
        )

        sampled_corridors: List[Dict[str, Any]] = []
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                tasks = [
                    cls._query_corridor(client, api_key, name, o_lat, o_lon, d_lat, d_lon)
                    for name, o_lat, o_lon, d_lat, d_lon in corridor_definitions
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for res in results:
                    if isinstance(res, dict) and res:
                        sampled_corridors.append(res)
        except Exception as exc:
            logger.error("Google Traffic parallel query error at (%.4f, %.4f): %s", latitude, longitude, exc)

        if not sampled_corridors:
            logger.info("No drivable corridors returned by Google Routes API at (%.4f, %.4f)", latitude, longitude)
            return {
                "status": "UNAVAILABLE",
                "trafficStatus": "UNAVAILABLE",
                "level": "UNAVAILABLE",
                "label": "UNAVAILABLE",
                "delayMinutes": 0,
                "averageDelaySeconds": 0,
                "delayRatio": 1.0,
                "detail": "No drivable corridors in selected coordinates",
                "reason": "No drivable corridors in selected coordinates",
                "sampledCorridors": [],
                "coverageType": "NO_COVERAGE",
                "location": {"latitude": latitude, "longitude": longitude},
                "radiusKm": radius_km,
                "provider": "Google Routes API",
                "source": "Google Routes API",
                "observedAt": now_iso,
                "retrievedAt": now_iso,
                "lastUpdated": now_iso,
                "confidence": 0.0,
                "methodology": "Multi-corridor arterial observation attempted via Google Routes API v2.",
            }

        # Aggregate sampled corridors
        total_delay_sec = sum(c["delaySeconds"] for c in sampled_corridors)
        avg_delay_sec = total_delay_sec // len(sampled_corridors)
        avg_delay_min = round(avg_delay_sec / 60.0)

        avg_ratio = sum(c["delayRatio"] for c in sampled_corridors) / len(sampled_corridors)
        max_ratio = max(c["delayRatio"] for c in sampled_corridors)

        total_normal = sum(c["speedIntervals"]["normal"] for c in sampled_corridors)
        total_slow = sum(c["speedIntervals"]["slow"] for c in sampled_corridors)
        total_jam = sum(c["speedIntervals"]["trafficJam"] for c in sampled_corridors)
        total_intervals = sum(c["speedIntervals"]["total"] for c in sampled_corridors)

        # Deterministic severity mapping
        if max_ratio >= 1.60 or total_jam >= 2:
            traffic_status = "SEVERE"
        elif max_ratio >= 1.25 or total_jam >= 1:
            traffic_status = "HEAVY"
        elif max_ratio >= 1.08 or total_slow >= 1 or avg_delay_min >= 3:
            traffic_status = "MODERATE"
        else:
            traffic_status = "NORMAL"

        if total_jam > 0:
            detail = f"{total_jam} bottleneck zone{'' if total_jam == 1 else 's'} across {len(sampled_corridors)} corridors (+{avg_delay_min}m avg delay)"
        elif total_slow > 0:
            detail = f"{total_slow} moderate slowdown{'' if total_slow == 1 else 's'} across {len(sampled_corridors)} corridors (+{avg_delay_min}m avg delay)"
        elif avg_delay_min > 0:
            detail = f"+{avg_delay_min}m average delay across {len(sampled_corridors)} sampled corridors"
        else:
            detail = f"Free-flowing traffic conditions across {len(sampled_corridors)} monitored corridors"

        confidence = round(min(0.95, 0.70 + 0.08 * len(sampled_corridors)), 2)

        return {
            "status": "AVAILABLE",
            "trafficStatus": traffic_status,
            "level": traffic_status,
            "label": traffic_status,
            "delayMinutes": avg_delay_min,
            "averageDelaySeconds": avg_delay_sec,
            "delayRatio": round(avg_ratio, 2),
            "detail": detail,
            "corridor": sampled_corridors[0]["name"] if sampled_corridors else "Primary Transit Corridor",
            "sampledCorridors": sampled_corridors,
            "coverageType": "SAMPLED_CORRIDORS",
            "speedIntervals": {
                "normal": total_normal,
                "slow": total_slow,
                "trafficJam": total_jam,
                "total": total_intervals,
            },
            "location": {"latitude": latitude, "longitude": longitude},
            "radiusKm": radius_km,
            "provider": "Google Routes API",
            "source": "Google Routes API (v2 Traffic-Aware)",
            "observedAt": now_iso,
            "retrievedAt": now_iso,
            "lastUpdated": now_iso,
            "confidence": confidence,
            "methodology": f"Multi-corridor observation sampling {len(sampled_corridors)} arterial axes via Google Routes API v2 (TRAFFIC_AWARE_OPTIMAL).",
        }
