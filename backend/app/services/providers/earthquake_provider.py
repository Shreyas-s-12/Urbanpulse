"""
UrbanPulse USGS Earthquake Provider Adapter
Integrates directly with the United States Geological Survey (USGS) real-time seismic API.
Calculates local impact risk separated from scientific magnitude.
"""

from typing import Any, Dict, List
import httpx
import math
from datetime import datetime, timezone, timedelta


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def evaluate_impact_risk(magnitude: float, depth_km: float, distance_km: float) -> Dict[str, Any]:
    effective_dist = math.sqrt(distance_km**2 + depth_km**2)
    intensity = (1.5 * magnitude) - (3.25 * math.log10(max(effective_dist, 5.0))) + 3.0
    intensity = max(1.0, min(10.0, intensity))

    if distance_km > 300:
        level = "LOW"
        risk = max(5, int(magnitude * 5))
    elif intensity >= 7.0 or (magnitude >= 6.5 and distance_km < 60):
        level = "CRITICAL"
        risk = 92
    elif intensity >= 5.5 or (magnitude >= 5.0 and distance_km < 120):
        level = "HIGH"
        risk = 74
    elif intensity >= 4.0 or (magnitude >= 4.0 and distance_km < 250):
        level = "MODERATE"
        risk = 48
    else:
        level = "LOW"
        risk = 20

    return {"impactRisk": level, "localRiskScore": risk, "mmi": round(intensity, 1)}


class EarthquakeProvider:
    @staticmethod
    async def get_earthquakes(latitude: float, longitude: float, radius_km: float = 250.0) -> List[Dict[str, Any]]:
        """
        Fetches live earthquake events from USGS within radius in the last 7 days.
        """
        start_time = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
        url = "https://earthquake.usgs.gov/fdsnws/event/1/query"
        params = {
            "format": "geojson",
            "latitude": latitude,
            "longitude": longitude,
            "maxradiuskm": min(radius_km, 500.0),
            "minmagnitude": 2.5,
            "starttime": start_time,
            "limit": 10,
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    data = res.json()
                    features = data.get("features", [])
                    results = []

                    for feat in features:
                        props = feat.get("properties", {})
                        geom = feat.get("geometry", {})
                        coords = geom.get("coordinates", [0, 0, 0])
                        eq_lon = float(coords[0])
                        eq_lat = float(coords[1])
                        depth = float(coords[2]) if len(coords) > 2 else 10.0
                        mag = float(props.get("mag", 3.0))

                        dist = haversine_km(latitude, longitude, eq_lat, eq_lon)
                        impact = evaluate_impact_risk(mag, depth, dist)
                        epoch_ms = props.get("time", 0)
                        eq_time = datetime.fromtimestamp(epoch_ms / 1000.0, timezone.utc).isoformat()

                        results.append({
                            "eventId": f"USGS-{feat.get('id')}",
                            "canonicalEventId": f"CAN-EQ-{feat.get('id')}",
                            "eventType": "EARTHQUAKE",
                            "title": props.get("title") or f"M {mag} Earthquake near {props.get('place')}",
                            "description": f"Magnitude {mag} tectonic event recorded at depth {depth:.1f} km. Shaking impact: {impact['impactRisk']}.",
                            "latitude": eq_lat,
                            "longitude": eq_lon,
                            "timestamp": eq_time,
                            "severity": min(100, int(mag * 14)),
                            "confidence": 98,
                            "source": "USGS",
                            "sourceId": str(feat.get("id")),
                            "status": "VERIFIED",
                            "affectedRadiusKm": round(mag * 8, 1),
                            "distanceKm": round(dist, 1),
                            "userImpact": impact["impactRisk"],
                            "metadata": {
                                "magnitude": mag,
                                "depthKm": round(depth, 1),
                                "impactRisk": impact["impactRisk"],
                                "localRiskScore": impact["localRiskScore"],
                            },
                        })
                    return results
        except Exception:
            pass

        return []
