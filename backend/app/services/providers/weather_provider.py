"""
UrbanPulse Weather Provider Adapter
Fetches real-time, hourly, and daily meteorological intelligence from Open-Meteo with server-side caching and retry.
"""

from typing import Any, Dict
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
