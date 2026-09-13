"""
UrbanPulse Event Fusion & Severity Engine
Normalizes live signals from multiple verified source adapters (USGS, Open-Meteo, Google Traffic, Municipal feeds),
performs deduplication, calculates deterministic 0-100 severity, and computes distance-decayed local risk.
Strict rule: NEVER fabricates fake events. When feeds confirm 0 qualifying incidents, reports EMPTY_VERIFIED.
"""

import math
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import uuid

from app.core.config import settings
from app.services.providers.earthquake_provider import EarthquakeProvider
from app.services.providers.weather_provider import WeatherProvider
from app.services.providers.air_quality_provider import AirQualityProvider
from app.services.google_traffic import GoogleTrafficService
from app.pipelines.live_ingestion.event_ingestion import LiveIngestionPipeline

logger = logging.getLogger("urbanpulse.event_fusion")


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


CANONICAL_CATEGORY_MAP: Dict[str, str] = {
    "TRAFFIC": "TRAFFIC",
    "CONGESTION": "TRAFFIC",
    "ACCIDENT": "ACCIDENT",
    "ROAD_CLOSURE": "ROAD_CLOSURE",
    "WEATHER": "WEATHER_ALERT",
    "WEATHER_ALERT": "WEATHER_ALERT",
    "WEATHER ALERT": "WEATHER_ALERT",
    "METEOROLOGICAL": "WEATHER_ALERT",
    "STORM": "STORM",
    "CYCLONE": "CYCLONE",
    "THUNDERSTORM": "WEATHER_ALERT",
    "HEAVY_RAIN": "WEATHER_ALERT",
    "AIR_QUALITY_ALERT": "WEATHER_ALERT",
    "FLOOD": "FLOOD",
    "EARTHQUAKE": "EARTHQUAKE",
    "SEISMIC": "EARTHQUAKE",
    "POTHOLE": "POTHOLE",
    "THEFT": "THEFT",
    "BURGLARY": "THEFT",
    "FALLEN_TREE": "FALLEN_TREE",
    "FIRE": "FIRE",
}


def matches_event_category(event_type: str, requested_category: Optional[str]) -> bool:
    """Matches eventType against requested filter tab, normalizing canonical names."""
    if not requested_category or requested_category.upper() == "ALL":
        return True
    e_norm = (event_type or "").upper().replace(" ", "_").strip()
    r_norm = requested_category.upper().replace(" ", "_").strip()
    if e_norm == r_norm:
        return True
    e_canon = CANONICAL_CATEGORY_MAP.get(e_norm, e_norm)
    r_canon = CANONICAL_CATEGORY_MAP.get(r_norm, r_norm)
    if e_canon == r_canon:
        return True
    if r_norm in ("WEATHER_ALERT", "WEATHER"):
        return e_norm in ("WEATHER_ALERT", "STORM", "CYCLONE", "HEAVY_RAIN", "THUNDERSTORM", "AIR_QUALITY_ALERT")
    if r_norm == "TRAFFIC":
        return e_norm in ("TRAFFIC", "ACCIDENT", "ROAD_CLOSURE", "CONGESTION")
    return False


class EventFusionService:
    # In-memory regional cache for fast retrieval and sync fallback
    _cache: Dict[str, List[Dict[str, Any]]] = {}

    @classmethod
    async def get_live_events_near_location(
        cls,
        center_lat: float,
        center_lon: float,
        radius_km: float = 50.0,
        city_name: str = "Local Area",
        hours: int = 24,
        category: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Gathers live verified telemetry across multiple authentic providers:
          1. USGS Earthquakes
          2. Open-Meteo Severe Weather (Thunderstorms, Violent Rain, Gale Gusts, Heavy Snow)
          3. Open-Meteo Hazardous Air Quality advisories
          4. Google Routes API v2 Traffic congestion bottlenecks
          5. LiveIngestionPipeline civic & sensor incident streams
        Returns semantically accurate status: AVAILABLE | EMPTY_VERIFIED | NO_COVERAGE
        """
        now = datetime.now(timezone.utc)
        providers_checked: List[str] = []
        raw_events: List[Dict[str, Any]] = []

        # 1. USGS Earthquakes
        try:
            start_time = (now - timedelta(hours=max(hours, 24))).strftime("%Y-%m-%dT%H:%M:%S")
            quakes = await EarthquakeProvider.get_earthquakes(
                latitude=center_lat,
                longitude=center_lon,
                radius_km=radius_km,
                start_time=start_time,
                min_magnitude=1.5,
            )
            providers_checked.append("USGS Earthquake Hazards")
            for q in quakes:
                raw_events.append(q)
        except Exception as exc:
            logger.warning("USGS Earthquake query error in fusion: %s", exc)

        # 2. Open-Meteo Severe Meteorological Conditions
        try:
            weather = WeatherProvider.get_weather(center_lat, center_lon)
            if weather.get("status") == "AVAILABLE":
                providers_checked.append("Open-Meteo Meteorological")
                curr = weather.get("current", {}) or {}
                w_code = int(curr.get("weatherCode", 0))
                precip_mm = float(curr.get("precipitationMm", 0.0) or 0.0)
                wind_speed = float(curr.get("windSpeedKmh", 0.0) or 0.0)

                is_severe_wx = False
                alert_type = "WEATHER_ALERT"
                alert_title = ""
                alert_desc = ""
                sev = 50

                if 95 <= w_code <= 99:
                    is_severe_wx = True
                    alert_title = f"Thunderstorm & Lightning Warning ({city_name})"
                    alert_desc = f"Active convective thunderstorm activity (WMO code {w_code}) verified across the area. High lightning probability and sudden downdrafts."
                    sev = 82
                elif (80 <= w_code <= 82) or precip_mm >= 25.0:
                    is_severe_wx = True
                    alert_title = f"Torrential Rain & Surface Inundation Advisory ({city_name})"
                    alert_desc = f"Severe localized precipitation ({precip_mm:.1f} mm/hr) causing acute runoff and street-level drainage pooling."
                    sev = 76
                elif wind_speed >= 60.0:
                    is_severe_wx = True
                    alert_title = f"Gale-Force Wind Gust Warning ({city_name})"
                    alert_desc = f"Sustained elevated wind velocity of {wind_speed:.0f} km/h detected. Hazard of branch severance, airborne debris, and minor structural displacement."
                    sev = 68
                elif w_code in (45, 48):
                    is_severe_wx = True
                    alert_title = f"Dense Fog & Restricted Visibility Warning ({city_name})"
                    alert_desc = "Visibility severely degraded by dense atmospheric fog. Motorists advised to reduce corridor travel speeds."
                    sev = 52
                elif 71 <= w_code <= 77:
                    is_severe_wx = True
                    alert_title = f"Sustained Snowfall & Freezing Conditions ({city_name})"
                    alert_desc = f"Active snowfall (WMO {w_code}) causing traction impairment on regional road corridors."
                    sev = 65

                if is_severe_wx:
                    raw_events.append({
                        "eventId": f"OPENMETEO-WX-{int(abs(center_lat)*100)}-{int(abs(center_lon)*100)}-{w_code}",
                        "canonicalEventId": f"CAN-WX-{w_code}",
                        "eventType": alert_type,
                        "title": alert_title,
                        "description": alert_desc,
                        "latitude": round(center_lat, 4),
                        "longitude": round(center_lon, 4),
                        "timestamp": weather.get("lastUpdated") or now.isoformat(),
                        "severity": sev,
                        "confidence": 95,
                        "source": "Open-Meteo",
                        "sourceId": f"WMO-CODE-{w_code}",
                        "status": "VERIFIED",
                        "affectedRadiusKm": min(radius_km, 35.0),
                        "distanceKm": 0.0,
                        "userImpact": "CRITICAL" if sev >= 80 else ("HIGH" if sev >= 65 else "MODERATE"),
                        "metadata": {
                            "weatherCode": w_code,
                            "precipitationMm": precip_mm,
                            "windSpeedKmh": wind_speed,
                            "conditionLabel": curr.get("conditionLabel"),
                        },
                    })
        except Exception as exc:
            logger.warning("Open-Meteo weather evaluation error in fusion: %s", exc)

        # 3. Open-Meteo Hazardous Air Quality Advisories
        try:
            aqi_res = await AirQualityProvider.get_air_quality(center_lat, center_lon)
            if aqi_res.get("status") == "AVAILABLE":
                providers_checked.append("Open-Meteo Atmospheric AQI")
                category_label = aqi_res.get("category", "")
                aqi_val = aqi_res.get("value", 0)
                scale_name = aqi_res.get("scale", "AQI")

                if category_label in ("Poor", "Very Poor", "Severe", "Hazardous", "Unhealthy", "Very Unhealthy"):
                    is_critical = category_label in ("Severe", "Hazardous", "Very Poor", "Very Unhealthy")
                    sev = 86 if is_critical else 64
                    raw_events.append({
                        "eventId": f"OPENMETEO-AQI-{int(abs(center_lat)*100)}-{int(abs(center_lon)*100)}-{aqi_val}",
                        "canonicalEventId": f"CAN-AQI-{aqi_val}",
                        "eventType": "WEATHER_ALERT",
                        "title": f"Atmospheric Pollution Health Advisory ({category_label} Air Quality)",
                        "description": f"Verified particulate elevation: {aqi_res.get('pollutant')} index measured at {aqi_val} ({scale_name}). Outdoor exertion advisory in effect for sensitive demographics.",
                        "latitude": round(center_lat, 4),
                        "longitude": round(center_lon, 4),
                        "timestamp": aqi_res.get("observedAt") or now.isoformat(),
                        "severity": sev,
                        "confidence": 92,
                        "source": "Open-Meteo",
                        "sourceId": "CAMS-SILAM-AQI",
                        "status": "VERIFIED",
                        "affectedRadiusKm": min(radius_km, 40.0),
                        "distanceKm": 0.0,
                        "userImpact": "CRITICAL" if is_critical else "HIGH",
                        "metadata": {
                            "aqiValue": aqi_val,
                            "aqiScale": scale_name,
                            "category": category_label,
                            "pollutant": aqi_res.get("pollutant"),
                            "breakdown": aqi_res.get("breakdown"),
                        },
                    })
        except Exception as exc:
            logger.warning("Open-Meteo air quality evaluation error in fusion: %s", exc)

        # 4. Google Routes API v2 Traffic Congestion & Disruption
        try:
            traffic_res = await GoogleTrafficService.get_traffic_summary(center_lat, center_lon, radius_km)
            if traffic_res.get("status") == "AVAILABLE":
                providers_checked.append("Google Routes Traffic")
                traffic_status = traffic_res.get("trafficStatus", "NORMAL")
                delay_minutes = traffic_res.get("delayMinutes", 0)
                corridor = traffic_res.get("corridor") or "Primary Transit Corridor"

                if traffic_status in ("HEAVY", "SEVERE") or delay_minutes >= 12:
                    sev = 82 if traffic_status == "SEVERE" else 64
                    # Anchor marker slightly offset along corridor for map visibility
                    offset_lat = center_lat + 0.005
                    offset_lon = center_lon + 0.004
                    raw_events.append({
                        "eventId": f"GMAPS-TRAFFIC-{int(abs(center_lat)*100)}-{int(abs(center_lon)*100)}-{delay_minutes}",
                        "canonicalEventId": f"CAN-TRF-{delay_minutes}",
                        "eventType": "TRAFFIC",
                        "title": f"Corridor Congestion & Chokepoints ({corridor})",
                        "description": f"Verified live transit telemetry shows {traffic_status.lower()} congestion with +{delay_minutes}m delay across {corridor}.",
                        "latitude": round(offset_lat, 5),
                        "longitude": round(offset_lon, 5),
                        "timestamp": traffic_res.get("lastUpdated") or now.isoformat(),
                        "severity": sev,
                        "confidence": 95,
                        "source": "Google Maps",
                        "sourceId": "GMAPS-ROUTES-V2",
                        "status": "VERIFIED",
                        "affectedRadiusKm": min(radius_km, 6.0),
                        "distanceKm": round(calculate_haversine_distance(center_lat, center_lon, offset_lat, offset_lon), 1),
                        "userImpact": "HIGH" if sev >= 75 else "MODERATE",
                        "metadata": {
                            "delayMinutes": delay_minutes,
                            "delayRatio": traffic_res.get("delayRatio"),
                            "corridor": corridor,
                            "speedIntervals": traffic_res.get("speedIntervals"),
                        },
                    })
        except Exception as exc:
            logger.warning("Google traffic evaluation error in fusion: %s", exc)

        # 5. Live Ingestion Store (civic, citizen, sensor signals)
        try:
            pipeline_events = LiveIngestionPipeline.get_recent_updates(center_lat, center_lon, radius_km)
            if pipeline_events:
                providers_checked.append("Civic Incident Dispatch")
                for pe in pipeline_events:
                    raw_events.append(pe)
        except Exception as exc:
            logger.warning("Pipeline incident retrieval error in fusion: %s", exc)

        # 6. Fallback to Demo Seed templates ONLY if explicitly configured in demo mode
        if settings.DEMO_MODE and not raw_events:
            providers_checked.append("Demo Simulation Engine")
            raw_events = cls._generate_demo_events(center_lat, center_lon, radius_km, city_name, now)

        # 7. Spatial filtering and deduplication
        deduped: List[Dict[str, Any]] = []
        seen_ids = set()

        for ev in raw_events:
            ev_id = ev.get("eventId") or ev.get("id") or str(uuid.uuid4())
            if ev_id in seen_ids:
                continue
            seen_ids.add(ev_id)

            ev_lat = float(ev.get("latitude", center_lat))
            ev_lon = float(ev.get("longitude", center_lon))
            dist = calculate_haversine_distance(center_lat, center_lon, ev_lat, ev_lon)

            if dist <= radius_km:
                # Ensure distanceKm is accurate
                ev["distanceKm"] = round(dist, 1)

                # Filter by canonical category if specified
                if matches_event_category(ev.get("eventType", ""), category):
                    deduped.append(ev)

        # Cache events under geographic key
        cache_key = f"{round(center_lat, 2)}:{round(center_lon, 2)}"
        cls._cache[cache_key] = deduped

        # Determine semantic collection status
        if deduped:
            status = "AVAILABLE"
        elif providers_checked:
            status = "EMPTY_VERIFIED"
        else:
            status = "NO_COVERAGE"

        return {
            "status": status,
            "events": deduped,
            "count": len(deduped),
            "providersChecked": providers_checked,
        }

    @classmethod
    def get_events_near_location(
        cls,
        center_lat: float,
        center_lon: float,
        radius_km: float = 50.0,
        city_name: str = "Local Area",
    ) -> List[Dict[str, Any]]:
        """
        Synchronous query for existing fused/cached events near the center coordinates.
        Preserves compatibility with sync callers (routing, road assessment).
        """
        cache_key = f"{round(center_lat, 2)}:{round(center_lon, 2)}"
        if cache_key in cls._cache:
            return cls._cache[cache_key]

        # Check LiveIngestionPipeline in-memory store
        try:
            cached = LiveIngestionPipeline.get_recent_updates(center_lat, center_lon, radius_km)
            if cached:
                return cached
        except Exception:
            pass

        if settings.DEMO_MODE:
            now = datetime.now(timezone.utc)
            return cls._generate_demo_events(center_lat, center_lon, radius_km, city_name, now)

        return []

    @classmethod
    def _generate_demo_events(
        cls,
        center_lat: float,
        center_lon: float,
        radius_km: float,
        city_name: str,
        now: datetime,
    ) -> List[Dict[str, Any]]:
        """Generates dynamic seed templates only when DEMO_MODE=True."""
        demo_templates = [
            {
                "event_id": "EVT-ACC-01",
                "canonical_event_id": "CAN-ACC-901",
                "event_type": "ACCIDENT",
                "title": f"Multi-vehicle collision near arterial corridor ({city_name})",
                "description": "Two passenger vehicles collided blocking 2 inbound lanes. Towing service on route.",
                "d_lat": 0.012,
                "d_lon": -0.010,
                "time_offset_min": 14,
                "severity": 74,
                "confidence": 92,
                "source": "Traffic Camera CV",
                "source_id": "CAM-CORRIDOR-08",
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
                "d_lat": -0.018,
                "d_lon": 0.015,
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
                "event_id": "EVT-TRF-04",
                "canonical_event_id": "CAN-TRF-110",
                "event_type": "TRAFFIC",
                "title": "Heavy bottleneck and chokepoint congestion",
                "description": "Average transit speed reduced to 8 km/h due to ongoing utility maintenance.",
                "d_lat": -0.010,
                "d_lon": -0.025,
                "time_offset_min": 110,
                "severity": 65,
                "confidence": 95,
                "source": "Google Maps",
                "source_id": "GMAPS-TRAFFIC-LIVE",
                "status": "VERIFIED",
                "affected_radius_km": 3.0,
                "metadata": {"delayMinutes": 35},
            },
        ]

        resolved = []
        for raw in demo_templates:
            ev_lat = center_lat + raw["d_lat"]
            ev_lon = center_lon + raw["d_lon"]
            dist = calculate_haversine_distance(center_lat, center_lon, ev_lat, ev_lon)
            if dist <= radius_km:
                dist_factor = max(0.1, 1.0 - (dist / radius_km))
                local_risk = int(raw["severity"] * dist_factor)
                user_impact = "CRITICAL" if local_risk >= 70 else ("HIGH" if local_risk >= 50 else "MODERATE")
                event_time = now - timedelta(minutes=raw["time_offset_min"])
                resolved.append({
                    "eventId": raw["event_id"],
                    "canonicalEventId": raw["canonical_event_id"],
                    "eventType": raw["event_type"],
                    "title": raw["title"],
                    "description": raw["description"],
                    "latitude": round(ev_lat, 5),
                    "longitude": round(ev_lon, 5),
                    "timestamp": event_time.isoformat(),
                    "severity": raw["severity"],
                    "confidence": raw["confidence"],
                    "source": "Demo Data",
                    "sourceId": f"DEMO-{raw['source_id']}",
                    "status": raw["status"],
                    "affectedRadiusKm": raw["affected_radius_km"],
                    "distanceKm": round(dist, 1),
                    "userImpact": user_impact,
                    "metadata": raw["metadata"],
                })
        return resolved
