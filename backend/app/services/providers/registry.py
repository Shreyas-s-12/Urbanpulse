"""
UrbanPulse Provider Registry
Manages coverage metadata, capability matching, and fallback chains across providers.
Strict rule: Primary -> Fallback -> UNAVAILABLE. Never fabricates values on provider absence.
"""

from typing import Any, Dict, List, Optional, Callable, Awaitable
import inspect
import logging

logger = logging.getLogger("urbanpulse.registry")


class ProviderRegistry:
    """Registry maintaining metadata and executing location-aware fallback chains."""

    _providers: Dict[str, List[Dict[str, Any]]] = {
        "geocoding": [],
        "weather": [],
        "air_quality": [],
        "traffic": [],
        "roads": [],
        "incidents": [],
        "hazards": [],
        "crime": [],
        "land_value": [],
    }

    @classmethod
    def register(
        cls,
        domain: str,
        name: str,
        handler: Any,
        coverage: str = "GLOBAL",
        supported_countries: Optional[List[str]] = None,
        priority: int = 10,
    ) -> None:
        """Registers a provider under a specific intelligence domain."""
        if domain not in cls._providers:
            cls._providers[domain] = []

        cls._providers[domain].append({
            "name": name,
            "handler": handler,
            "coverage": coverage,
            "supported_countries": [c.upper() for c in (supported_countries or [])],
            "priority": priority,
        })
        # Sort highest priority first
        cls._providers[domain].sort(key=lambda x: x["priority"], reverse=True)

    @classmethod
    def get_providers_for_location(
        cls,
        domain: str,
        country_code: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Finds eligible providers ordered by priority and geographic match."""
        candidates = cls._providers.get(domain, [])
        if not candidates:
            return []

        matched: List[Dict[str, Any]] = []
        cc = country_code.upper() if country_code else None

        for p in candidates:
            # Check country coverage if country-specific
            if p["coverage"] == "COUNTRY_SPECIFIC":
                if cc and cc in p["supported_countries"]:
                    matched.append(p)
            else:
                matched.append(p)

        return matched

    @classmethod
    async def execute_fallback_chain(
        cls,
        domain: str,
        country_code: Optional[str],
        func_name: str,
        *args: Any,
        **kwargs: Any,
    ) -> Optional[Any]:
        """
        Executes primary provider -> fallback provider -> None (UNAVAILABLE).
        Never returns synthetic mock numbers.
        """
        providers = cls.get_providers_for_location(domain, country_code)
        if not providers:
            logger.info("No registered providers for domain=%s country=%s", domain, country_code)
            return None

        for p in providers:
            handler = p["handler"]
            func = getattr(handler, func_name, None)
            if not callable(func):
                continue

            try:
                if inspect.iscoroutinefunction(func):
                    result = await func(*args, **kwargs)
                else:
                    result = func(*args, **kwargs)

                # Check if provider reported available data
                if isinstance(result, dict) and result.get("status") in ["AVAILABLE", "PARTIAL"]:
                    return result
                elif result is not None and not isinstance(result, dict):
                    return result
            except Exception as exc:
                logger.warning(
                    "Provider %s failed for domain %s: %s. Trying fallback.",
                    p["name"],
                    domain,
                    str(exc),
                )
                continue

        return None
