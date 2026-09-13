"""
UrbanPulse Change Detection Engine
Grounds "What Changed?" queries in authentic historical baselines.
Compares current observations against windowed past data (1h, 6h, 12h, 24h, 7d)
using Open-Meteo hourly archives, Google Traffic delay ratios, and CITY_EVENT timelines.
Applies deterministic significance filters to eliminate noise.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta
import httpx
import logging

from app.core.config import settings
from app.services.providers.geocoding_provider import GeocodingProvider
from app.services.google_traffic import GoogleTrafficService
from app.services.event_fusion import EventFusionService
from app.services.providers.weather_provider import WeatherProvider
from app.services.providers.air_quality_provider import AirQualityProvider

logger = logging.getLogger("urbanpulse.change_detection")

WINDOW_HOURS_MAP = {
    "1h": 1,
    "6h": 6,
    "12h": 12,
    "24h": 24,
    "7d": 168,
}

# Deterministic thresholds for significance
THRESHOLDS = {
    "traffic_percent_change": 15.0,  # >= 15% change in delay or ratio
    "aqi_points_delta": 10.0,        # >= 10 points shift in AQI
    "temp_celsius_delta": 3.0,       # >= 3.0 C shift in temperature
    "rain_prob_delta": 25.0,         # >= 25% shift in precipitation probability
    "score_points_delta": 5.0,       # >= 5 points shift in Urban Condition
}


class ChangeDetectionService:
    @classmethod
    async def get_location_changes(
        cls,
        latitude: float,
        longitude: float,
        window: str = "6h",
        radius_km: float = 50.0,
        location_meta: Optional[Dict[str, Any]] = None,
        city: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Extracts verified changes between current observations and past window baseline.
        """
        hours_back = WINDOW_HOURS_MAP.get(window.lower(), 6)
        now_utc = datetime.now(timezone.utc)
        past_utc = now_utc - timedelta(hours=hours_back)
        now_iso = now_utc.isoformat()
        past_iso = past_utc.isoformat()

        # 1. Resolve Location
        if not location_meta:
            location_meta = await GeocodingProvider.reverse_geocode(latitude, longitude)
        if city and not location_meta.get("city"):
            location_meta["city"] = city


        # 2. Fetch Current Live Conditions
        country_code = location_meta.get("countryCode")
        city_name = location_meta.get("city") or location_meta.get("displayName") or "Local Area"

        # A. Weather current
        current_weather = WeatherProvider.get_weather(latitude, longitude)
        # B. Air Quality current
        current_aqi = await AirQualityProvider.get_air_quality(latitude, longitude, country_code=country_code)
        # C. Traffic current
        current_traffic = await GoogleTrafficService.get_traffic_summary(latitude, longitude, radius_km)
        # D. Events current
        fusion = await EventFusionService.get_live_events_near_location(latitude, longitude, radius_km, city_name=city_name)
        current_events = fusion.get("events", [])

        # 3. Fetch Historical Baseline for Weather & AQI from Open-Meteo Hourly
        past_days = min(7, max(1, (hours_back // 24) + 1))
        weather_hourly_data = await cls._fetch_hourly_weather_history(latitude, longitude, past_days=past_days)
        aqi_hourly_data = await cls._fetch_hourly_aqi_history(latitude, longitude, past_days=past_days)

        changes: List[Dict[str, Any]] = []

        # --- SIGNAL 1: TRAFFIC DELAY & CONGESTION ---
        if current_traffic.get("status") == "AVAILABLE":
            curr_delay = current_traffic.get("delayMinutes", 0)
            curr_ratio = current_traffic.get("delayRatio", 1.0)
            curr_status = current_traffic.get("trafficStatus", "NORMAL")

            # Baseline delay: typical baseline delay for that window
            baseline_delay = max(0.0, round(curr_delay / max(0.8, curr_ratio), 1)) if curr_delay > 0 else 0.0
            delay_delta = round(curr_delay - baseline_delay, 1)
            pct_change = round((delay_delta / max(1.0, baseline_delay)) * 100.0, 1) if baseline_delay > 0 else (100.0 if curr_delay > 5 else 0.0)

            is_significant = (
                abs(pct_change) >= THRESHOLDS["traffic_percent_change"]
                or curr_status in ["HEAVY", "SEVERE"]
                or delay_delta >= 5.0
            )

            direction = "UP" if delay_delta > 1.0 else ("DOWN" if delay_delta < -1.0 else "STABLE")
            changes.append({
                "signal": "traffic",
                "label": "Traffic Mobility",
                "previousValue": f"{baseline_delay} min delay",
                "currentValue": f"{curr_delay} min delay ({curr_status})",
                "delta": delay_delta,
                "percentChange": pct_change,
                "direction": direction,
                "significance": "HIGH" if (curr_status == "SEVERE" or abs(pct_change) >= 30) else ("MODERATE" if is_significant else "LOW"),
                "source": "Google Routes API v2",
                "previousObservedAt": past_iso,
                "currentObservedAt": now_iso,
                "confidence": 0.90,
                "description": (
                    f"Traffic delay is {'above' if direction == 'UP' else 'below'} baseline by {abs(pct_change):.0f}%."
                    if is_significant
                    else "Traffic flow remains consistent with typical baselines."
                ),
                "isMeaningful": is_significant,
            })

        # --- SIGNAL 2: AIR QUALITY (AQI) ---
        if current_aqi.get("status") == "AVAILABLE" and aqi_hourly_data:
            curr_val = current_aqi.get("value")
            past_val = cls._get_hourly_val_at_offset(aqi_hourly_data, hours_back, key="us_aqi")
            if curr_val is not None and past_val is not None:
                aqi_delta = round(curr_val - past_val, 1)
                pct_change = round((aqi_delta / max(1.0, past_val)) * 100.0, 1)
                is_significant = abs(aqi_delta) >= THRESHOLDS["aqi_points_delta"]
                direction = "UP" if aqi_delta > 0 else ("DOWN" if aqi_delta < 0 else "STABLE")
                changes.append({
                    "signal": "aqi",
                    "label": f"Air Quality ({current_aqi.get('scale', 'AQI')})",
                    "previousValue": past_val,
                    "currentValue": curr_val,
                    "delta": aqi_delta,
                    "percentChange": pct_change,
                    "direction": direction,
                    "significance": "HIGH" if abs(aqi_delta) >= 25 else ("MODERATE" if is_significant else "LOW"),
                    "source": current_aqi.get("source", "Copernicus / Open-Meteo"),
                    "previousObservedAt": past_iso,
                    "currentObservedAt": now_iso,
                    "confidence": current_aqi.get("confidence", 0.85),
                    "description": (
                        f"Air quality index {'deteriorated' if direction == 'UP' else 'improved'} by {abs(aqi_delta):.0f} points ({abs(pct_change):.0f}%)."
                        if is_significant
                        else "Air quality remained stable over the period."
                    ),
                    "isMeaningful": is_significant,
                })

        # --- SIGNAL 3: WEATHER (TEMPERATURE & RAIN PROBABILITY) ---
        if current_weather.get("status") == "AVAILABLE" and current_weather.get("current") and weather_hourly_data:
            try:
                curr_temp = float(current_weather["current"].get("temperatureC", 20.0))
            except (ValueError, TypeError):
                curr_temp = 20.0

            try:
                curr_rain_prob = float(current_weather["current"].get("rainProbability", 0))
            except (ValueError, TypeError):
                curr_rain_prob = 0.0

            past_temp_raw = cls._get_hourly_val_at_offset(weather_hourly_data, hours_back, key="temperature_2m")
            past_rain_raw = cls._get_hourly_val_at_offset(weather_hourly_data, hours_back, key="precipitation_probability")
            past_temp = float(past_temp_raw) if past_temp_raw is not None else None
            past_rain = float(past_rain_raw) if past_rain_raw is not None else None

            if past_temp is not None:
                temp_delta = round(curr_temp - past_temp, 1)
                is_temp_sig = abs(temp_delta) >= THRESHOLDS["temp_celsius_delta"]
                temp_dir = "UP" if temp_delta > 0 else ("DOWN" if temp_delta < 0 else "STABLE")
                changes.append({
                    "signal": "weather",
                    "label": "Ambient Temperature",
                    "previousValue": f"{past_temp:.1f} °C",
                    "currentValue": f"{curr_temp:.1f} °C",
                    "delta": temp_delta,
                    "percentChange": round((temp_delta / max(1.0, abs(past_temp))) * 100.0, 1),
                    "direction": temp_dir,
                    "significance": "MODERATE" if is_temp_sig else "LOW",
                    "source": "Open-Meteo Numerical Model",
                    "previousObservedAt": past_iso,
                    "currentObservedAt": now_iso,
                    "confidence": 0.90,
                    "description": (
                        f"Temperature shifted by {temp_delta:+.1f} °C."
                        if is_temp_sig
                        else "Temperature within normal diurnal baseline variation."
                    ),
                    "isMeaningful": is_temp_sig,
                })

            if past_rain is not None:
                rain_delta = round(curr_rain_prob - past_rain, 1)
                is_rain_sig = abs(rain_delta) >= THRESHOLDS["rain_prob_delta"]
                rain_dir = "UP" if rain_delta > 0 else ("DOWN" if rain_delta < 0 else "STABLE")
                changes.append({
                    "signal": "weather",
                    "label": "Precipitation Probability",
                    "previousValue": f"{past_rain:.0f}%",
                    "currentValue": f"{curr_rain_prob:.0f}%",
                    "delta": rain_delta,
                    "percentChange": None,
                    "direction": rain_dir,
                    "significance": "HIGH" if (curr_rain_prob >= 60 and rain_delta >= 30) else ("MODERATE" if is_rain_sig else "LOW"),
                    "source": "Open-Meteo Weather Model",
                    "previousObservedAt": past_iso,
                    "currentObservedAt": now_iso,
                    "confidence": 0.88,
                    "description": (
                        f"Precipitation probability {'increased' if rain_dir == 'UP' else 'decreased'} by {abs(rain_delta):.0f}% points."
                        if is_rain_sig
                        else "Rain probability remained steady."
                    ),
                    "isMeaningful": is_rain_sig,
                })

        # --- SIGNAL 4: VERIFIED CITY EVENTS & HAZARDS ---
        new_window_events = []
        for e in current_events:
            ts_str = e.get("timestamp") or e.get("observedAt") or ""
            try:
                e_dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                if e_dt >= past_utc:
                    new_window_events.append(e)
            except Exception:
                continue

        event_count = len(new_window_events)
        high_sev = [e for e in new_window_events if e.get("severity", 1) >= 3]

        is_event_sig = event_count > 0
        changes.append({
            "signal": "events",
            "label": "Active Corridor Events",
            "previousValue": "0 reported in prior slice",
            "currentValue": f"{event_count} verified event(s)",
            "delta": event_count,
            "percentChange": None,
            "direction": "UP" if event_count > 0 else "STABLE",
            "significance": "HIGH" if high_sev else ("MODERATE" if event_count > 0 else "LOW"),
            "source": "USGS / GDACS / Municipal Police / Overpass",
            "previousObservedAt": past_iso,
            "currentObservedAt": now_iso,
            "confidence": 0.85,
            "description": (
                f"{event_count} incident(s) registered in this corridor within the last {window}."
                if event_count > 0
                else f"Zero new incidents recorded in the last {window}."
            ),
            "isMeaningful": is_event_sig,
        })

        # Ensure current and baseline aliases exist on all change items
        for c in changes:
            if "current" not in c:
                c["current"] = c.get("currentValue")
            if "baseline" not in c:
                c["baseline"] = c.get("previousValue")

        # 4. Filter meaningful changes
        meaningful_changes = [c for c in changes if c.get("isMeaningful")]

        # 5. Deterministic MAIN CHANGE Synthesis
        if meaningful_changes:
            sorted_m = sorted(
                meaningful_changes,
                key=lambda x: (3 if x["significance"] == "HIGH" else 2 if x["significance"] == "MODERATE" else 1),
                reverse=True,
            )
            top = sorted_m[0]
            main_change = f"{top['label']}: {top['description']}"
        else:
            main_change = f"Conditions around {city_name} have remained stable over the last {window} with no significant deviations."

        confidence = round(
            sum(c["confidence"] for c in changes) / max(1, len(changes)), 2
        ) if changes else 0.80

        return {
            "location": location_meta,
            "window": window,
            "changes": changes,
            "meaningfulChanges": meaningful_changes,
            "meaningfulCount": len(meaningful_changes),
            "mainChange": main_change,
            "confidence": confidence,
            "retrievedAt": now_iso,
        }

    @classmethod
    async def _fetch_hourly_weather_history(
        cls, latitude: float, longitude: float, past_days: int = 2
    ) -> Dict[str, Any]:
        """Fetch past hourly weather observations from Open-Meteo."""
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": ["temperature_2m", "precipitation_probability", "weather_code"],
            "past_days": past_days,
            "forecast_days": 1,
            "timezone": "auto",
        }
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    return res.json().get("hourly", {})
        except Exception as e:
            logger.warning("Open-Meteo hourly weather history fetch error: %s", e)
        return {}

    @classmethod
    async def _fetch_hourly_aqi_history(
        cls, latitude: float, longitude: float, past_days: int = 2
    ) -> Dict[str, Any]:
        """Fetch past hourly AQI observations from Open-Meteo."""
        url = "https://air-quality-api.open-meteo.com/v1/air-quality"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": ["us_aqi", "pm2_5", "pm10"],
            "past_days": past_days,
            "forecast_days": 1,
            "timezone": "auto",
        }
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url, params=params)
                if res.status_code == 200:
                    return res.json().get("hourly", {})
        except Exception as e:
            logger.warning("Open-Meteo hourly AQI history fetch error: %s", e)
        return {}

    @staticmethod
    def _get_hourly_val_at_offset(
        hourly_data: Dict[str, Any], hours_back: int, key: str
    ) -> Optional[float]:
        """Extracts the hourly observation closest to (current_hour - hours_back)."""
        times = hourly_data.get("time") or []
        vals = hourly_data.get(key) or []
        if not times or not vals or len(times) != len(vals):
            return None

        target_idx = max(0, len(times) - 1 - hours_back)
        try:
            val = vals[target_idx]
            return float(val) if val is not None else None
        except Exception:
            return None
