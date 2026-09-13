"""
UrbanPulse Land Value Provider Adapter
Provides cadastral and municipal property valuation signals where official registries exist.
Strict rule: Returns NO_VERIFIED_FEED when no authoritative cadastral registry exists for coordinates.
"""

from typing import Any, Dict, Optional
from datetime import datetime, timezone
from app.services.providers.base_provider import BaseProvider


class LandValueProvider(BaseProvider):
    provider_name = "Municipal Cadastral Registry"
    provider_type = "GOVERNMENT_STATION"
    default_coverage = "JURISDICTION_DEPENDENT"

    @classmethod
    def get_land_value(
        cls,
        latitude: float,
        longitude: float,
        country_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        return {
            "status": "NO_VERIFIED_FEED",
            "message": "No verified cadastral or municipal property tax assessment feed active for this location.",
            "source": cls.provider_name,
            "sourceType": cls.provider_type,
            "observedAt": now_iso,
            "retrievedAt": now_iso,
            "coverage": cls.default_coverage,
            "confidence": 0.0,
            "estimatedIndex": None,
        }
