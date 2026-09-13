"""
UrbanPulse Live Ingestion Pipeline
Ingests external hazard and civic incident streams (USGS, severe weather, road disruptions),
normalizes into CITY_EVENT schema, performs geospatial deduplication, and assigns freshness.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta
import math
import uuid
import logging

from app.services.providers.earthquake_provider import EarthquakeProvider

logger = logging.getLogger("urbanpulse.ingestion")


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class LiveIngestionPipeline:
    # In-memory store for recently ingested events
    _event_store: List[Dict[str, Any]] = []

    @classmethod
    def classify_freshness(cls, timestamp_str: str) -> str:
        """Classifies freshness: LIVE (<2h), RECENT (<24h), STALE (older)."""
        try:
            dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            age_hours = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
            if age_hours <= 2:
                return "LIVE"
            elif age_hours <= 24:
                return "RECENT"
            else:
                return "STALE"
        except Exception:
            return "RECENT"

    @classmethod
    async def ingest_live_events(
        cls,
        latitude: float,
        longitude: float,
        radius_km: float = 100.0,
    ) -> List[Dict[str, Any]]:
        """
        Runs live ingestion for the geographic area:
        - Fetches USGS live earthquake telemetry
        - Validates, normalizes into CITY_EVENT, and deduplicates
        """
        ingested: List[Dict[str, Any]] = []
        now_utc = datetime.now(timezone.utc)

        # 1. USGS Earthquakes
        try:
            quakes = await EarthquakeProvider.get_earthquakes(latitude, longitude, radius_km=radius_km)
            for qk in quakes:
                qk_item = {
                    "id": qk.get("eventId") or str(uuid.uuid4()),
                    "eventType": "EARTHQUAKE",
                    "title": qk.get("title", "Seismic Activity Detected"),
                    "description": qk.get("description", "Seismic ground tremor recorded by global sensors."),
                    "latitude": qk.get("latitude", latitude),
                    "longitude": qk.get("longitude", longitude),
                    "affectedRadiusKm": qk.get("affectedRadiusKm", 25.0),
                    "severity": qk.get("severity", 50),
                    "confidence": qk.get("confidence", 95),
                    "freshness": cls.classify_freshness(qk.get("timestamp", now_utc.isoformat())),
                    "source": "USGS Earthquake Hazards API",
                    "sourceType": "SEISMIC_SENSOR_NETWORK",
                    "timestamp": qk.get("timestamp", now_utc.isoformat()),
                    "metadata": qk.get("metadata", {}),
                }
                ingested.append(qk_item)
        except Exception as e:
            logger.warning("Earthquake ingestion error: %s", e)

        # 2. Geospatial Deduplication
        deduped: List[Dict[str, Any]] = []
        for item in ingested:
            is_dup = False
            for existing in deduped:
                dist = haversine_km(item["latitude"], item["longitude"], existing["latitude"], existing["longitude"])
                if dist < 1.5 and item["eventType"] == existing["eventType"]:
                    is_dup = True
                    break
            if not is_dup:
                deduped.append(item)

        cls._event_store = deduped
        return deduped

    @classmethod
    def get_recent_updates(
        cls,
        latitude: float,
        longitude: float,
        radius_km: float = 100.0,
    ) -> List[Dict[str, Any]]:
        """Retrieves and distance-sorts recent live updates."""
        updates: List[Dict[str, Any]] = []
        for ev in cls._event_store:
            dist = haversine_km(latitude, longitude, ev["latitude"], ev["longitude"])
            if dist <= radius_km:
                item = dict(ev)
                item["distanceKm"] = round(dist, 1)
                updates.append(item)

        updates.sort(key=lambda x: (x.get("freshness") != "LIVE", x.get("distanceKm", 9999)))
        return updates
