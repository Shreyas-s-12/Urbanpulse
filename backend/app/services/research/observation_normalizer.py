"""
UrbanPulse Observation Normalizer Service
Transforms heterogeneous provider telemetry streams into the canonical NormalizedObservation schema.
Preserves complete provenance, spatial/temporal resolution, license, freshness, and source trust tier.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import uuid
import re

from app.schemas.research_schema import NormalizedObservation, SourceTrustMetadata


class ObservationNormalizer:
    """Canonical normalizer across all raw provider feeds."""

    @staticmethod
    def _parse_float(val: Any, default: float = 0.0) -> float:
        """Safely parses a float from numbers or strings with unit suffixes like '23.1°C' or '45 km/h'."""
        if val is None:
            return default
        if isinstance(val, (int, float)):
            return float(val)
        try:
            s = str(val).strip()
            match = re.search(r"[-+]?\d*\.?\d+", s)
            if match:
                return float(match.group(0))
            return default
        except Exception:
            return default

    @staticmethod
    def _calc_freshness_minutes(timestamp_iso: Optional[str]) -> float:
        if not timestamp_iso:
            return 0.0
        try:
            ts = datetime.fromisoformat(timestamp_iso.replace("Z", "+00:00"))
            delta = datetime.now(timezone.utc) - ts
            return max(0.0, round(delta.total_seconds() / 60.0, 1))
        except Exception:
            return 5.0

    @classmethod
    def normalize_aqi(cls, raw: Dict[str, Any], lat: float, lon: float) -> NormalizedObservation:
        """Normalizes Open-Meteo CAMS/SILAM air quality telemetry."""
        now_iso = datetime.now(timezone.utc).isoformat()
        obs_ts = raw.get("timestamp") or now_iso
        freshness_m = cls._calc_freshness_minutes(obs_ts)
        val = cls._parse_float(raw.get("value") or raw.get("rawValue"), 0.0)
        norm_val = min(1.0, max(0.0, val / 300.0))  # US AQI standard 0-300 scale

        bbox = raw.get("bbox")
        if bbox:
            w, s, e, n = bbox
            geom = {
                "type": "Polygon",
                "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]
            }
        else:
            geom = {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]}

        status = "AVAILABLE" if raw.get("status") in ("AVAILABLE", "READY") and val > 0 else "NO_COVERAGE"
        if freshness_m > 180:
            status = "STALE"

        return NormalizedObservation(
            id=f"obs-aqi-{uuid.uuid4().hex[:8]}",
            metric="AQI",
            subMetric=raw.get("subMetric") or "CURRENT_AQI",
            lat=round(lat, 5),
            lng=round(lon, 5),
            geometry=geom,
            value=val,
            rawValue=val,
            normalizedValue=round(norm_val, 4),
            unit="AQI (US)",
            timestamp=obs_ts,
            source="Open-Meteo CAMS/SILAM",
            sourceType="MODEL_FORECAST",
            sourceTier="TIER_1_OFFICIAL",
            license="CC-BY 4.0 (Copernicus / Open-Meteo)",
            spatialResolution="~10 km (0.4° Atmospheric Model)",
            temporalResolution="Hourly assimilation",
            coverage=0.94,
            freshness=f"{int(freshness_m)} min ago" if freshness_m > 0 else "LIVE",
            freshnessMinutes=freshness_m,
            confidence=0.92 if freshness_m < 60 else 0.80,
            status=status,
            metadata={
                "pm2_5": raw.get("pm2_5"),
                "pm10": raw.get("pm10"),
                "category": raw.get("category", "MODERATE"),
                "areaName": raw.get("metadata", {}).get("areaName"),
            }
        )

    @classmethod
    def normalize_weather(cls, raw: Dict[str, Any], lat: float, lon: float) -> NormalizedObservation:
        """Normalizes Open-Meteo Global Forecasting weather telemetry."""
        now_iso = datetime.now(timezone.utc).isoformat()
        obs_ts = raw.get("timestamp") or now_iso
        freshness_m = cls._calc_freshness_minutes(obs_ts)
        temp = cls._parse_float(raw.get("temperatureC") or raw.get("temperature"), 22.0)
        precip = cls._parse_float(raw.get("precipitationMm") or raw.get("precipitation"), 0.0)
        wind = cls._parse_float(raw.get("windSpeedKmh") or raw.get("wind_speed"), 0.0)

        # Thermal and precipitation stress composite
        stress = min(100.0, (precip * 6.0) + (wind * 0.9) + (abs(temp - 22.0) * 1.2))
        norm_val = round(stress / 100.0, 4)

        bbox = raw.get("bbox")
        if bbox:
            w, s, e, n = bbox
            geom = {
                "type": "Polygon",
                "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]
            }
        else:
            geom = {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]}

        return NormalizedObservation(
            id=f"obs-weather-{uuid.uuid4().hex[:8]}",
            metric="WEATHER",
            subMetric=raw.get("subMetric") or "PRECIPITATION",
            lat=round(lat, 5),
            lng=round(lon, 5),
            geometry=geom,
            value=round(temp, 1),
            rawValue=round(stress, 1),
            normalizedValue=norm_val,
            unit="°C",
            timestamp=obs_ts,
            source="Open-Meteo Global Forecasting",
            sourceType="MODEL_FORECAST",
            sourceTier="TIER_1_OFFICIAL",
            license="CC-BY 4.0",
            spatialResolution="~25 km (Numerical Forecast Model)",
            temporalResolution="Hourly update cycle",
            coverage=0.98,
            freshness=f"{int(freshness_m)} min ago" if freshness_m > 0 else "LIVE",
            freshnessMinutes=freshness_m,
            confidence=0.94 if freshness_m < 60 else 0.85,
            status="AVAILABLE",
            metadata={
                "temperatureC": temp,
                "precipitationMm": precip,
                "windSpeedKmh": wind,
                "condition": raw.get("conditionLabel", "Clear"),
                "areaName": raw.get("metadata", {}).get("areaName"),
            }
        )

    @classmethod
    def normalize_traffic(cls, raw: Dict[str, Any], lat: float, lon: float) -> NormalizedObservation:
        """Normalizes TomTom Orbis / Google Routes real-time corridor telemetry."""
        now_iso = datetime.now(timezone.utc).isoformat()
        obs_ts = raw.get("timestamp") or now_iso
        freshness_m = cls._calc_freshness_minutes(obs_ts)
        curr_speed = cls._parse_float(raw.get("currentSpeedKmh") or raw.get("value"), 45.0)
        free_flow = cls._parse_float(raw.get("freeFlowSpeedKmh") or raw.get("metadata", {}).get("freeFlowSpeedKmh"), 60.0)
        delay_min = cls._parse_float(raw.get("delayMinutes") or raw.get("metadata", {}).get("delayMinutes"), 0.0)

        # Flow ratio: 0.0 is gridlock, 1.0 is free flow
        flow_ratio = min(1.0, max(0.1, curr_speed / max(10.0, free_flow)))
        norm_val = round(1.0 - flow_ratio, 4)  # 0.0 = safe/free, 1.0 = severe congestion

        geom = raw.get("geometry") or {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]}

        return NormalizedObservation(
            id=f"obs-traffic-{uuid.uuid4().hex[:8]}",
            metric="TRAFFIC",
            subMetric=raw.get("subMetric") or "CONGESTION",
            lat=round(lat, 5),
            lng=round(lon, 5),
            geometry=geom,
            value=round(curr_speed, 1),
            rawValue=round(delay_min, 1),
            normalizedValue=norm_val,
            unit="km/h",
            timestamp=obs_ts,
            source="TomTom Orbis Maps Traffic Flow",
            sourceType="LIVE_TELEMETRY",
            sourceTier="TIER_1_OFFICIAL",
            license="Commercial Telematics Agreement",
            spatialResolution="~500 m Road Segments (Vector Flow)",
            temporalResolution="Real-time 1–2 min polling",
            coverage=0.86,
            freshness=f"{int(freshness_m)} min ago" if freshness_m > 0 else "LIVE",
            freshnessMinutes=freshness_m,
            confidence=0.91 if freshness_m < 15 else 0.75,
            status="AVAILABLE" if raw.get("status") in ("AVAILABLE", "READY") else "NO_COVERAGE",
            metadata={
                "roadName": raw.get("metadata", {}).get("roadName") or raw.get("roadName", "Arterial"),
                "freeFlowSpeedKmh": free_flow,
                "delayMinutes": delay_min,
                "roadCategory": raw.get("metadata", {}).get("roadCategory", "primary"),
            }
        )

    @classmethod
    def normalize_population(cls, raw: Dict[str, Any], lat: float, lon: float) -> NormalizedObservation:
        """Normalizes WorldPop / NASA SEDAC demographic data."""
        now_iso = datetime.now(timezone.utc).isoformat()
        density = cls._parse_float(raw.get("density") or raw.get("populationDensity") or raw.get("value"), 2500.0)
        count = cls._parse_float(raw.get("count") or raw.get("populationCount"), density * 1.5)
        # Normalization across human settlement density (0-20,000 people/km²)
        norm_val = min(1.0, max(0.01, density / 20000.0))

        bbox = raw.get("bbox")
        if bbox:
            w, s, e, n = bbox
            geom = {
                "type": "Polygon",
                "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]
            }
        else:
            geom = {"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]}

        return NormalizedObservation(
            id=f"obs-pop-{uuid.uuid4().hex[:8]}",
            metric="POPULATION",
            subMetric=raw.get("subMetric") or "DENSITY",
            lat=round(lat, 5),
            lng=round(lon, 5),
            geometry=geom,
            value=round(density, 1),
            rawValue=round(density, 1),
            normalizedValue=round(norm_val, 4),
            unit="people/km²",
            timestamp="2020-01-01T00:00:00Z",  # Explicit historical timestamp (Section 6)
            source="WorldPop SDI / Copernicus GHSL",
            sourceType="MODELED_DATASET",
            sourceTier="TIER_1_OFFICIAL",
            license="CC-BY 4.0 Open Population Data",
            spatialResolution="100 m / 1 km High-Resolution Grids",
            temporalResolution="Decadal / Multi-Year Modeling (2020 Baseline)",
            coverage=1.0,
            freshness="Historical Baseline (2020)",
            freshnessMinutes=0.0,
            confidence=0.96,
            status="AVAILABLE",
            metadata={
                "populationCount": round(count),
                "datasetYear": 2020,
                "exposureRole": "EXPOSURE",  # Explicitly exposure, not hazard (Section 44)
            }
        )

    @classmethod
    def normalize_incident(cls, raw: Dict[str, Any]) -> NormalizedObservation:
        """Normalizes civic/police incident signals."""
        now_iso = datetime.now(timezone.utc).isoformat()
        obs_ts = raw.get("timestamp") or now_iso
        freshness_m = cls._calc_freshness_minutes(obs_ts)
        lat = float(raw.get("latitude") or 0.0)
        lon = float(raw.get("longitude") or 0.0)
        sev = float(raw.get("severity") or 50.0)
        norm_val = round(sev / 100.0, 4)

        return NormalizedObservation(
            id=f"obs-inc-{raw.get('id') or uuid.uuid4().hex[:8]}",
            metric="INCIDENTS",
            subMetric=raw.get("eventType") or "CIVIC_ALERT",
            lat=round(lat, 5),
            lng=round(lon, 5),
            geometry={"type": "Point", "coordinates": [round(lon, 5), round(lat, 5)]},
            value=sev,
            rawValue=sev,
            normalizedValue=norm_val,
            unit="severity index",
            timestamp=obs_ts,
            source=raw.get("source") or "Verified Municipal Stream",
            sourceType="OFFICIAL_REPORT",
            sourceTier="TIER_1_OFFICIAL",
            license="Public Safety Open Access",
            spatialResolution="Exact Point Geometry (±15m)",
            temporalResolution="Instantaneous Event Dispatch",
            coverage=1.0,
            freshness=f"{int(freshness_m)} min ago" if freshness_m > 0 else "LIVE",
            freshnessMinutes=freshness_m,
            confidence=float(raw.get("confidence") or 0.88),
            status="AVAILABLE",
            metadata={
                "title": raw.get("title", "Civic Incident"),
                "eventType": raw.get("eventType", "ALERT"),
                "category": raw.get("category", "MODERATE"),
            }
        )
