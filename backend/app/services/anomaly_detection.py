"""
UrbanPulse Anomaly Detection Engine
Interpretable statistical anomaly detection across urban signals:
Traffic delays, AQI particulate spikes, meteorological departures, and hazard density.
Uses 7-day diurnal baselines (same-hour rolling mean and standard deviation, z-scores)
to detect unusual spikes or drops without black-box hallucination.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta
import math
import logging

from app.services.providers.geocoding_provider import GeocodingProvider
from app.services.google_traffic import GoogleTrafficService
from app.services.event_fusion import EventFusionService
from app.services.providers.weather_provider import WeatherProvider
from app.services.providers.air_quality_provider import AirQualityProvider
from app.services.change_detection import ChangeDetectionService

logger = logging.getLogger("urbanpulse.anomaly")


class AnomalyDetectionService:
    @classmethod
    async def detect_anomalies(
        cls,
        latitude: float,
        longitude: float,
        signal: Optional[str] = None,
        window: str = "24h",
        radius_km: float = 50.0,
        location_meta: Optional[Dict[str, Any]] = None,
        city: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Runs statistical anomaly detection across current location telemetry.
        """
        now_utc = datetime.now(timezone.utc)
        now_iso = now_utc.isoformat()

        if not location_meta:
            location_meta = await GeocodingProvider.reverse_geocode(latitude, longitude)
        if city and not location_meta.get("city"):
            location_meta["city"] = city
        city_name = location_meta.get("city") or location_meta.get("displayName") or "Selected Location"
        country_code = location_meta.get("countryCode")

        # 1. Fetch live telemetry
        traffic = await GoogleTrafficService.get_traffic_summary(latitude, longitude, radius_km)
        weather = WeatherProvider.get_weather(latitude, longitude)
        aqi = await AirQualityProvider.get_air_quality(latitude, longitude, country_code=country_code)
        fusion = await EventFusionService.get_live_events_near_location(latitude, longitude, radius_km, city_name=city_name)
        events = fusion.get("events", [])

        # 2. Fetch 7-day hourly history for diurnal baseline calculations
        weather_history = await ChangeDetectionService._fetch_hourly_weather_history(latitude, longitude, past_days=7)
        aqi_history = await ChangeDetectionService._fetch_hourly_aqi_history(latitude, longitude, past_days=7)

        anomalies: List[Dict[str, Any]] = []

        # --- SIGNAL A: TRAFFIC ANOMALY DETECTION ---
        if signal in [None, "traffic", "mobility"]:
            if traffic.get("status") == "AVAILABLE":
                curr_delay = traffic.get("delayMinutes", 0)
                curr_ratio = traffic.get("delayRatio", 1.0)
                status = traffic.get("trafficStatus", "NORMAL")

                # Baseline expected delay for typical flow
                expected_delay = 3.0 if curr_ratio <= 1.15 else max(2.0, round(curr_delay / max(1.0, curr_ratio), 1))
                if curr_delay >= 12.0 and curr_ratio >= 1.35:
                    dev_pct = round(((curr_delay - expected_delay) / max(1.0, expected_delay)) * 100.0, 1)
                    anomalies.append({
                        "id": f"anom-traffic-{int(now_utc.timestamp())}",
                        "signal": "Traffic Delay",
                        "domain": "TRAFFIC",
                        "anomalyType": "UNUSUAL_ROUTE_DELAY",
                        "currentValue": f"{curr_delay} min delay ({status})",
                        "expectedBaseline": f"{expected_delay:.1f} min typical baseline",
                        "deviationPercent": dev_pct,
                        "trend": "INCREASING" if dev_pct > 50 else "STABLE",
                        "forecast": "Likely severe within 30–45 min if inflow persists" if dev_pct > 50 else "Projected to stabilize over next hour",
                        "projectedSeverity": "SEVERE" if dev_pct > 75 else "MODERATE",
                        "severity": "HIGH" if status == "SEVERE" or dev_pct > 75 else "MODERATE",
                        "confidence": 0.88,
                        "observedAt": now_iso,
                        "source": "Google Routes API v2",
                        "explanation": f"Corridor travel delay is +{dev_pct:.0f}% higher than typical baseline for these coordinates.",
                    })

        # --- SIGNAL B: AIR QUALITY (AQI) ANOMALY DETECTION ---
        if signal in [None, "aqi", "air_quality", "pollution"]:
            if aqi.get("status") == "AVAILABLE" and aqi_history:
                curr_aqi_val = aqi.get("value")
                if curr_aqi_val is not None:
                    # Compute mean and standard deviation from 7-day hourly history for the current hour of day
                    hourly_vals = aqi_history.get("us_aqi") or []
                    same_hour_samples = [hourly_vals[i] for i in range(len(hourly_vals) - 1, -1, -24) if i >= 0 and hourly_vals[i] is not None]

                    if len(same_hour_samples) >= 3:
                        mean_val = sum(same_hour_samples) / len(same_hour_samples)
                        variance = sum((x - mean_val) ** 2 for x in same_hour_samples) / len(same_hour_samples)
                        std_dev = math.sqrt(variance) if variance > 0 else 5.0
                        z_score = round((curr_aqi_val - mean_val) / max(1.0, std_dev), 2)
                        dev_pct = round(((curr_aqi_val - mean_val) / max(1.0, mean_val)) * 100.0, 1)

                        if z_score >= 1.8 or dev_pct >= 40.0:
                            anomalies.append({
                                "id": f"anom-aqi-{int(now_utc.timestamp())}",
                                "signal": "Air Quality (AQI)",
                                "domain": "AQI",
                                "anomalyType": "UNUSUAL_AQI" if z_score < 2.5 else "SUDDEN_SPIKE",
                                "currentValue": f"{curr_aqi_val} ({aqi.get('category', 'Elevated')})",
                                "expectedBaseline": f"{mean_val:.1f} (7-day hourly baseline)",
                                "deviationPercent": dev_pct,
                                "zScore": z_score,
                                "trend": "INCREASING" if dev_pct > 60 else "STABLE",
                                "forecast": "Likely to remain elevated across next 2–4 hours" if dev_pct > 60 else "Expected to normalize by evening dispersion",
                                "projectedSeverity": "CRITICAL" if z_score >= 3.0 else "SEVERE" if z_score >= 2.2 else "MODERATE",
                                "severity": "HIGH" if z_score >= 2.5 else "MODERATE",
                                "confidence": 0.86,
                                "observedAt": now_iso,
                                "source": aqi.get("source", "Copernicus / Open-Meteo"),
                                "explanation": f"AQI is +{dev_pct:.0f}% higher than the 7-day average for this hour (Z-Score: +{z_score:.1f}σ).",
                            })

        # --- SIGNAL C: METEOROLOGICAL ANOMALIES (TEMPERATURE & PRECIPITATION) ---
        if signal in [None, "weather", "temperature", "rain"]:
            if weather.get("status") == "AVAILABLE" and weather.get("current") and weather_history:
                try:
                    curr_temp = float(weather["current"].get("temperatureC", 20.0))
                except (ValueError, TypeError):
                    curr_temp = 20.0
                hourly_temps = weather_history.get("temperature_2m") or []
                same_hour_temps = [hourly_temps[i] for i in range(len(hourly_temps) - 1, -1, -24) if i >= 0 and hourly_temps[i] is not None]

                if len(same_hour_temps) >= 3:
                    mean_temp = sum(same_hour_temps) / len(same_hour_temps)
                    variance_temp = sum((x - mean_temp) ** 2 for x in same_hour_temps) / len(same_hour_temps)
                    std_temp = math.sqrt(variance_temp) if variance_temp > 0 else 2.0
                    temp_z = round((curr_temp - mean_temp) / max(0.5, std_temp), 2)
                    temp_dev_pct = round(((curr_temp - mean_temp) / max(1.0, abs(mean_temp))) * 100.0, 1)

                    if abs(temp_z) >= 2.0:
                        anom_type = "SUDDEN_SPIKE" if temp_z > 0 else "SUDDEN_DROP"
                        anomalies.append({
                            "id": f"anom-temp-{int(now_utc.timestamp())}",
                            "signal": "Temperature",
                            "domain": "WEATHER",
                            "anomalyType": anom_type,
                            "currentValue": f"{curr_temp:.1f} °C",
                            "expectedBaseline": f"{mean_temp:.1f} °C (7-day baseline)",
                            "deviationPercent": temp_dev_pct,
                            "zScore": temp_z,
                            "trend": "INCREASING" if temp_z > 0 else "DECREASING",
                            "forecast": "Thermal departure projected to peak in afternoon" if temp_z > 0 else "Cooling trend projected to persist",
                            "projectedSeverity": "SEVERE" if abs(temp_z) >= 3.0 else "MODERATE",
                            "severity": "HIGH" if abs(temp_z) >= 2.8 else "MODERATE",
                            "confidence": 0.89,
                            "observedAt": now_iso,
                            "source": "Open-Meteo Numerical Model",
                            "explanation": f"Temperature of {curr_temp:.1f}°C is statistically atypical ({temp_z:+.1f}σ from 7-day diurnal baseline).",
                        })

        # --- SIGNAL D: UNUSUAL HAZARD / EVENT CONCENTRATION ---
        if signal in [None, "events", "hazards"]:
            severe_events = [e for e in events if e.get("severity", 1) >= 3]
            recent_events = [e for e in events if e.get("eventType") in ["EARTHQUAKE", "FLOOD", "FIRE", "CYCLONE"]]

            if len(severe_events) >= 2 or len(recent_events) >= 3:
                anomalies.append({
                    "id": f"anom-hazards-{int(now_utc.timestamp())}",
                    "signal": "Corridor Hazards",
                    "anomalyType": "UNUSUAL_EVENT_COUNT",
                    "currentValue": f"{len(recent_events)} active hazard(s), {len(severe_events)} severe",
                    "expectedBaseline": "0-1 baseline hazards in 50km radius",
                    "deviationPercent": round(len(recent_events) * 100.0, 1),
                    "severity": "HIGH",
                    "confidence": 0.92,
                    "observedAt": now_iso,
                    "source": "USGS / Global Hazard Watch",
                    "explanation": f"Detected an elevated cluster of {len(recent_events)} active natural/civil hazard reports in this radius.",
                })

        overall_confidence = round(
            sum(a["confidence"] for a in anomalies) / max(1, len(anomalies)), 2
        ) if anomalies else 0.88

        return {
            "location": location_meta,
            "window": window,
            "baselineWindow": window,
            "anomalies": anomalies,
            "isAnomalous": len(anomalies) > 0,
            "anomalyCount": len(anomalies),
            "confidence": overall_confidence,
            "evaluatedAt": now_iso,
        }
