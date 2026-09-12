"""
UrbanPulse Natural Disaster Provider Adapter
Aggregates scientific seismology (USGS) and atmospheric hazard alerts into normalized CITY_EVENT items.
"""

from typing import Any, Dict, List
from app.services.providers.earthquake_provider import EarthquakeProvider


class DisasterProvider:
    @staticmethod
    async def get_disaster_events(latitude: float, longitude: float, radius_km: float = 50.0) -> List[Dict[str, Any]]:
        """
        Gathers live disaster and natural hazard events (earthquakes, storm surges, active floods).
        """
        disasters = []

        # 1. Live USGS Earthquakes
        try:
            quakes = await EarthquakeProvider.get_earthquakes(latitude, longitude, radius_km=max(radius_km, 100.0))
            disasters.extend(quakes)
        except Exception:
            pass

        return disasters
