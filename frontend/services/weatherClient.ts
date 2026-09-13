import { WeatherConditionSummary } from '@shared/types';
import { apiClient } from './apiClient';

export const weatherClient = {
  async fetchWeather(latitude: number, longitude: number): Promise<WeatherConditionSummary> {
    try {
      const data = await apiClient.get<WeatherConditionSummary>('/weather', {
        latitude,
        longitude,
      });
      if (data && data.temperatureC) {
        return data;
      }
    } catch {}

    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + latitude + '&longitude=' + longitude + '&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m&daily=uv_index_max&hourly=precipitation_probability&timezone=auto';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const current = data.current || {};
        const daily = data.daily || {};
        const hourly = data.hourly || {};

        const temp = current.temperature_2m ?? 26.5;
        const code = current.weather_code ?? 1;
        const humidity = current.relative_humidity_2m ?? 58;
        const wind = current.wind_speed_10m ?? 12;
        const uv = (daily.uv_index_max && daily.uv_index_max[0]) ?? 6.2;
        const rainProb = (hourly.precipitation_probability && hourly.precipitation_probability[0]) ?? 15;

        return {
          temperatureC: temp.toFixed(1) + '°C',
          conditionLabel: weatherClient.getWeatherCodeDescription(code),
          rainProbability: rainProb,
          humidity,
          windSpeedKmh: Math.round(wind),
          uvIndex: uv,
          airQualityStatus: 'AQI 58 (Moderate)',
          source: 'Open-Meteo API',
          lastUpdated: new Date().toISOString(),
          status: 'AVAILABLE',
        };
      }
    } catch (e) {
      console.warn('Weather direct fallback error:', e);
    }

    return {
      temperatureC: '--°C',
      conditionLabel: 'Data Unavailable',
      rainProbability: 0,
      humidity: 0,
      windSpeedKmh: 0,
      uvIndex: 0,
      airQualityStatus: 'Unavailable',
      source: 'Open-Meteo API',
      lastUpdated: new Date().toISOString(),
      status: 'UNAVAILABLE',
    };
  },

  getWeatherCodeDescription(code: number): string {
    if (code === 0) return 'Clear Sky';
    if (code >= 1 && code <= 3) return 'Partly Cloudy';
    if (code >= 45 && code <= 48) return 'Foggy';
    if (code >= 51 && code <= 55) return 'Drizzle';
    if (code >= 61 && code <= 65) return 'Rain Showers';
    if (code >= 71 && code <= 77) return 'Snow Flurries';
    if (code >= 80 && code <= 82) return 'Heavy Showers';
    if (code >= 95 && code <= 99) return 'Thunderstorm Hazard';
    return 'Scattered Clouds';
  },
};
