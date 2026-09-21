"""
UrbanPulse Weather Provider Adapter
Fetches real-time, hourly, and daily meteorological intelligence from Open-Meteo with server-side caching and retry.
"""

from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone
import openmeteo_requests
import pandas as pd
import requests_cache
from retry_requests import retry
from app.core.config import settings

# Setup Open-Meteo API client with local SQLite caching (1 hour TTL) and exponential retry
cache_session = requests_cache.CachedSession(".cache", expire_after=3600)
retry_session = retry(cache_session, retries=4, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

MISSING_INT64 = 9223372036854775807


class WeatherProvider:
    @staticmethod
    def get_weather(latitude: float, longitude: float) -> Dict[str, Any]:
        """
        Fetches live weather from Open-Meteo for any latitude/longitude on Earth.
        Returns normalized structure with data freshness provenance.
        """
        endpoint = settings.OPENMETEO_API_URL
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "precipitation",
                "rain",
                "weather_code",
                "surface_pressure",
                "cloud_cover",
                "wind_speed_10m",
                "wind_direction_10m",
                "wind_gusts_10m",
            ],
            "hourly": [
                "temperature_2m",
                "precipitation_probability",
                "precipitation",
                "rain",
                "weather_code",
                "visibility",
                "wind_speed_10m",
            ],
            "daily": [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "uv_index_max",
                "precipitation_probability_max",
                "sunset",
                "moonrise",
            ],
            "timezone": "auto",
        }

        now_iso = datetime.now(timezone.utc).isoformat()

        try:
            responses = openmeteo.weather_api(endpoint, params=params)
            response = responses[0]

            # Current Conditions
            curr = response.Current()
            temp_c = float(curr.Variables(0).Value())
            humidity = int(curr.Variables(1).Value())
            app_temp = float(curr.Variables(2).Value())
            precip = float(curr.Variables(3).Value())
            rain = float(curr.Variables(4).Value())
            w_code = int(curr.Variables(5).Value())
            pressure = float(curr.Variables(6).Value())
            cloud_cover = int(curr.Variables(7).Value())
            wind_speed = float(curr.Variables(8).Value())

            # Hourly
            hourly = response.Hourly()
            hourly_timestamps = pd.date_range(
                start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
                end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
                freq=pd.Timedelta(seconds=hourly.Interval()),
                inclusive="left",
            )

            hourly_data = []
            for i, ts in enumerate(hourly_timestamps[:24]):
                hourly_data.append({
                    "time": ts.isoformat(),
                    "temperature": float(hourly.Variables(0).ValuesAsNumpy()[i]),
                    "precipitation_probability": int(hourly.Variables(1).ValuesAsNumpy()[i]),
                    "rain": float(hourly.Variables(3).ValuesAsNumpy()[i]),
                    "weather_code": int(hourly.Variables(4).ValuesAsNumpy()[i]),
                    "visibility": float(hourly.Variables(5).ValuesAsNumpy()[i]),
                    "wind_speed": float(hourly.Variables(6).ValuesAsNumpy()[i]),
                })

            condition_label = WeatherProvider.code_to_label(w_code)

            return {
                "status": "AVAILABLE",
                "source": "Open-Meteo API",
                "lastUpdated": now_iso,
                "current": {
                    "temperatureC": f"{temp_c:.1f}°C",
                    "apparentTemperatureC": f"{app_temp:.1f}°C",
                    "conditionLabel": condition_label,
                    "weatherCode": w_code,
                    "humidity": humidity,
                    "rainProbability": hourly_data[0]["precipitation_probability"] if hourly_data else 10,
                    "precipitationMm": precip,
                    "rainMm": rain,
                    "windSpeedKmh": round(wind_speed),
                    "surfacePressureHpa": round(pressure, 1),
                    "cloudCoverPercent": cloud_cover,
                    "airQualityStatus": "Unavailable",
                },
                "hourly": hourly_data,
                "elevation": response.Elevation(),
                "timezone": response.Timezone(),
            }
        except Exception as e:
            return {
                "status": "UNAVAILABLE",
                "source": "Open-Meteo API",
                "lastUpdated": now_iso,
                "error": str(e),
                "current": None,
                "hourly": [],
            }

    @staticmethod
    def code_to_label(code: int) -> str:
        if code == 0:
            return "Clear Sky"
        elif 1 <= code <= 3:
            return "Partly Cloudy"
        elif 45 <= code <= 48:
            return "Fog"
        elif 51 <= code <= 55:
            return "Drizzle"
        elif 61 <= code <= 65:
            return "Rain Showers"
        elif 71 <= code <= 77:
            return "Snow Flurries"
        elif 80 <= code <= 82:
            return "Heavy Rain"
        elif 95 <= code <= 99:
            return "Thunderstorm Alert"
        return "Scattered Clouds"

    @classmethod
    def _build_batch_empty(cls, lat: float, lon: float, name: str, now_iso: str) -> Dict[str, Any]:
        return {
            "latitude": round(lat, 5),
            "longitude": round(lon, 5),
            "metric": "WEATHER",
            "rawValue": 0.0,
            "value": 0.0,
            "unit": "°C",
            "category": "UNKNOWN",
            "precipitationMm": 0.0,
            "windSpeedKmh": 0.0,
            "weatherCode": 0,
            "timestamp": now_iso,
            "source": "Open-Meteo Global Forecasting",
            "status": "NO_COVERAGE",
            "confidence": 0.0,
            "coverage": 0.0,
            "metadata": {"areaName": name, "note": "Station out of range or offline"},
        }

    @classmethod
    def get_batch_weather_sync(
        cls,
        points: List[Any],
    ) -> List[Dict[str, Any]]:
        """
        Batches multiple coordinates to Open-Meteo Forecast API in chunked HTTP calls (<=50 points/chunk)
        using openmeteo_requests with local caching (requests_cache) and bounded retries.
        Supports points with (lat, lon, name) or (lat, lon, name, bbox).
        """
        if not points:
            return []

        endpoint = settings.OPENMETEO_API_URL
        chunk_size = 50
        chunks = [points[i:i + chunk_size] for i in range(0, len(points), chunk_size)]
        now_iso = datetime.now(timezone.utc).isoformat()
        results: List[Dict[str, Any]] = []

        for chunk in chunks:
            lats = [float(p[0]) for p in chunk]
            lons = [float(p[1]) for p in chunk]

            params = {
                "latitude": lats,
                "longitude": lons,
                "current": [
                    "temperature_2m",
                    "precipitation",
                    "weather_code",
                    "wind_speed_10m",
                    "relative_humidity_2m",
                ],
                "timezone": "auto",
            }

            try:
                responses = openmeteo.weather_api(endpoint, params=params)
                for i, p in enumerate(chunk):
                    s_lat = float(p[0])
                    s_lon = float(p[1])
                    name = str(p[2])
                    bbox = p[3] if len(p) > 3 else None

                    if i >= len(responses):
                        empty_item = cls._build_batch_empty(s_lat, s_lon, name, now_iso)
                        if bbox:
                            empty_item["bbox"] = bbox
                        results.append(empty_item)
                        continue

                    resp = responses[i]
                    curr = resp.Current()
                    if curr is None:
                        empty_item = cls._build_batch_empty(s_lat, s_lon, name, now_iso)
                        if bbox:
                            empty_item["bbox"] = bbox
                        results.append(empty_item)
                        continue

                    temp_c = float(curr.Variables(0).Value()) if curr.Variables(0) else 0.0
                    precip = float(curr.Variables(1).Value()) if curr.Variables(1) else 0.0
                    w_code = int(curr.Variables(2).Value()) if curr.Variables(2) else 0
                    wind = float(curr.Variables(3).Value()) if curr.Variables(3) else 0.0
                    humidity = int(curr.Variables(4).Value()) if curr.Variables(4) else 0

                    # Determine stress category
                    if precip > 15.0 or wind > 50.0 or abs(temp_c - 22.0) > 18.0:
                        cat = "SEVERE"
                    elif precip > 5.0 or wind > 30.0 or abs(temp_c - 22.0) > 12.0:
                        cat = "HIGH"
                    elif precip > 1.0 or wind > 15.0 or abs(temp_c - 22.0) > 6.0:
                        cat = "MODERATE"
                    else:
                        cat = "LOW"

                    item: Dict[str, Any] = {
                        "latitude": round(s_lat, 5),
                        "longitude": round(s_lon, 5),
                        "metric": "WEATHER",
                        "rawValue": round(temp_c, 1),
                        "value": round(temp_c, 1),
                        "unit": "°C",
                        "category": cat,
                        "precipitationMm": round(precip, 2),
                        "windSpeedKmh": round(wind, 1),
                        "temperatureC": round(temp_c, 1),
                        "weatherCode": w_code,
                        "humidity": humidity,
                        "timestamp": now_iso,
                        "source": "Open-Meteo Global Forecasting",
                        "status": "AVAILABLE",
                        "confidence": 0.95,
                        "coverage": 1.0,
                        "metadata": {
                            "areaName": name,
                            "precipitationMm": round(precip, 2),
                            "windSpeedKmh": round(wind, 1),
                            "temperatureC": round(temp_c, 1),
                            "weatherCode": w_code,
                        },
                    }
                    if bbox:
                        item["bbox"] = bbox
                    results.append(item)
            except Exception as exc:
                logger.error("WeatherProvider batch chunk error: %s", exc)
                for p in chunk:
                    s_lat = float(p[0])
                    s_lon = float(p[1])
                    name = str(p[2])
                    bbox = p[3] if len(p) > 3 else None
                    err_item: Dict[str, Any] = {
                        "latitude": round(s_lat, 5),
                        "longitude": round(s_lon, 5),
                        "metric": "WEATHER",
                        "rawValue": 0.0,
                        "value": 0.0,
                        "unit": "°C",
                        "category": "UNKNOWN",
                        "timestamp": now_iso,
                        "source": "Open-Meteo Global Forecasting",
                        "status": "PROVIDER_ERROR",
                        "confidence": 0.0,
                        "coverage": 0.0,
                        "error": str(exc),
                        "metadata": {"areaName": name, "note": f"Provider error: {exc}"},
                    }
                    if bbox:
                        err_item["bbox"] = bbox
                    results.append(err_item)

        return results

    @classmethod
    async def get_batch_weather(
        cls,
        points: List[Tuple[float, float, str]],
    ) -> List[Dict[str, Any]]:
        """Asynchronous wrapper executing batch query in worker thread."""
        import asyncio
        return await asyncio.to_thread(cls.get_batch_weather_sync, points)
