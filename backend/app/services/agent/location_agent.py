"""
UrbanPulse Location Intelligence Agent
Conversational, location-aware, real-time, map-active, and data-grounded engine.
Understands location queries worldwide, extracts intent, queries real data, answers,
and produces typed Map Actions for Google Maps.
"""

from typing import Any, Dict, List, Optional, Tuple
import asyncio
import re
import json
import logging
from datetime import datetime, timezone
import httpx

from app.core.config import settings
from app.schemas.agent_schema import (
    ParsedAgentIntent,
    AgentMapAction,
    AgentToolActivity,
    AgentInteractionResponse,
)
from app.services.providers.geocoding_provider import GeocodingProvider
from app.services.providers.weather_provider import WeatherProvider
from app.services.providers.air_quality_provider import AirQualityProvider
from app.services.providers.road_provider import RoadProvider
from app.services.providers.crime_provider import CrimeProvider
from app.services.event_fusion import EventFusionService
from app.services.google_traffic import GoogleTrafficService
from app.services.urban_intel import UrbanIntelService
from app.services.forecast.forecasting_service import ForecastingService
from app.pipelines.live_ingestion.event_ingestion import LiveIngestionPipeline
from app.services.rag.rag_service import LocationAwareRAGService
from app.services.agent.openai_agent import OpenAIAgentService
from app.services.change_detection import ChangeDetectionService
from app.services.urban_score import ExplainableScoreService
from app.services.anomaly_detection import AnomalyDetectionService
from app.services.monitoring import MonitoringService
from app.services.scenario_engine import ScenarioEngineService
from app.services.comparison import ComparisonService

logger = logging.getLogger("urbanpulse.agent")


class LocationAgentService:
    @classmethod
    def _parse_intent_heuristics(cls, query: str, current_loc: Optional[Dict[str, Any]] = None) -> ParsedAgentIntent:
        """
        Fast, robust, zero-failure intent extractor for global location queries.
        Handles comparisons, specific domains, follow-ups, and arbitrary city names.
        """
        q = query.strip()
        q_lower = q.lower()

        # 1. Detect multi-city comparison (e.g. "compare Mysuru and Bengaluru", "compare London, Tokyo and New York", "compare that with Mysore")
        comp_match = re.search(r"(?:compare|difference between)\s+(.+?)(?:\?|\.|\!|$)", q, re.IGNORECASE)
        if comp_match:
            raw_locs = comp_match.group(1).strip()
            raw_locs = re.sub(r"(?:air quality|traffic|weather|conditions?|scores?|ratings?)\s+(?:in|between|of)\s+", "", raw_locs, flags=re.IGNORECASE)
            parts = re.split(r",\s*|\s+and\s+|\s+vs\.?\s+", raw_locs, flags=re.IGNORECASE)
            parts = [p.strip() for p in parts if p.strip() and len(p.strip()) > 2 and p.strip().lower() not in ["that", "both", "cities", "the", "them"]]
            if ("that" in q_lower or "with" in q_lower) and current_loc and len(parts) == 1:
                curr_name = current_loc.get("city") or current_loc.get("displayName") or "Current Location"
                parts = [curr_name, parts[0]]
            if len(parts) >= 2:
                return ParsedAgentIntent(
                    intent="COMPARISON",
                    comparison_locations=parts[:5],
                    requires_comparison=True,
                    location_query=parts[0],
                )

        # 2. Domain classification
        intent = "GENERAL_INTELLIGENCE"
        if any(w in q_lower for w in ["what changed", "what's changed", "what has changed", "different from yesterday", "changes in", "changed in", "last 6 hours", "last 24 hours", "today vs yesterday", "changed today", "changed here", "what's different"]):
            intent = "WHAT_CHANGED"
        elif any(w in q_lower for w in ["why is the score", "why is score", "why score", "why did the score", "why rating", "explain score", "factors behind score", "why is"]) and any(w in q_lower for w in ["score", "rating", "fall", "low", "high", "drop", "76", "78", "80", "85", "70", "65", "60", "90"]):
            intent = "WHY_SCORE"
        elif any(w in q_lower for w in ["simulate", "what happens if", "what if", "scenario", "what would happen"]):
            intent = "SIMULATE"
        elif any(w in q_lower for w in ["unusual", "anything unusual", "anomaly", "anomalies", "abnormal", "is anything strange", "something strange"]):
            intent = "ANOMALY"
        elif any(w in q_lower for w in ["monitor", "keep an eye on", "watch this location", "watch this area", "stop monitoring", "track this area"]):
            intent = "MONITOR"
        elif any(w in q_lower for w in ["monthly outlook", "30 day", "30-day", "long range", "next month", "climatology"]):
            intent = "MONTHLY_OUTLOOK"
        elif any(w in q_lower for w in ["forecast", "7 day", "7-day", "next week", "upcoming week", "outlook"]):
            intent = "FORECAST"
        elif any(w in q_lower for w in ["live update", "live updates", "recent update", "recent updates", "advisory", "bulletin"]):
            intent = "LIVE_UPDATES"
        elif any(w in q_lower for w in ["traffic", "congestion", "bottleneck", "delay", "jam", "cars", "drive"]):
            intent = "TRAFFIC"
        elif any(w in q_lower for w in ["weather", "temperature", "rain", "rainy", "temp", "humidity", "wind"]):
            intent = "WEATHER"
        elif any(w in q_lower for w in ["air quality", "aqi", "pollution", "smog", "air", "pm2.5", "pm10", "cpcb"]):
            intent = "AIR_QUALITY"
        elif any(w in q_lower for w in ["rating", "score", "overall", "condition", "status of", "health", "livability"]):
            intent = "OVERALL_RATING"
        elif any(w in q_lower for w in ["road", "roads", "pothole", "potholes", "pavement", "asphalt", "road surface", "road condition", "road closures", "closure", "closures", "street condition"]):
            intent = "ROADS"
        elif any(w in q_lower for w in ["police", "crime", "public safety", "safety incident", "safety incidents", "safety alert", "safety alerts", "civil safety", "law enforcement", "dispatch"]):
            intent = "CIVIL_SAFETY"
        elif any(w in q_lower for w in ["hazard", "danger"]):
            intent = "HAZARDS"
        elif any(w in q_lower for w in ["event", "incident", "happening", "activity", "alert", "quake", "earthquake"]):
            intent = "EVENTS"
        elif any(w in q_lower for w in ["route", "safest route", "directions", "how to reach"]):
            intent = "ROUTE"

        # 3. Location extraction
        loc_patterns = [
            r"(?:show me|tell me|what is|how is|what's|give me|what are)\s+(?:the\s+)?(?:current\s+)?(?:traffic|weather|air quality|aqi|rating|overall rating|forecast|outlook|updates|live updates|road conditions|road hazards|road surface|roads|potholes|public safety alerts|safety alerts|safety incidents|civil safety|hazards)\s+\b(?:in|for|at|around|near|of)\s+([a-zA-Z\s.,'-]+?)(?:\?|\.|\!|$)",
            r"(?:forecast|outlook|updates|traffic|weather|aqi|air quality|rating|condition|road conditions|road hazards|road surface|roads|potholes|safety alerts|public safety|safety incidents|civil safety)\s+\b(?:for|in|at|around|near|of)\s+([a-zA-Z\s.,'-]+?)(?:\?|\.|\!|$)",
            r"\b(?:in|at|around|for|near|of|to|check)\s+([a-zA-Z\s.,'-]+?)(?:\?|\.|\!|$)",
            r"^([a-zA-Z\s.,'-]+?)\s+(?:traffic|weather|aqi|air quality|rating|overall rating|condition|forecast|outlook|updates|roads|road conditions|road surface|potholes|safety alerts|civil safety)",
        ]

        extracted_loc: Optional[str] = None
        stop_words = {
            "it", "this", "here", "today", "now", "me", "there", "us", "the city", "my location",
            "air quality", "the air quality", "weather", "the weather", "traffic", "the traffic",
            "rating", "overall rating", "condition", "the condition", "air", "the air",
            "how is the", "what is the", "tell me the", "show me", "how is", "what's the"
        }

        for pat in loc_patterns:
            m = re.search(pat, q, re.IGNORECASE)
            if m:
                candidate = m.group(1).strip()
                # Ensure candidate is not a question fragment or domain word
                cand_lower = candidate.lower()
                if cand_lower not in stop_words and len(candidate) > 2:
                    if not any(cand_lower.startswith(prefix) for prefix in ["how ", "what ", "where ", "tell ", "show ", "the "]):
                        extracted_loc = candidate
                        break
                    elif cand_lower.startswith("the "):
                        trimmed = candidate[4:].strip()
                        if trimmed.lower() not in stop_words and len(trimmed) > 2:
                            extracted_loc = trimmed
                            break

        is_follow_up = False
        if not extracted_loc or extracted_loc.lower() in stop_words:
            if current_loc and current_loc.get("latitude") and current_loc.get("longitude"):
                extracted_loc = None
                is_follow_up = True

        return ParsedAgentIntent(
            intent=intent,
            location_query=extracted_loc,
            is_follow_up=is_follow_up,
        )



    @classmethod
    async def extract_intent(cls, query: str, current_loc: Optional[Dict[str, Any]] = None) -> ParsedAgentIntent:
        """
        Extracts structured intent using LLM if available, with immediate fallback to fast heuristics.
        """
        # Fast path heuristics (100% deterministic & zero external latency)
        heuristic_res = cls._parse_intent_heuristics(query, current_loc)

        # If LLM API key exists, attempt structured extraction; otherwise return heuristic
        if not settings.OPENAI_API_KEY and not settings.GOOGLE_API_KEY:
            return heuristic_res

        # Try LLM if available for complex nuances
        try:
            if settings.OPENAI_API_KEY:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    messages = [
                        {
                            "role": "system",
                            "content": (
                                "You are a location intent extractor. Return ONLY a JSON object with: "
                                "intent (TRAFFIC|WEATHER|AIR_QUALITY|OVERALL_RATING|EVENTS|HAZARDS|ROUTE|GENERAL_INTELLIGENCE|COMPARISON), "
                                "location_query (string or null), "
                                "comparison_locations (list of strings or null), "
                                "is_follow_up (boolean)."
                            ),
                        },
                        {"role": "user", "content": f"User query: '{query}'. Active location: '{current_loc.get('city') if current_loc else None}'"},
                    ]
                    res = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                        json={
                            "model": "gpt-4o-mini",
                            "messages": messages,
                            "response_format": {"type": "json_object"},
                            "temperature": 0.0,
                        },
                    )
                    if res.status_code == 200:
                        parsed = json.loads(res.json()["choices"][0]["message"]["content"])
                        return ParsedAgentIntent(
                            intent=parsed.get("intent", heuristic_res.intent),
                            location_query=parsed.get("location_query") or heuristic_res.location_query,
                            comparison_locations=parsed.get("comparison_locations") or heuristic_res.comparison_locations,
                            requires_comparison=bool(parsed.get("comparison_locations")),
                            is_follow_up=parsed.get("is_follow_up", heuristic_res.is_follow_up),
                        )
        except Exception as e:
            logger.debug("LLM intent parsing skipped/errored (%s), using heuristic parser", e)

        return heuristic_res

    @classmethod
    async def resolve_target_location(
        cls, location_query: Optional[str], current_loc: Optional[Dict[str, Any]] = None
    ) -> Tuple[Optional[Dict[str, Any]], List[AgentToolActivity]]:
        """
        Resolves arbitrary string query into authoritative geographic coordinates.
        Never uses hardcoded cities as default fallbacks.
        """
        activities: List[AgentToolActivity] = []

        if not location_query:
            if current_loc and current_loc.get("latitude") and current_loc.get("longitude"):
                activities.append(
                    AgentToolActivity(
                        step="Retaining current active location",
                        status="COMPLETED",
                        detail=current_loc.get("displayName") or current_loc.get("city") or "Current Coordinates",
                    )
                )
                return current_loc, activities
            return None, activities

        activities.append(
            AgentToolActivity(
                step=f"Resolving location for '{location_query}'",
                status="IN_PROGRESS",
                detail="Querying global geocoding index",
            )
        )

        results = await GeocodingProvider.search(location_query)
        if results and len(results) > 0:
            resolved = results[0]
            resolved["isUserLocation"] = False
            city_label = resolved.get("city") or resolved.get("displayName") or location_query
            activities.append(
                AgentToolActivity(
                    step="Location resolved",
                    status="COMPLETED",
                    detail=f"{city_label}, {resolved.get('country') or ''} ({resolved['latitude']:.4f}, {resolved['longitude']:.4f})",
                )
            )
            return resolved, activities

        activities.append(
            AgentToolActivity(
                step=f"Could not resolve '{location_query}'",
                status="FAILED",
                detail="No coordinates found in global index",
            )
        )
        return None, activities

    @classmethod
    def _determine_zoom(cls, loc: Dict[str, Any]) -> int:
        """Determines appropriate Google Map zoom based on geographic hierarchy."""
        if loc.get("city") or loc.get("district"):
            return 12  # City level zoom
        if loc.get("state") or loc.get("region"):
            return 9   # Regional zoom
        if loc.get("country"):
            return 5   # Country level zoom
        return 12

    @classmethod
    async def process_interaction(cls, req: Dict[str, Any]) -> Dict[str, Any]:
        """
        Core Agent Orchestration Loop:
        1. Extract Intent & Location
        2. Resolve Location Coordinates
        3. Concurrently fetch verified real-time data
        4. Synthesize Answer + Provenance
        5. Formulate strict Map Actions
        """
        query = req.get("query", "").strip()
        query_lower = query.lower()
        current_loc = req.get("current_location")
        radius_km = float(req.get("selected_radius_km", 50.0))
        now_iso = datetime.now(timezone.utc).isoformat()

        all_activities: List[AgentToolActivity] = []

        # Step 1: Intent Extraction
        parsed = await cls.extract_intent(query, current_loc)
        intent = parsed.intent

        # Handle Multi-City Comparison Requests (2 to 5 locations)
        if parsed.intent == "COMPARISON" and parsed.comparison_locations and len(parsed.comparison_locations) >= 2:
            loc_names = parsed.comparison_locations[:5]
            all_activities.append(AgentToolActivity(step=f"Comparing {', '.join(loc_names)}", status="IN_PROGRESS"))

            comp_res = await ComparisonService.compare_locations(
                locations=[{"name": name} for name in loc_names], radius_km=radius_km
            )

            if comp_res.get("cities") and len(comp_res["cities"]) >= 2:
                primary_loc = comp_res["cities"][0]["location"]

                # Render markdown comparison table
                cities_header = " | ".join(c["cityName"] for c in comp_res["cities"])
                separator = " | ".join("---" for _ in comp_res["cities"])
                table_lines = [f"| Metric | {cities_header} |", f"| --- | {separator} |"]

                for row in comp_res.get("matrix", []):
                    row_vals = " | ".join(str(row["values"].get(c["cityName"], "—")) for c in comp_res["cities"])
                    table_lines.append(f"| **{row['signal']}** | {row_vals} |")

                table_md = "\n".join(table_lines)
                title_prefix = "Air Quality Comparison" if any(w in query.lower() for w in ["air", "aqi", "pollution", "smog"]) else "Urban Intelligence Comparison"
                msg = (
                    f"### {title_prefix}\n\n"
                    f"{table_md}\n\n"
                    f"**Comparative Verdict**:\n{comp_res['verdict']}\n\n"
                    f"*Note: Domain metrics are independently gathered with standardized regional scales. Missing feeds are indicated with '—' rather than zero.*"
                )

                all_activities.append(AgentToolActivity(step="Multi-city comparison complete", status="COMPLETED"))

                actions = [
                    AgentMapAction(type="CENTER_MAP", payload={"latitude": primary_loc["latitude"], "longitude": primary_loc["longitude"], "zoom": 5}),
                    AgentMapAction(type="SHOW_COMPARISON", payload={"cities": [c["location"] for c in comp_res["cities"]]}),
                ]

                sources = [
                    {"type": "City Comparison", "source": "UrbanPulse Multi-City Engine", "detail": f"{len(comp_res['cities'])} cities evaluated independently"}
                ]

                # Backward compatibility payload for 2-city comparison consumers
                legacy_comp = None
                if len(comp_res["cities"]) >= 2:
                    c0 = comp_res["cities"][0]
                    c1 = comp_res["cities"][1]
                    val0 = c0.get("aqiScore") if "air" in query.lower() or "aqi" in query.lower() else c0.get("urbanPulseScore")
                    val1 = c1.get("aqiScore") if "air" in query.lower() or "aqi" in query.lower() else c1.get("urbanPulseScore")
                    legacy_comp = {
                        "locationA": {
                            "city": c0["cityName"],
                            "location": c0["location"],
                            "summary": {"value": val0, "status": c0.get("aqiMetric") or "Score"},
                        },
                        "locationB": {
                            "city": c1["cityName"],
                            "location": c1["location"],
                            "summary": {"value": val1, "status": c1.get("aqiMetric") or "Score"},
                        },
                        "verdict": comp_res.get("verdict", ""),
                    }

                resp_data = {"cityComparison": comp_res}
                if legacy_comp:
                    resp_data["comparison"] = legacy_comp

                return {
                    "id": f"AGENT-{int(datetime.now(timezone.utc).timestamp())}",
                    "message": msg,
                    "intent": "COMPARISON",
                    "location": primary_loc,
                    "data": resp_data,
                    "sources": sources,
                    "confidence": comp_res.get("confidence", 0.88),
                    "actions": [a.model_dump() for a in actions],
                    "tool_activities": [a.model_dump() for a in all_activities],
                    "timestamp": now_iso,
                }



        # Step 2: Location Resolution
        target_loc, res_activities = await cls.resolve_target_location(parsed.location_query, current_loc)
        all_activities.extend(res_activities)

        if not target_loc:
            return {
                "id": f"AGENT-{int(datetime.now(timezone.utc).timestamp())}",
                "message": f"I couldn't identify the specific location for '{query}'. Please name a city, address, or point on the map.",
                "intent": intent,
                "location": None,
                "data": {},
                "sources": [],
                "confidence": 0.0,
                "actions": [],
                "tool_activities": [a.model_dump() for a in all_activities],
                "timestamp": now_iso,
            }

        lat = target_loc["latitude"]
        lon = target_loc["longitude"]
        city_display = target_loc.get("city") or target_loc.get("displayName") or f"({lat:.3f}, {lon:.3f})"
        zoom = cls._determine_zoom(target_loc)

        actions: List[AgentMapAction] = [
            AgentMapAction(type="CENTER_MAP", payload={"latitude": lat, "longitude": lon, "zoom": zoom, "radiusKm": radius_km})
        ]

        data_payload: Dict[str, Any] = {}
        sources: List[Dict[str, Any]] = []
        message = ""
        confidence = 0.9

        # Step 3: Tool Execution & Grounded Data Fetching
        if intent == "TRAFFIC":
            all_activities.append(AgentToolActivity(step=f"Checking live Google Traffic for {city_display}", status="IN_PROGRESS"))
            traffic_summary = await GoogleTrafficService.get_traffic_summary(lat, lon, radius_km)
            data_payload["traffic"] = traffic_summary

            actions.append(AgentMapAction(type="SHOW_TRAFFIC_LAYER"))

            if traffic_summary.get("status") == "AVAILABLE":
                status_label = traffic_summary.get("trafficStatus", "NORMAL")
                delay = traffic_summary.get("delayMinutes", 0)
                detail = traffic_summary.get("detail", "Normal traffic flow")
                corridor = traffic_summary.get("corridor") or "primary arteries"

                if status_label in ("HEAVY", "SEVERE"):
                    message = (
                        f"Current traffic in **{city_display}** is **{status_label.lower()}** around {corridor}. "
                        f"Traffic-aware route telemetry indicates delays of approximately **+{delay} minutes** ({detail}). "
                        f"The Google Traffic layer is now visible on the map."
                    )
                else:
                    message = (
                        f"Current traffic in **{city_display}** is **{status_label.lower()}** ({detail}). "
                        f"Corridors are currently flowing with minimal disruption (+{delay}m delay). "
                        f"Google Traffic conditions are displayed on the map."
                    )
                sources.append({
                    "type": "Traffic",
                    "source": traffic_summary.get("source", "Google Routes API"),
                    "detail": f"{status_label} (+{delay}m)",
                    "observedAt": traffic_summary.get("lastUpdated"),
                    "freshness": "LIVE",
                })
                all_activities.append(AgentToolActivity(step="Google traffic data synchronized", status="COMPLETED"))
            else:
                message = f"Verified live traffic data isn't available for **{city_display}** right now. The map has been centered on the city."
                all_activities.append(AgentToolActivity(step="No verified traffic feed available", status="COMPLETED"))
                confidence = 0.5

        elif intent == "WEATHER":
            all_activities.append(AgentToolActivity(step=f"Querying meteorological telemetry for {city_display}", status="IN_PROGRESS"))
            weather_res = WeatherProvider.get_weather(lat, lon)
            data_payload["weather"] = weather_res

            if weather_res.get("status") == "AVAILABLE" and weather_res.get("current"):
                curr = weather_res["current"]
                temp = curr.get("temperatureC", "--")
                feels_like = curr.get("apparentTemperatureC", temp)
                cond = curr.get("conditionLabel", "Clear")
                humidity = curr.get("humidity", 0)
                wind = curr.get("windSpeedKmh", 0)
                rain_prob = curr.get("rainProbability", 0)
                src = weather_res.get("source", "Open-Meteo API")

                message = (
                    f"Current weather in **{city_display}**: **{temp}** ({cond}, feels like {feels_like}). "
                    f"Humidity is at **{humidity}%**, wind speed is **{wind} km/h**, and precipitation probability is **{rain_prob}%**."
                )
                sources.append({
                    "type": "Weather",
                    "source": src,
                    "detail": f"{temp}, {cond}",
                    "observedAt": weather_res.get("lastUpdated"),
                    "freshness": "LIVE",
                })
                all_activities.append(AgentToolActivity(step="Weather telemetry retrieved", status="COMPLETED"))
            else:
                message = f"Weather data is currently unavailable for **{city_display}**."
                all_activities.append(AgentToolActivity(step="Weather feed unavailable", status="FAILED"))
                confidence = 0.4

        elif intent == "AIR_QUALITY":
            all_activities.append(AgentToolActivity(step=f"Analyzing air quality sensors for {city_display}", status="IN_PROGRESS"))
            country_code = target_loc.get("countryCode")
            aqi_res = await AirQualityProvider.get_air_quality(lat, lon, country_code=country_code)
            data_payload["airQuality"] = aqi_res

            actions.append(AgentMapAction(type="SHOW_AQI_LAYER", payload={"latitude": lat, "longitude": lon, "data": aqi_res}))

            if aqi_res.get("status") == "AVAILABLE" and aqi_res.get("value") is not None:
                val = aqi_res["value"]
                cat = aqi_res.get("category", "Moderate")
                scale = aqi_res.get("scale", "AQI")
                pollutant = aqi_res.get("pollutant", "PM2.5")
                src = aqi_res.get("source", "Open-Meteo CAMS/SILAM")
                breakdown = aqi_res.get("breakdown") or {}

                pm25_txt = f" • PM2.5: {breakdown.get('pm2_5')} µg/m³" if breakdown.get("pm2_5") is not None else ""
                message = (
                    f"Air quality in **{city_display}** is currently **{cat}** with an index of **{val}** on the **{scale}** scale "
                    f"(primary pollutant: {pollutant}{pm25_txt}). "
                    f"The AQI visualization layer has been activated on the map."
                )
                sources.append({
                    "type": "Air Quality",
                    "source": src,
                    "detail": f"{scale} {val} ({cat})",
                    "observedAt": aqi_res.get("observedAt"),
                    "freshness": "LIVE",
                })
                all_activities.append(AgentToolActivity(step=f"AQI computed via {scale}", status="COMPLETED"))
            else:
                message = f"No verified AQI data is available for **{city_display}** right now. The map is centered on the requested location."
                all_activities.append(AgentToolActivity(step="No verified AQI feed", status="COMPLETED"))
                confidence = 0.5

        elif intent in ("WHY_SCORE", "OVERALL_RATING"):
            all_activities.append(AgentToolActivity(step=f"Analyzing explainable UrbanPulse score and factor attribution for {city_display}", status="IN_PROGRESS"))
            intel = await UrbanIntelService.get_full_intelligence(lat, lon, radius_km=radius_km)
            cond = intel.get("condition", {})
            weather_data = intel.get("weather", {})
            traffic_data = intel.get("traffic", {})
            aqi_data = intel.get("airQuality", {})
            roads_data = intel.get("roads", {})
            events_data = intel.get("events", [])

            data_payload["condition"] = cond
            data_payload["weather"] = weather_data
            data_payload["traffic"] = traffic_data
            data_payload["airQuality"] = aqi_data
            data_payload["roads"] = roads_data
            data_payload["events"] = events_data

            score_res = await ExplainableScoreService.calculate_urbanpulse_score(lat, lon, radius_km=radius_km, location_meta=target_loc)
            data_payload["explainableScore"] = score_res

            sc = score_res.get("score")
            conf_val = score_res.get("confidence", cond.get("confidence", 0.8))
            known = score_res.get("knownSignals", cond.get("knownSignals", 5))
            missing = score_res.get("missingSignals", cond.get("missingSignals", 1))
            comps = score_res.get("components", {})
            trend = score_res.get("trend", "STABLE")
            trend_symbol = "↑ Improving" if trend == "IMPROVING" else ("↓ Deteriorating" if trend == "DETERIORATING" else "→ Stable")

            comp_lines = []
            for dom, detail in comps.items():
                val_txt = f"{detail['score']} / 100" if detail['score'] is not None else "— (Unmonitored)"
                comp_lines.append(f"• **{detail['name']}**: {val_txt} ({detail['status']}) — *{detail['metric']}*")

            comp_txt = "\n".join(comp_lines)

            message = (
                f"### UrbanPulse Score for {city_display}: {sc} / 100 ({trend_symbol})\n\n"
                f"**Factor Attribution**:\n"
                f"• **Main positive factors**: {', '.join(score_res.get('positiveFactors', [])) or 'None above 75'}\n"
                f"• **Main negative factors**: {', '.join(score_res.get('negativeFactors', [])) or 'None below 70'}\n\n"
                f"**Domain Breakdown**:\n"
                f"{comp_txt}\n\n"
                f"**Why this score?**\n{score_res.get('explanation')}\n\n"
                f"*Confidence is {int(conf_val * 100)}% based on {known} verified domain feeds and {missing} missing feeds.*"
            )

            actions.append(AgentMapAction(type="SHOW_SCORE", payload={"score": score_res}))
            actions.append(AgentMapAction(type="SHOW_EVENTS_LAYER"))
            if traffic_data.get("status") == "AVAILABLE":
                actions.append(AgentMapAction(type="SHOW_TRAFFIC_LAYER"))

            sources.append({"type": "Urban Score", "source": "UrbanPulse Deterministic Scoring Engine", "detail": f"Score {sc}/100"})
            all_activities.append(AgentToolActivity(step="Explainable score factor attribution calculated", status="COMPLETED"))
            confidence = conf_val

        elif intent == "WHAT_CHANGED":
            window = "6h"
            for w_cand in ["1h", "6h", "12h", "24h", "7d"]:
                if w_cand in query_lower or w_cand.replace("h", " hours") in query_lower or w_cand.replace("d", " days") in query_lower:
                    window = w_cand
                    break
            if "yesterday" in query_lower:
                window = "24h"

            all_activities.append(AgentToolActivity(step=f"Comparing conditions for {city_display} over the last {window}", status="IN_PROGRESS"))
            changes_res = await ChangeDetectionService.get_location_changes(lat, lon, window=window, radius_km=radius_km, location_meta=target_loc)
            data_payload["changes"] = changes_res

            meaningful = changes_res.get("meaningfulChanges", [])
            m_count = changes_res.get("meaningfulCount", 0)

            change_bullets = []
            for c in changes_res.get("changes", []):
                dir_arrow = "↑" if c["direction"] == "UP" else ("↓" if c["direction"] == "DOWN" else "→")
                delta_desc = f"{dir_arrow} {abs(c['percentChange']):.0f}%" if c.get("percentChange") is not None else f"{dir_arrow} {c['delta']}"
                sig_badge = " [Significant]" if c.get("isMeaningful") else ""
                change_bullets.append(f"• **{c['label']}**: {delta_desc}{sig_badge} — {c['description']}")

            bullet_txt = "\n".join(change_bullets)
            message = (
                f"### What Changed in {city_display} (Last {window})\n\n"
                f"**{m_count} meaningful change(s)** detected against baseline:\n\n"
                f"{bullet_txt}\n\n"
                f"**MAIN CHANGE**:\n{changes_res.get('mainChange')}\n\n"
                f"*Data grounded in Open-Meteo hourly archives, Google Traffic delay ratios, and verified corridor event streams.*"
            )

            actions.append(AgentMapAction(type="SHOW_CHANGES", payload={"changes": changes_res}))
            sources.append({"type": "Change Detection", "source": "Open-Meteo & Google Routes Historical Baseline", "detail": f"Window: {window}"})
            all_activities.append(AgentToolActivity(step="Change detection baseline evaluation complete", status="COMPLETED"))
            confidence = changes_res.get("confidence", 0.88)

        elif intent == "ANOMALY":
            all_activities.append(AgentToolActivity(step=f"Evaluating statistical anomaly departures for {city_display}", status="IN_PROGRESS"))
            anom_res = await AnomalyDetectionService.detect_anomalies(lat, lon, radius_km=radius_km, location_meta=target_loc)
            data_payload["anomalies"] = anom_res

            anom_list = anom_res.get("anomalies", [])
            if anom_list:
                anom_lines = []
                for a in anom_list:
                    anom_lines.append(f"• **{a['signal']}** [{a['anomalyType']} - {a['severity']}]: {a['currentValue']} (Expected: {a['expectedBaseline']}) — {a['explanation']}")
                anom_txt = "\n".join(anom_lines)
                message = (
                    f"### Anomaly Alert for {city_display}\n\n"
                    f"Detected **{len(anom_list)} statistical anomaly(s)** departing from 7-day diurnal baselines:\n\n"
                    f"{anom_txt}\n\n"
                    f"*Statistical anomalies are computed via 7-day diurnal rolling mean, standard deviation (z-score), and verified event clusters.*"
                )
            else:
                message = (
                    f"### Baseline Normal for {city_display}\n\n"
                    f"No statistically significant anomalies detected in traffic delays, air quality, meteorological variables, or hazard frequency over the last 24 hours. "
                    f"All monitored signals are tracking their expected diurnal baselines."
                )

            actions.append(AgentMapAction(type="SHOW_ANOMALIES", payload={"anomalies": anom_res}))
            sources.append({"type": "Anomaly Engine", "source": "Open-Meteo & Google Routes 7-Day Baseline", "detail": f"{len(anom_list)} anomalies"})
            all_activities.append(AgentToolActivity(step="Anomaly detection completed", status="COMPLETED"))
            confidence = anom_res.get("confidence", 0.88)

        elif intent == "SIMULATE":
            all_activities.append(AgentToolActivity(step=f"Running deterministic scenario simulation for {city_display}", status="IN_PROGRESS"))
            s_type = "heavy_rainfall"
            if any(w in query_lower for w in ["road closure", "closure", "closed"]):
                s_type = "major_road_closure"
            elif any(w in query_lower for w in ["traffic", "congestion", "surge"]):
                s_type = "traffic_increase"
            elif any(w in query_lower for w in ["pollution", "aqi", "smog", "air"]):
                s_type = "aqi_deterioration"
            elif any(w in query_lower for w in ["flood", "inundation"]):
                s_type = "flood_scenario"

            sim_res = await ScenarioEngineService.simulate_scenario(lat, lon, scenario_type=s_type, radius_km=radius_km, location_meta=target_loc)
            data_payload["scenario"] = sim_res

            assump_txt = "\n".join(f"- {a}" for a in sim_res.get("assumptions", []))
            limit_txt = "\n".join(f"- {l}" for l in sim_res.get("limitations", []))

            message = (
                f"### **[SIMULATION]** {sim_res.get('scenarioTitle')} for {city_display}\n\n"
                f"> **Important**: This output is a **SIMULATION** model projection, NOT a live observation or guaranteed prediction.\n\n"
                f"• **Baseline UrbanPulse Score**: {sim_res.get('baselineScore')} / 100\n"
                f"• **Projected Score Range**: **{sim_res['projectedScoreRange'][0]} – {sim_res['projectedScoreRange'][1]} / 100**\n"
                f"• **Projected Mobility Impact**: {sim_res.get('projectedTrafficImpact')}\n"
                f"• **Projected Flood Risk**: {sim_res.get('projectedFloodRisk')}\n\n"
                f"**Key Model Assumptions**:\n{assump_txt}\n\n"
                f"**Model Limitations**:\n{limit_txt}\n\n"
                f"*Confidence: {int(sim_res.get('confidence', 0.65) * 100)}%*"
            )

            actions.append(AgentMapAction(type="SHOW_SCENARIO", payload={"scenario": sim_res}))
            sources.append({"type": "Simulation", "source": "UrbanPulse Deterministic Scenario Engine", "detail": sim_res.get("scenarioTitle")})
            all_activities.append(AgentToolActivity(step="Deterministic simulation model completed", status="COMPLETED"))
            confidence = sim_res.get("confidence", 0.68)

        elif intent == "MONITOR":
            all_activities.append(AgentToolActivity(step=f"Configuring location monitor for {city_display}", status="IN_PROGRESS"))
            if any(w in query_lower for w in ["stop", "pause", "disable", "cancel", "delete"]):
                mons = MonitoringService.list_monitors()
                for m in mons:
                    MonitoringService.delete_monitor(m["id"])
                message = f"Location monitoring has been **deactivated** for **{city_display}**."
            else:
                signals = ["traffic", "hazards", "aqi", "events"]
                if "traffic" in query_lower:
                    signals = ["traffic"]
                elif "aqi" in query_lower or "air" in query_lower:
                    signals = ["aqi"]
                elif "flood" in query_lower or "hazard" in query_lower:
                    signals = ["hazards", "events"]

                mon = MonitoringService.create_monitor(target_loc, radius_km=radius_km, signals=signals)
                data_payload["monitors"] = [mon]
                message = (
                    f"### Location Monitor Armed: {city_display}\n\n"
                    f"• **Monitor ID**: `{mon['id']}`\n"
                    f"• **Coverage Radius**: {radius_km:.0f} km\n"
                    f"• **Monitored Signals**: {', '.join(s.upper() for s in signals)}\n"
                    f"• **Trigger Rules**: Evaluates background data against local diurnal baselines; non-intrusive alert issued upon verified deterioration.\n"
                    f"• **Status**: Active and tracking."
                )

            sources.append({"type": "Monitoring", "source": "UrbanPulse Monitoring & Alert Engine", "detail": f"Active Watch: {city_display}"})
            all_activities.append(AgentToolActivity(step="Monitoring configuration saved", status="COMPLETED"))
            confidence = 0.95

        elif intent in ("ROADS", "CIVIL_SAFETY", "EVENTS", "HAZARDS"):
            all_activities.append(AgentToolActivity(step=f"Scanning live events and infrastructure feeds within {radius_km} km of {city_display}", status="IN_PROGRESS"))
            fusion_res = await EventFusionService.get_live_events_near_location(lat, lon, radius_km, city_name=city_display)
            events = fusion_res.get("events", [])
            data_payload["events"] = events
            actions.append(AgentMapAction(type="SHOW_EVENTS_LAYER"))

            is_road_query = intent == "ROADS" or any(w in query_lower for w in ["road", "pothole", "asphalt", "pavement", "street condition"])
            is_civil_query = intent == "CIVIL_SAFETY" or any(w in query_lower for w in ["police", "crime", "safety alert", "public safety", "dispatch"])

            if is_road_query:
                road_info = await RoadProvider.get_road_status_async(lat, lon, radius_km, events)
                data_payload["roads"] = road_info
                pothole_count = road_info.get("condition", {}).get("potholeCount", 0)
                surface_type = road_info.get("surface", {}).get("material", "Asphalt / Paved")
                surface_label = road_info.get("surface", {}).get("type", "ASPHALT")
                meas_type = road_info.get("surface", {}).get("measurementType", "MAPPED_ATTRIBUTE")

                message = (
                    f"**Road Surface & Infrastructure for {city_display}** ({radius_km} km radius):\n\n"
                    f"- **Network Mapping**: {road_info.get('roadNetworkStatus', 'AVAILABLE')} (Primary/secondary corridors mapped)\n"
                    f"- **Surface Material**: **{surface_label}** (*source: OpenStreetMap mapped attributes*)\n"
                    f"- **Pavement Condition**: {road_info.get('condition', {}).get('message', 'No continuous sensor feed')}\n"
                    f"- **Active Road Hazards**: {pothole_count} verified alert(s) in active radius\n\n"
                    f"*Note: UrbanPulse clearly distinguishes mapped road geometry from physical pavement roughness inspection.*"
                )
                for s in road_info.get("sources", []):
                    sources.append({"type": "Roads", "source": s.get("name"), "detail": s.get("role", "Road Telemetry")})
            elif is_civil_query:
                safety_info = await CrimeProvider.get_crime_events_async(
                    lat, lon, radius_km, country_code=target_loc.get("countryCode"), city=city_display, corridor_events=events
                )
                data_payload["civilSafety"] = safety_info
                incidents = safety_info.get("incidents", [])
                updates = safety_info.get("updates", [])
                alerts = safety_info.get("alerts", [])

                if safety_info.get("feedCapability") in ("OFFICIAL_PUBLIC_SAFETY_FEED", "OPEN_CRIME_DATA"):
                    message = (
                        f"**Civil Safety & Public Feeds for {city_display}**:\n\n"
                        f"- **Feed Status**: **{safety_info.get('status')}** ({safety_info.get('sources', [{}])[0].get('name')})\n"
                        f"- **Verified Incidents**: **{safety_info.get('incidentCount', 0)}** record(s) indexed\n"
                        f"- **Public Safety Alerts**: {len(alerts)} verified alert(s)\n"
                        f"- **Active Advisories**: {len(updates)} civic safety advisory(s)\n\n"
                        f"*Law enforcement open data connected for this jurisdiction.*"
                    )
                else:
                    message = (
                        f"**Civil Safety & Public Feeds for {city_display}**:\n\n"
                        f"- **Feed Status**: {safety_info.get('message', 'No verified public safety feed covers this location.')}\n"
                        f"- **Public Safety Alerts**: {len(alerts)} verified alert(s)\n"
                        f"- **Authoritative Advisories**: {len(updates)} civil defense bulletin(s) active\n\n"
                        f"*UrbanPulse strictly refrains from reporting '0 crimes' or false safety guarantees in the absence of verified law enforcement feeds.*"
                    )
                for s in safety_info.get("sources", []):
                    sources.append({"type": "Civil Safety", "source": s.get("name"), "detail": s.get("authority", "Public Safety")})
            elif events:
                top_ev = events[0]
                message = (
                    f"Found **{len(events)} active event(s)** within {radius_km} km of **{city_display}**. "
                    f"Highest severity event: **{top_ev.get('title')}** ({top_ev.get('eventType')}, severity {top_ev.get('severity')}/100, {top_ev.get('distanceKm')} km away). "
                    f"Event markers are displayed on the map."
                )
                sources.append({"type": "Events", "source": top_ev.get("source", "City Feed"), "detail": top_ev.get("title")})
            else:
                message = f"Zero active hazards or civic disruptions detected within {radius_km} km of **{city_display}**."
            all_activities.append(AgentToolActivity(step=f"Event scan completed ({len(events)} events)", status="COMPLETED"))

        elif intent in ("FORECAST", "MONTHLY_OUTLOOK"):
            horizon = "30_DAYS" if intent == "MONTHLY_OUTLOOK" else "7_DAYS"
            all_activities.append(AgentToolActivity(step=f"Synthesizing {horizon} multi-pillar forecast for {city_display}", status="IN_PROGRESS"))

            if horizon == "30_DAYS":
                forecast_res = await ForecastingService.get_30_day_outlook(lat, lon, target_loc)
                data_payload["forecast"] = forecast_res
                actions.append(AgentMapAction(type="SHOW_FORECAST", payload={"horizon": "30_DAYS", "forecast": forecast_res}))

                outlook = forecast_res.get("monthlyOutlook", {})
                expected = outlook.get("expectedRange", [50, 75])
                trend = outlook.get("trend", "Seasonal Transition")
                message = (
                    f"**30-Day Outlook for {city_display}** ({trend}):\n\n"
                    f"{forecast_res.get('summary')}\n\n"
                    f"- **Expected Urban Condition Range**: {expected[0]}–{expected[1]} / 100\n"
                    f"- **Model Confidence**: {int(forecast_res.get('confidence', 0.62) * 100)}%\n"
                    f"- **Seasonal Dynamics & Risks**:\n" +
                    "\n".join(f"  - {rf}" for rf in outlook.get("riskFactors", [])) + "\n\n"
                    f"*Note: Outlook reflects climatological tendencies and deterministic historical boundaries. Exact 30-day daily numbers are not fabricated.*"
                )
            else:
                forecast_res = await ForecastingService.get_7_day_forecast(lat, lon, target_loc, radius_km=radius_km)
                data_payload["forecast"] = forecast_res
                actions.append(AgentMapAction(type="SHOW_FORECAST", payload={"horizon": "7_DAYS", "forecast": forecast_res}))

                daily_points = forecast_res.get("daily", [])
                avg_score = int(sum(p.get("urbanConditionScore", 70) for p in daily_points) / max(len(daily_points), 1))
                message = (
                    f"**7-Day Multi-Pillar Forecast for {city_display}** (Avg Urban Score: **{avg_score}/100**):\n\n"
                    f"{forecast_res.get('summary')}\n\n"
                    f"- **Weather Trend**: Highs {min(p.get('tempHighC', 20) for p in daily_points)}°C–{max(p.get('tempHighC', 25) for p in daily_points)}°C\n"
                    f"- **Air Quality**: Maintained within {min(p.get('aqiValue', 50) for p in daily_points)}–{max(p.get('aqiValue', 100) for p in daily_points)} ({daily_points[0].get('aqiScale', 'AQI') if daily_points else 'AQI'})\n"
                    f"- **Commute Tendency**: Morning & evening rush hour windows follow standard weekday cycle\n\n"
                    f"The 7-Day Multi-Pillar drawer is open on the map with day-by-day telemetry."
                )

            for s in forecast_res.get("sources", []):
                sources.append({"type": s.get("type", "Forecast"), "source": s.get("source", "Open-Meteo Models"), "detail": f"{city_display} {horizon}"})

            all_activities.append(AgentToolActivity(step=f"{horizon} multi-pillar forecast computed", status="COMPLETED"))
            confidence = forecast_res.get("confidence", 0.85)

        elif intent == "LIVE_UPDATES":
            all_activities.append(AgentToolActivity(step=f"Retrieving verified live updates & RAG bulletins for {city_display}", status="IN_PROGRESS"))

            # Concurrently retrieve ingested live events and relevant RAG civic knowledge
            ingested_events, rag_docs = await asyncio.gather(
                LiveIngestionPipeline.ingest_live_events(lat, lon, radius_km=radius_km),
                LocationAwareRAGService.retrieve_relevant_knowledge(lat, lon, city=target_loc.get("city"), limit=3),
            )

            data_payload["liveUpdates"] = ingested_events
            data_payload["ragBulletins"] = rag_docs
            actions.append(AgentMapAction(type="SHOW_LIVE_UPDATES", payload={"updates": ingested_events, "bulletins": rag_docs}))
            actions.append(AgentMapAction(type="SHOW_EVENTS_LAYER"))

            lines = [f"**Live Updates & Civic Bulletins for {city_display}** ({radius_km} km radius):\n"]
            if ingested_events:
                lines.append(f"**Verified Sensor Incidents ({len(ingested_events)} active)**:")
                for ev in ingested_events[:3]:
                    lines.append(f"• [{ev.get('freshness', 'LIVE')}] **{ev.get('title')}** (Severity {ev.get('severity')}/100, {ev.get('source')})")
            else:
                lines.append("• Zero immediate high-severity seismic or structural hazards detected by sensor networks.")

            if rag_docs:
                lines.append(f"\n**Authoritative Safety Advisories & Civic Protocols**:")
                for doc in rag_docs:
                    lines.append(f"• **{doc.get('title')}** ({doc.get('source')}): {doc.get('content')[:140]}...")

            message = "\n".join(lines)
            for ev in ingested_events[:2]:
                sources.append({"type": "Live Stream", "source": ev.get("source"), "detail": ev.get("title"), "freshness": ev.get("freshness")})
            for doc in rag_docs[:2]:
                sources.append({"type": "Civic RAG", "source": doc.get("source"), "detail": doc.get("title")})

            all_activities.append(AgentToolActivity(step=f"Found {len(ingested_events)} live events and {len(rag_docs)} RAG documents", status="COMPLETED"))
            confidence = 0.92

        else:
            # General intelligence query
            intel = await UrbanIntelService.get_full_intelligence(lat, lon, radius_km=radius_km)
            data_payload["intel"] = intel
            message = (
                f"UrbanPulse is monitoring **{city_display}** across a **{radius_km} km radius**. "
                f"Weather: {intel.get('weather', {}).get('current', {}).get('temperatureC', '--')}, "
                f"Air Quality: {intel.get('airQuality', {}).get('scale', 'AQI')} {intel.get('airQuality', {}).get('value', '--')} ({intel.get('airQuality', {}).get('category', '--')}). "
                f"The map is centered on {city_display}."
            )
            all_activities.append(AgentToolActivity(step="Intelligence overview compiled", status="COMPLETED"))

        all_activities.append(AgentToolActivity(step="Map updated", status="COMPLETED", detail=f"Centered at ({lat:.4f}, {lon:.4f})"))

        return {
            "id": f"AGENT-{int(datetime.now(timezone.utc).timestamp())}",
            "message": message,
            "intent": intent,
            "location": target_loc,
            "data": data_payload,
            "sources": sources,
            "confidence": round(confidence, 2),
            "actions": [a.model_dump() for a in actions],
            "tool_activities": [a.model_dump() for a in all_activities],
            "timestamp": now_iso,
        }
