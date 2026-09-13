import { AirQualitySummary } from '@shared/types';
import { apiClient } from './apiClient';

export const airQualityService = {
  async getAirQuality(
    latitude: number,
    longitude: number,
    scale?: string,
    countryCode?: string
  ): Promise<AirQualitySummary> {
    try {
      const data = await apiClient.get<AirQualitySummary>('/air-quality', {
        latitude,
        longitude,
        scale,
        country_code: countryCode,
      });
      if (data && data.status) {
        return data;
      }
    } catch (err) {
      console.warn('Backend air-quality fetch failed:', err);
    }

    // Direct fallback to Open-Meteo Air Quality API
    try {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const curr = json.current || {};
        const usAqi = curr.us_aqi ?? 50;
        const category =
          usAqi <= 50 ? 'Good' : usAqi <= 100 ? 'Moderate' : usAqi <= 150 ? 'Unhealthy for Sensitive Groups' : 'Unhealthy';

        return {
          value: usAqi,
          pollutant: 'PM2.5',
          scale: 'US_AQI',
          category,
          unit: 'AQI',
          source: 'Open-Meteo CAMS/SILAM',
          sourceType: 'SATELLITE_MODEL',
          observedAt: new Date().toISOString(),
          confidence: 0.88,
          status: 'AVAILABLE',
          breakdown: {
            pm2_5: curr.pm2_5,
            pm10: curr.pm10,
            no2: curr.nitrogen_dioxide,
            so2: curr.sulphur_dioxide,
            co: curr.carbon_monoxide,
            o3: curr.ozone,
          },
        };
      }
    } catch (e) {
      console.warn('Direct Open-Meteo air quality query failed:', e);
    }

    return {
      value: null,
      pollutant: 'None',
      scale: 'US_AQI',
      category: 'Unavailable',
      unit: 'AQI',
      source: 'Open-Meteo CAMS/SILAM',
      sourceType: 'SATELLITE_MODEL',
      observedAt: new Date().toISOString(),
      confidence: 0.0,
      status: 'UNAVAILABLE',
    };
  },
};
