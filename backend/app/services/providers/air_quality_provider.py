"""
UrbanPulse Air Quality Provider Adapter
Standard-aware global atmospheric and air quality intelligence powered by Open-Meteo Air Quality API
(European Copernicus Atmosphere Monitoring Service CAMS & Finnish Meteorological Institute SILAM models).
Dynamically supports:
  - US AQI (EPA 0-500 scale)
  - CPCB India AQI (Central Pollution Control Board PM2.5/PM10 standard)
  - European AQI (EAQI 1-100+ index)
Strict rule: NEVER hardcodes "Delhi => Moderate" or "AQI 58 => Moderate" without standard context.
"""

from typing import Any, Dict, Optional
from datetime import datetime, timezone
import httpx
import logging
from app.services.providers.base_provider import BaseProvider

logger = logging.getLogger("urbanpulse.air_quality")

EUROPEAN_COUNTRIES = {
    "GB", "FR", "DE", "IT", "ES", "NL", "BE", "SE", "PL", "AT", "CH", "NO", "DK", "FI", "PT", "GR", "IE"
}


def classify_us_aqi(aqi: int) -> str:
    """Classifies standard US EPA AQI into official category."""
    if aqi <= 50:
        return "Good"
    elif aqi <= 100:
        return "Moderate"
    elif aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    elif aqi <= 200:
        return "Unhealthy"
    elif aqi <= 300:
        return "Very Unhealthy"
    else:
        return "Hazardous"


def classify_european_aqi(eaqi: int) -> str:
    """Classifies European Air Quality Index."""
    if eaqi <= 20:
        return "Very Good"
    elif eaqi <= 40:
        return "Good"
    elif eaqi <= 60:
        return "Medium"
    elif eaqi <= 80:
        return "Poor"
    elif eaqi <= 100:
        return "Very Poor"
    else:
        return "Extremely Poor"


def calculate_cpcb_india_aqi(pm2_5: float, pm10: Optional[float] = None) -> tuple[int, str]:
    """
    Computes official Indian CPCB AQI from PM2.5 and PM10 concentrations (ug/m3).
    Returns (aqi_value, category).
    """
    # PM2.5 Sub-index
    if pm2_5 <= 30:
        aqi_25 = (50.0 / 30.0) * pm2_5
    elif pm2_5 <= 60:
        aqi_25 = 50.0 + (50.0 / 30.0) * (pm2_5 - 30.0)
    elif pm2_5 <= 90:
        aqi_25 = 100.0 + (100.0 / 30.0) * (pm2_5 - 60.0)
    elif pm2_5 <= 120:
        aqi_25 = 200.0 + (100.0 / 30.0) * (pm2_5 - 90.0)
    elif pm2_5 <= 250:
        aqi_25 = 300.0 + (100.0 / 130.0) * (pm2_5 - 120.0)
    else:
        aqi_25 = 400.0 + (100.0 / 130.0) * min(pm2_5 - 250.0, 130.0)

    # PM10 Sub-index if available
    aqi_10 = 0.0
    if pm10 is not None:
        if pm10 <= 50:
            aqi_10 = pm10
        elif pm10 <= 100:
            aqi_10 = 50.0 + (50.0 / 50.0) * (pm10 - 50.0)
        elif pm10 <= 250:
            aqi_10 = 100.0 + (100.0 / 150.0) * (pm10 - 100.0)
        elif pm10 <= 350:
            aqi_10 = 200.0 + (100.0 / 100.0) * (pm10 - 250.0)
        elif pm10 <= 430:
            aqi_10 = 300.0 + (100.0 / 80.0) * (pm10 - 350.0)
        else:
            aqi_10 = 400.0 + (100.0 / 80.0) * min(pm10 - 430.0, 80.0)

    final_aqi = round(max(aqi_25, aqi_10))

    if final_aqi <= 50:
        category = "Good"
    elif final_aqi <= 100:
        category = "Satisfactory"
    elif final_aqi <= 200:
        category = "Moderate"
    elif final_aqi <= 300:
        category = "Poor"
    elif final_aqi <= 400:
        category = "Very Poor"
    else:
        category = "Severe"

    return final_aqi, category


class AirQualityProvider(BaseProvider):
    provider_name = "Open-Meteo CAMS/SILAM"
    provider_type = "SATELLITE_MODEL"
    default_coverage = "GLOBAL"

    @classmethod
    async def get_air_quality(
        cls,
        latitude: float,
        longitude: float,
        country_code: Optional[str] = None,
        requested_scale: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Fetches live air quality metrics for any coordinates on Earth and standardizes category.
        """
        url = "https://air-quality-api.open-meteo.com/v1/air-quality"
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": [
                "us_aqi",
                "european_aqi",
                "pm10",
                "pm2_5",
                "carbon_monoxide",
                "nitrogen_dioxide",
                "sulphur_dioxide",
                "ozone",
            ],
            "timezone": "auto",
        }

        now_iso = datetime.now(timezone.utc).isoformat()
        cc = (country_code or "").upper()

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url, params=params)

            if res.status_code != 200:
                logger.warning("Open-Meteo Air Quality API returned HTTP %d", res.status_code)
                return cls._build_unavailable(now_iso, f"HTTP error {res.status_code}")

            data = res.json()
            curr = data.get("current", {})
            if not curr:
                return cls._build_unavailable(now_iso, "Empty current telemetry")

            us_aqi = curr.get("us_aqi")
            eaqi = curr.get("european_aqi")
            pm2_5 = curr.get("pm2_5", 0.0)
            pm10 = curr.get("pm10", 0.0)
            no2 = curr.get("nitrogen_dioxide")
            so2 = curr.get("sulphur_dioxide")
            co = curr.get("carbon_monoxide")
            o3 = curr.get("ozone")

            # Determine appropriate standard
            if requested_scale == "CPCB_INDIA_AQI" or (not requested_scale and cc == "IN"):
                scale = "CPCB_INDIA_AQI"
                value, category = calculate_cpcb_india_aqi(pm2_5, pm10)
                pollutant = "PM2.5"
            elif requested_scale == "EUROPEAN_AQI" or (not requested_scale and cc in EUROPEAN_COUNTRIES):
                scale = "EUROPEAN_AQI"
                value = int(eaqi) if eaqi is not None else 0
                category = classify_european_aqi(value)
                pollutant = "CAMS European Index"
            else:
                scale = "US_AQI"
                value = int(us_aqi) if us_aqi is not None else 0
                category = classify_us_aqi(value)
                pollutant = "PM2.5"

            observed_time = curr.get("time")
            observed_at = f"{observed_time}:00Z" if observed_time and "T" in observed_time else now_iso

            return {
                "value": value,
                "pollutant": pollutant,
                "scale": scale,
                "category": category,
                "unit": "AQI",
                "source": cls.provider_name,
                "sourceType": cls.provider_type,
                "observedAt": observed_at,
                "retrievedAt": now_iso,
                "coverage": cls.default_coverage,
                "confidence": 0.92,
                "status": "AVAILABLE",
                "breakdown": {
                    "pm2_5": round(pm2_5, 1) if pm2_5 is not None else None,
                    "pm10": round(pm10, 1) if pm10 is not None else None,
                    "no2": round(no2, 1) if no2 is not None else None,
                    "so2": round(so2, 1) if so2 is not None else None,
                    "co": round(co, 1) if co is not None else None,
                    "o3": round(o3, 1) if o3 is not None else None,
                },
            }

        except Exception as exc:
            logger.error("AirQualityProvider error for (%.4f, %.4f): %s", latitude, longitude, exc)
            return cls._build_unavailable(now_iso, str(exc))

    @classmethod
    def _build_unavailable(cls, now_iso: str, reason: str) -> Dict[str, Any]:
        return {
            "value": None,
            "pollutant": "None",
            "scale": "US_AQI",
            "category": "Unavailable",
            "unit": "AQI",
            "source": cls.provider_name,
            "sourceType": cls.provider_type,
            "observedAt": now_iso,
            "retrievedAt": now_iso,
            "coverage": cls.default_coverage,
            "confidence": 0.0,
            "status": "UNAVAILABLE",
            "reason": reason,
            "breakdown": None,
        }
