"""
UrbanPulse Dynamic Open-Meteo Weather Intelligence Service
Provides real-time, hourly, and daily meteorological intelligence for any geographic coordinates worldwide.
"""

from typing import Any, Dict, Optional
import openmeteo_requests
import pandas as pd
import requests_cache
from retry_requests import retry
from app.core.config import settings

# Setup Open-Meteo API client with local SQLite caching (1 hour TTL) and exponential retry
cache_session = requests_cache.CachedSession(".cache", expire_after=3600)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

MISSING_INT64 = 9223372036854775807


class WeatherService:
    @staticmethod
    def fetch_weather(
        latitude: float,
        longitude: float,
        url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Fetch current, hourly, and daily meteorological observations and forecasts for any location on Earth.
        """
        endpoint = url or settings.OPENMETEO_API_URL
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "daily": [
                "weather_code",
                "temperature_2m_min",
                "uv_index_clear_sky_max",
                "apparent_temperature_min",
                "uv_index_max",
                "apparent_temperature_max",
                "temperature_2m_max",
                "sunset",
                "moonrise",
            ],
            "hourly": [
                "temperature_2m",
                "relative_humidity_2m",
                "apparent_temperature",
                "precipitation",
                "showers",
                "snowfall",
                "snow_depth",
                "rain",
                "precipitation_probability",
                "dew_point_2m",
                "weather_code",
                "pressure_msl",
                "surface_pressure",
                "cloud_cover",
                "cloud_cover_mid",
                "cloud_cover_low",
                "visibility",
                "evapotranspiration",
                "et0_fao_evapotranspiration",
                "vapour_pressure_deficit",
                "cloud_cover_high",
                "wind_speed_10m",
                "wind_speed_80m",
                "wind_speed_120m",
                "wind_speed_180m",
                "wind_direction_10m",
                "wind_direction_80m",
                "wind_direction_120m",
                "wind_direction_180m",
                "wind_gusts_10m",
                "temperature_80m",
                "temperature_120m",
                "temperature_180m",
                "soil_moisture_27_to_81cm",
                "soil_moisture_9_to_27cm",
                "soil_moisture_3_to_9cm",
                "soil_moisture_1_to_3cm",
                "soil_moisture_0_to_1cm",
                "soil_temperature_54cm",
                "soil_temperature_18cm",
                "soil_temperature_6cm",
                "soil_temperature_0cm",
            ],
            "current": [
                "snowfall",
                "showers",
                "precipitation",
                "rain",
                "weather_code",
                "surface_pressure",
                "pressure_msl",
                "cloud_cover",
                "wind_speed_10m",
                "wind_direction_10m",
                "wind_gusts_10m",
            ],
        }

        try:
            responses = openmeteo.weather_api(endpoint, params=params)
            response = responses[0]

            # Extract current observations
            current = response.Current()
            current_data = {
                "time": current.Time(),
                "snowfall": float(current.Variables(0).Value()),
                "showers": float(current.Variables(1).Value()),
                "precipitation": float(current.Variables(2).Value()),
                "rain": float(current.Variables(3).Value()),
                "weather_code": int(current.Variables(4).Value()),
                "surface_pressure": float(current.Variables(5).Value()),
                "pressure_msl": float(current.Variables(6).Value()),
                "cloud_cover": float(current.Variables(7).Value()),
                "wind_speed_10m": float(current.Variables(8).Value()),
                "wind_direction_10m": float(current.Variables(9).Value()),
                "wind_gusts_10m": float(current.Variables(10).Value()),
            }

            # Extract hourly observations
            hourly = response.Hourly()
            hourly_timestamps = pd.date_range(
                start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
                end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
                freq=pd.Timedelta(seconds=hourly.Interval()),
                inclusive="left",
            )
            hourly_data = {
                "date": [ts.isoformat() for ts in hourly_timestamps[:24]],
                "temperature_2m": [float(x) for x in hourly.Variables(0).ValuesAsNumpy()[:24]],
                "relative_humidity_2m": [float(x) for x in hourly.Variables(1).ValuesAsNumpy()[:24]],
                "apparent_temperature": [float(x) for x in hourly.Variables(2).ValuesAsNumpy()[:24]],
                "precipitation": [float(x) for x in hourly.Variables(3).ValuesAsNumpy()[:24]],
                "showers": [float(x) for x in hourly.Variables(4).ValuesAsNumpy()[:24]],
                "rain": [float(x) for x in hourly.Variables(7).ValuesAsNumpy()[:24]],
                "precipitation_probability": [float(x) for x in hourly.Variables(8).ValuesAsNumpy()[:24]],
                "weather_code": [int(x) for x in hourly.Variables(10).ValuesAsNumpy()[:24]],
                "visibility": [float(x) for x in hourly.Variables(16).ValuesAsNumpy()[:24]],
                "wind_speed_10m": [float(x) for x in hourly.Variables(21).ValuesAsNumpy()[:24]],
                "wind_direction_10m": [float(x) for x in hourly.Variables(25).ValuesAsNumpy()[:24]],
            }

            # Extract daily forecasts
            daily = response.Daily()
            daily_timestamps = pd.date_range(
                start=pd.to_datetime(daily.Time(), unit="s", utc=True),
                end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
                freq=pd.Timedelta(seconds=daily.Interval()),
                inclusive="left",
            )
            daily_sunset = daily.Variables(7).ValuesInt64AsNumpy()
            daily_moonrise = daily.Variables(8).ValuesInt64AsNumpy()
            daily_moonrise_series = pd.Series(daily_moonrise).mask(daily_moonrise == MISSING_INT64)

            daily_data = {
                "date": [ts.isoformat() for ts in daily_timestamps[:7]],
                "weather_code": [int(x) for x in daily.Variables(0).ValuesAsNumpy()[:7]],
                "temperature_2m_min": [float(x) for x in daily.Variables(1).ValuesAsNumpy()[:7]],
                "uv_index_clear_sky_max": [float(x) for x in daily.Variables(2).ValuesAsNumpy()[:7]],
                "apparent_temperature_min": [float(x) for x in daily.Variables(3).ValuesAsNumpy()[:7]],
                "uv_index_max": [float(x) for x in daily.Variables(4).ValuesAsNumpy()[:7]],
                "apparent_temperature_max": [float(x) for x in daily.Variables(5).ValuesAsNumpy()[:7]],
                "temperature_2m_max": [float(x) for x in daily.Variables(6).ValuesAsNumpy()[:7]],
                "sunset": [pd.to_datetime(s, unit="s", utc=True).isoformat() for s in daily_sunset[:7]],
                "moonrise": [
                    pd.to_datetime(m, unit="s", utc=True).isoformat() if pd.notna(m) else None
                    for m in daily_moonrise_series[:7]
                ],
            }

            return {
                "latitude": response.Latitude(),
                "longitude": response.Longitude(),
                "elevation": response.Elevation(),
                "utc_offset_seconds": response.UtcOffsetSeconds(),
                "current": current_data,
                "hourly": hourly_data,
                "daily": daily_data,
            }
        except Exception as e:
            return {
                "error": str(e),
                "latitude": latitude,
                "longitude": longitude,
                "status": "Weather provider unavailable",
            }
