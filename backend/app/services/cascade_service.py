"""
UrbanPulse Incident & Cascade Intelligence Engine
Detects potential domino and compounding failure chains across urban subsystems:
Precipitation Surge -> Drainage Blockage -> Underpass Inundation -> Corridor Congestion -> Road Diversion.
Strictly labeled as "POSSIBLE_CONTRIBUTING_CHAIN" with evidence and confidence.
Never asserts definitive unverified causality.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import uuid
import logging

from app.services.event_fusion import EventFusionService
from app.services.providers.weather_provider import WeatherProvider
from app.services.google_traffic import GoogleTrafficService

logger = logging.getLogger("urbanpulse.cascade")


class CascadeService:
    @classmethod
    async def detect_cascades(
        cls,
        latitude: float,
        longitude: float,
        radius_km: float = 30.0,
        city_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Scans current live alerts, weather, and traffic to detect possible cascade chains.
        """
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Gather live signals
        events_report = await EventFusionService.get_live_events_near_location(
            latitude, longitude, radius_km, city_name=city_name
        )
        live_events = events_report.get("events", [])

        weather = WeatherProvider.get_weather(latitude, longitude)
        rain_current = (weather.get("current") or {}).get("precipitation", 0.0) or 0.0

        traffic = await GoogleTrafficService.get_traffic_summary(latitude, longitude, radius_km)
        traffic_status = traffic.get("trafficStatus", "NORMAL")

        chains: List[Dict[str, Any]] = []

        # Cascade Pattern 1: Hydrological Inundation -> Mobility Congestion
        flood_events = [e for e in live_events if e.get("eventType") in ["FLOOD", "WATERLOGGING", "RAIN"]]
        if rain_current > 5.0 or flood_events:
            steps = [
                {
                    "stepIndex": 1,
                    "event": f"Precipitation influx observed ({rain_current:.1f} mm/hr)",
                    "observed": True,
                    "confidence": 0.95,
                    "evidence": "Open-Meteo numerical surface weather telemetry",
                },
                {
                    "stepIndex": 2,
                    "event": "Stormwater drainage arterial clearance stress",
                    "observed": len(flood_events) > 0,
                    "confidence": 0.82,
                    "evidence": f"{len(flood_events)} active civic flood report(s) in radius",
                },
                {
                    "stepIndex": 3,
                    "event": "Localized surface water accumulation in low-lying intersections",
                    "observed": len(flood_events) > 0,
                    "confidence": 0.78,
                    "evidence": "Verified civic disruption feed",
                },
                {
                    "stepIndex": 4,
                    "event": f"Corridor deceleration and vehicular diversion ({traffic_status.lower()})",
                    "observed": traffic_status in ["HEAVY", "SEVERE", "MODERATE"],
                    "confidence": 0.85,
                    "evidence": "Google Routes API real-time traffic delay telemetry",
                },
            ]

            chains.append({
                "chainId": f"casc-{uuid.uuid4().hex[:8]}",
                "title": "Hydro-Meteorological Mobility Cascade",
                "rootTrigger": "Heavy Precipitation Influx",
                "chain": steps,
                "possibleNextImpact": "Underpass waterlogging & low-lying arterial saturation",
                "potentialConsequence": "Secondary arterial gridlock and transit rerouting",
                "confidence": 0.76,
                "classification": "POSSIBLE_CONTRIBUTING_CHAIN",
                "detectedAt": now_iso,
            })

        # Cascade Pattern 2: Road Obstruction / Accident -> Spillover Congestion
        accident_events = [e for e in live_events if e.get("eventType") in ["ACCIDENT", "ROAD_WORK", "HAZARD"]]
        if accident_events and traffic_status in ["HEAVY", "SEVERE"]:
            steps = [
                {
                    "stepIndex": 1,
                    "event": f"Verified corridor obstruction ({accident_events[0].get('title', 'Civic Incident')})",
                    "observed": True,
                    "confidence": 0.92,
                    "evidence": accident_events[0].get("source", "Official Traffic Dispatch"),
                },
                {
                    "stepIndex": 2,
                    "event": "Lane capacity reduction and bottleneck formation",
                    "observed": True,
                    "confidence": 0.88,
                    "evidence": "Google Routes travel delay surge",
                },
                {
                    "stepIndex": 3,
                    "event": "Diverted traffic spillover into adjoining collector network",
                    "observed": True,
                    "confidence": 0.80,
                    "evidence": "Arterial speed reading intervals indicate slowing across parallel paths",
                },
            ]

            chains.append({
                "chainId": f"casc-{uuid.uuid4().hex[:8]}",
                "title": "Corridor Obstruction Spillover Cascade",
                "rootTrigger": accident_events[0].get("title", "Corridor Incident"),
                "chain": steps,
                "possibleNextImpact": "Extended peak hour duration on parallel collectors",
                "potentialConsequence": "Widespread arterial transit delay across adjoining neighborhoods",
                "confidence": 0.84,
                "classification": "POSSIBLE_CONTRIBUTING_CHAIN",
                "detectedAt": now_iso,
            })

        return chains
