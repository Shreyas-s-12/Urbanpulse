from typing import Any, Dict, Optional
from datetime import datetime, timezone
import asyncio
from app.services.providers.base_provider import BaseProvider
from app.services.providers.civil_safety_registry import CivilSafetyRegistry


class CrimeProvider(BaseProvider):
    provider_name = "Official Police Feeds"
    provider_type = "GOVERNMENT_STATION"
    default_coverage = "JURISDICTION_DEPENDENT"

    @classmethod
    async def get_crime_events_async(
        cls,
        latitude: float,
        longitude: float,
        radius_km: float = 50.0,
        country_code: Optional[str] = None,
        city: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Asynchronously evaluates jurisdiction and queries available civil safety feeds.
        """
        return await CivilSafetyRegistry.get_civil_safety(
            latitude=latitude,
            longitude=longitude,
            radius_km=radius_km,
            country_code=country_code,
            city=city,
        )

    @classmethod
    def get_crime_events(
        cls,
        latitude: float,
        longitude: float,
        radius_km: float = 50.0,
        country_code: Optional[str] = None,
        city: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Synchronous wrapper checking cache or returning transparent absence of feed.
        """
        cache_key = f"{country_code or ''}:{round(latitude, 2)}:{round(longitude, 2)}"
        cached = CivilSafetyRegistry._cache.get(cache_key)
        if cached:
            return cached["data"]

        now_iso = datetime.now(timezone.utc).isoformat()
        return {
            "status": "NO_COVERAGE",
            "feedCapability": "NO_COVERAGE",
            "message": "No verified public safety or police dispatch API covers these coordinates.",
            "source": cls.provider_name,
            "sourceType": cls.provider_type,
            "observedAt": now_iso,
            "retrievedAt": now_iso,
            "coverage": cls.default_coverage,
            "confidence": 0.0,
            "events": [],
            "incidents": [],
            "updates": [],
            "sources": [{"name": cls.provider_name, "type": cls.provider_type, "authority": "Official Jurisdictional Station"}],
            "verifiedCount": None,  # Transparently None, NOT 0!
            "incidentCount": None,
        }
