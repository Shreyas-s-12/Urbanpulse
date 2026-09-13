"""
UrbanPulse Multi-City Comparison Service
Resolves 2 to 5 global locations independently with complete cross-location isolation.
Normalizes domain scales, preserves standard attributions, formats missing signals as '—',
and synthesizes deterministic, evidence-grounded comparative verdicts.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import asyncio
import logging

from app.services.urban_score import ExplainableScoreService
from app.services.providers.geocoding_provider import GeocodingProvider

logger = logging.getLogger("urbanpulse.comparison")


class ComparisonService:
    @classmethod
    async def compare_locations(
        cls,
        locations: List[Dict[str, Any]],
        radius_km: float = 50.0,
    ) -> Dict[str, Any]:
        """
        Compares 2 to 5 locations independently.
        locations can contain [{'latitude': float, 'longitude': float, 'name': str}, ...]
        or query strings that will be resolved.
        """
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Resolve and calculate score for each city independently & concurrently
        async def _resolve_single_city(loc_input: Dict[str, Any]) -> Optional[Dict[str, Any]]:
            lat = loc_input.get("latitude")
            lng = loc_input.get("longitude")
            query = loc_input.get("name") or loc_input.get("query") or loc_input.get("city")

            # Geocode if lat/lng missing
            if (lat is None or lng is None) and query:
                geo = await GeocodingProvider.geocode(query)
                if geo:
                    lat = geo["latitude"]
                    lng = geo["longitude"]
                    loc_meta = geo
                else:
                    return None
            else:
                loc_meta = loc_input

            if lat is None or lng is None:
                return None

            # Calculate explainable score
            score_data = await ExplainableScoreService.calculate_urbanpulse_score(
                lat, lng, radius_km=radius_km, location_meta=loc_meta
            )

            city_name = loc_meta.get("name") or loc_meta.get("city") or loc_meta.get("displayName") or f"{lat:.2f}, {lng:.2f}"
            loc_meta["name"] = city_name
            comps = score_data.get("components", {})

            traffic_c = comps.get("traffic", {})
            aqi_c = comps.get("air_quality", {})
            weather_c = comps.get("weather", {})
            roads_c = comps.get("roads", {})
            safety_c = comps.get("safety", {})
            hazards_c = comps.get("hazards", {})

            return {
                "location": loc_meta,
                "cityName": city_name,
                "urbanPulseScore": score_data.get("score"),
                "confidence": score_data.get("confidence", 0.8),
                "trafficScore": traffic_c.get("score"),
                "trafficStatus": traffic_c.get("status"),
                "aqiScore": aqi_c.get("score"),
                "aqiMetric": aqi_c.get("metric"),
                "aqiSource": aqi_c.get("source"),
                "weatherScore": weather_c.get("score"),
                "weatherStatus": weather_c.get("status"),
                "roadsScore": roads_c.get("score"),
                "roadsStatus": roads_c.get("status"),
                "safetyScore": safety_c.get("score"),
                "safetyStatus": safety_c.get("status"),
                "hazardsScore": hazards_c.get("score"),
                "hazardsMetric": hazards_c.get("metric"),
                "missingSignals": score_data.get("missingSignals", 0),
            }

        city_tasks = [_resolve_single_city(loc) for loc in locations[:5]]
        city_results = await asyncio.gather(*city_tasks, return_exceptions=True)
        resolved_entries = [r for r in city_results if isinstance(r, dict)]


        if len(resolved_entries) < 2:
            return {
                "error": "At least 2 valid locations are required for comparison.",
                "cities": resolved_entries,
                "matrix": [],
                "verdict": "Insufficient locations successfully resolved for comparison.",
                "confidence": 0.0,
                "timestamp": now_iso,
            }

        # 2. Build structured comparison matrix
        # Missing data is represented as '—', NEVER 0
        def fmt_val(v: Any) -> Any:
            return v if v is not None else "—"

        matrix = [
            {
                "signal": "UrbanPulse Score",
                "values": {e["cityName"]: fmt_val(e["urbanPulseScore"]) for e in resolved_entries},
            },
            {
                "signal": "Traffic & Mobility",
                "values": {e["cityName"]: fmt_val(e["trafficScore"]) for e in resolved_entries},
            },
            {
                "signal": "Air Quality (Standard-Aware)",
                "values": {e["cityName"]: fmt_val(e["aqiScore"]) for e in resolved_entries},
            },
            {
                "signal": "Weather & Climate",
                "values": {e["cityName"]: fmt_val(e["weatherScore"]) for e in resolved_entries},
            },
            {
                "signal": "Roads & Infrastructure",
                "values": {e["cityName"]: fmt_val(e["roadsScore"]) for e in resolved_entries},
            },
            {
                "signal": "Civil Safety",
                "values": {e["cityName"]: fmt_val(e["safetyScore"]) for e in resolved_entries},
            },
            {
                "signal": "Hazard Watch",
                "values": {e["cityName"]: fmt_val(e["hazardsScore"]) for e in resolved_entries},
            },
            {
                "signal": "Data Confidence",
                "values": {e["cityName"]: f"{e['confidence']:.2f}" for e in resolved_entries},
            },
        ]

        # 3. Deterministic Comparative Verdict Synthesis
        # Sort cities by overall score
        sorted_by_score = sorted(
            [e for e in resolved_entries if e["urbanPulseScore"] is not None],
            key=lambda x: x["urbanPulseScore"],
            reverse=True,
        )

        if sorted_by_score:
            leader = sorted_by_score[0]
            follower = sorted_by_score[1] if len(sorted_by_score) > 1 else None

            if follower and leader["urbanPulseScore"] != follower["urbanPulseScore"]:
                diff = leader["urbanPulseScore"] - follower["urbanPulseScore"]

                # Find key domain differences
                strong_lead = []
                strong_follow = []
                for domain_key, label in [("trafficScore", "traffic flow"), ("aqiScore", "air quality"), ("weatherScore", "weather"), ("safetyScore", "civil safety")]:
                    l_val = leader.get(domain_key)
                    f_val = follower.get(domain_key)
                    if l_val is not None and f_val is not None:
                        if l_val > f_val + 5:
                            strong_lead.append(label)
                        elif f_val > l_val + 5:
                            strong_follow.append(label)

                lead_aspects = f"stronger {', '.join(strong_lead)}" if strong_lead else "balanced composite signals"
                follow_contrast = f", although {follower['cityName']} exhibits better {', '.join(strong_follow)}" if strong_follow else ""

                verdict = (
                    f"{leader['cityName']} currently leads with a composite score of {leader['urbanPulseScore']}/100 "
                    f"(+{diff} vs {follower['cityName']}: {follower['urbanPulseScore']}/100) driven by {lead_aspects}{follow_contrast}."
                )
            else:
                verdict = f"{' and '.join(e['cityName'] for e in resolved_entries)} show comparable composite urban livability scores."
        else:
            verdict = "Telemetry across compared cities is partially reporting."

        overall_conf = round(
            sum(e["confidence"] for e in resolved_entries) / max(1, len(resolved_entries)), 2
        )

        return {
            "cities": resolved_entries,
            "matrix": matrix,
            "verdict": verdict,
            "confidence": overall_conf,
            "timestamp": now_iso,
        }
