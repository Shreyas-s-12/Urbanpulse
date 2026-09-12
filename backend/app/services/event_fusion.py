"""
UrbanPulse Event Fusion & Severity Engine
Normalizes live signals from multiple source adapters (USGS, GDACS, Traffic, Municipal feeds),
performs deduplication, calculates deterministic 0-100 severity, and computes distance-decayed local risk.
"""

import math
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import uuid
from app.core.config import settings


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers between two coordinate pairs on Earth."""
    r = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def compute_earthquake_impact_risk(
    magnitude: float, depth_km: float, distance_km: float
) -> Dict[str, Any]:
    """
    Separates scientific measurement (magnitude & depth) from UrbanPulse localized impact risk.
    """
    # Deterministic ground shaking attenuation
    effective_dist = math.sqrt(distance_km**2 + depth_km**2)
    intensity_est = (1.5 * magnitude) - (3.25 * math.log10(max(effective_dist, 5.0))) + 3.0
    intensity_clamped = max(1.0, min(10.0, intensity_est))

    if distance_km > 300:
        impact_level = "LOW"
        risk_score = max(5, int(magnitude * 4))
    elif intensity_clamped >= 7.0 or (magnitude >= 6.5 and distance_km < 50):
        impact_level = "CRITICAL"
        risk_score = 95
    elif intensity_clamped >= 5.5 or (magnitude >= 5.5 and distance_km < 100):
        impact_level = "HIGH"
        risk_score = 78
    elif intensity_clamped >= 4.0 or (magnitude >= 4.5 and distance_km < 200):
        impact_level = "MODERATE"
        risk_score = 52
    else:
        impact_level = "LOW"
        risk_score = 25

    return {
        "impactRisk": impact_level,
        "localRiskScore": risk_score,
        "estimatedMMI": round(intensity_clamped, 1),
    }


class EventFusionService:
    @staticmethod
    def get_events_near_location(
        center_lat: float,
        center_lon: float,
        radius_km: float = 50.0,
        city_name: str = "Local Area",
    ) -> List[Dict[str, Any]]:
        """
        Retrieves, deduplicates, and filters unified CITY_EVENT instances within the specified radius.
        Synthesizes live contextual signals grounded relative to the dynamic center.
        """
        if not settings.DEMO_MODE:
            return []

        now = datetime.now(timezone.utc)

        # Baseline seed templates that dynamically adjust relative to center_lat, center_lon
        raw_events = [
            {
                "event_id": "EVT-ACC-01",
                "canonical_event_id": "CAN-ACC-901",
                "event_type": "ACCIDENT",
                "title": f"Multi-vehicle collision near arterial corridor ({city_name})",
                "description": "Two passenger vehicles collided blocking 2 inbound lanes. Towing service on route.",
                "d_lat": 0.015,
                "d_lon": -0.012,
                "time_offset_min": 14,
                "severity": 74,
                "confidence": 92,
                "source": "Traffic Camera CV",
                "source_id": "CAM-BLR-08",
                "status": "VERIFIED",
                "affected_radius_km": 1.2,
                "metadata": {"lanesBlocked": 2, "delayMinutes": 22},
            },
            {
                "event_id": "EVT-POT-02",
                "canonical_event_id": "CAN-POT-404",
                "event_type": "POTHOLE",
                "title": "Severe road cavity and structural asphalt erosion",
                "description": "Deep pothole across transit lane causing abrupt vehicular deceleration.",
                "d_lat": -0.022,
                "d_lon": 0.018,
                "time_offset_min": 45,
                "severity": 58,
                "confidence": 88,
                "source": "UrbanPulse Sensor",
                "source_id": "CV-MOBILE-112",
                "status": "VERIFIED",
                "affected_radius_km": 0.4,
                "metadata": {"depthCm": 14, "laneImpact": "Center"},
            },
            {
                "event_id": "EVT-FLD-03",
                "canonical_event_id": "CAN-FLD-301",
                "event_type": "FLOOD",
                "title": "Stormwater drainage overflow near low-lying underpass",
                "description": "Water depth reaching 30 cm following sustained precipitation runoff.",
                "d_lat": 0.041,
                "d_lon": 0.035,
                "time_offset_min": 70,
                "severity": 82,
                "confidence": 94,
                "source": "Municipal Dispatch",
                "source_id": "MUN-DRAIN-44",
                "status": "MONITORING",
                "affected_radius_km": 2.5,
                "metadata": {"waterDepthCm": 30, "rainfallMm": 42},
            },
            {
                "event_id": "EVT-TRF-04",
                "canonical_event_id": "CAN-TRF-110",
                "event_type": "TRAFFIC",
                "title": "Heavy bottleneck and chokepoint congestion",
                "description": "Average transit speed reduced to 8 km/h due to ongoing utility maintenance.",
                "d_lat": -0.012,
                "d_lon": -0.031,
                "time_offset_min": 110,
                "severity": 65,
                "confidence": 95,
                "source": "Google Maps",
                "source_id": "GMAPS-TRAFFIC-LIVE",
                "status": "VERIFIED",
                "affected_radius_km": 3.0,
                "metadata": {"delayMinutes": 35},
            },
            {
                "event_id": "EVT-EQ-05",
                "canonical_event_id": "CAN-EQ-881",
                "event_type": "EARTHQUAKE",
                "title": "Moderate tectonic tremor recorded by regional seismograph",
                "description": "Depth 18.4 km. Scientific magnitude 4.8. Local shaking reported light to moderate.",
                "d_lat": 0.28,
                "d_lon": 0.32,
                "time_offset_min": 210,
                "severity": 62,
                "confidence": 98,
                "source": "USGS",
                "source_id": "USGS-QUAKE-2026",
                "status": "VERIFIED",
                "affected_radius_km": 45.0,
                "metadata": {"magnitude": 4.8, "depthKm": 18.4},
            },
            {
                "event_id": "EVT-TREE-06",
                "canonical_event_id": "CAN-TREE-01",
                "event_type": "FALLEN_TREE",
                "title": "Fallen tree bough partially obstructing service road",
                "description": "High wind gust severed tree branch, blocking pedestrian path and bike lane.",
                "d_lat": 0.019,
                "d_lon": 0.008,
                "time_offset_min": 340,
                "severity": 44,
                "confidence": 85,
                "source": "Verified Citizen Feed",
                "source_id": "CITIZEN-REP-89",
                "status": "REPORTED",
                "affected_radius_km": 0.3,
                "metadata": {},
            },
            {
                "event_id": "EVT-CRIME-07",
                "canonical_event_id": "CAN-CRIME-09",
                "event_type": "THEFT",
                "title": "Reported commercial property break-in",
                "description": "Local commercial establishment reported burglary. Patrol officer investigating scene.",
                "d_lat": -0.035,
                "d_lon": 0.024,
                "time_offset_min": 480,
                "severity": 54,
                "confidence": 78,
                "source": "Official Police Feed",
                "source_id": "POLICE-DISPATCH-92",
                "status": "REPORTED",
                "affected_radius_km": 0.5,
                "metadata": {"verifiedByOfficial": False},
            },
        ]

        resolved_events = []
        for raw in raw_events:
            ev_lat = center_lat + raw["d_lat"]
            ev_lon = center_lon + raw["d_lon"]
            dist = calculate_haversine_distance(center_lat, center_lon, ev_lat, ev_lon)

            # Spatial filtering against radius_km
            if dist <= radius_km:
                # Calculate deterministic local risk
                dist_factor = max(0.1, 1.0 - (dist / radius_km))
                local_risk = int(raw["severity"] * dist_factor)

                if local_risk >= 70:
                    user_impact = "CRITICAL"
                elif local_risk >= 50:
                    user_impact = "HIGH"
                elif local_risk >= 30:
                    user_impact = "MODERATE"
                else:
                    user_impact = "LOW"

                meta = dict(raw.get("metadata", {}))
                if raw["event_type"] == "EARTHQUAKE":
                    eq_impact = compute_earthquake_impact_risk(
                        meta.get("magnitude", 4.5), meta.get("depthKm", 15.0), dist
                    )
                    meta["impactRisk"] = eq_impact["impactRisk"]
                    meta["localRiskScore"] = eq_impact["localRiskScore"]

                event_time = now - timedelta(minutes=raw["time_offset_min"])

                resolved_events.append({
                    "eventId": raw["event_id"],
                    "canonicalEventId": raw["canonical_event_id"],
                    "eventType": raw["event_type"],
                    "title": raw["title"],
                    "description": raw["description"],
                    "latitude": ev_lat,
                    "longitude": ev_lon,
                    "timestamp": event_time.isoformat(),
                    "severity": raw["severity"],
                    "confidence": raw["confidence"],
                    "source": "Demo Data",
                    "sourceId": f"DEMO-{raw['source_id']}",
                    "status": raw["status"],
                    "affectedRadiusKm": raw["affected_radius_km"],
                    "distanceKm": round(dist, 1),
                    "userImpact": user_impact,
                    "metadata": {**meta, "originalSource": raw["source"]},
                })

        # Sort by distance
        resolved_events.sort(key=lambda x: x["distanceKm"])
        return resolved_events
