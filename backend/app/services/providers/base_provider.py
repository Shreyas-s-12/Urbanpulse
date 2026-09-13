"""
UrbanPulse Base Provider Interface
Defines the normalized interface and provenance contract for all external data adapters.
Every provider must return explicit provenance: source, sourceType, observedAt, retrievedAt, coverage, confidence, status.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from datetime import datetime, timezone


class BaseProvider(ABC):
    """Abstract base class for all UrbanPulse data providers."""

    provider_name: str = "BaseProvider"
    provider_type: str = "LIVE_API"  # LIVE_API, SATELLITE_MODEL, GOVERNMENT_STATION, SENSOR_NETWORK, MAPPING_PROVIDER, NONE
    default_coverage: str = "GLOBAL"  # GLOBAL, REGIONAL, COUNTRY_SPECIFIC, LOCAL

    @classmethod
    def build_provenance(
        cls,
        status: str = "AVAILABLE",
        confidence: float = 0.9,
        source: Optional[str] = None,
        source_type: Optional[str] = None,
        coverage: Optional[str] = None,
        observed_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Creates a standardized provenance metadata dictionary."""
        now_iso = datetime.now(timezone.utc).isoformat()
        return {
            "source": source or cls.provider_name,
            "sourceType": source_type or cls.provider_type,
            "observedAt": observed_at or now_iso,
            "retrievedAt": now_iso,
            "coverage": coverage or cls.default_coverage,
            "confidence": max(0.0, min(1.0, confidence)),
            "status": status,
        }
