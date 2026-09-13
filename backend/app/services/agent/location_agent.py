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

        # 1. Detect comparison (e.g. "compare air quality in Delhi and Mumbai" or "traffic in Mysore vs Bangalore")
        comp_match = re.search(r"(?:compare|difference between)\s+(.+?)\s+in\s+([a-zA-Z\s.-]+?)\s+(?:and|vs\.?|with)\s+([a-zA-Z\s.-]+)", q, re.IGNORECASE)
        if not comp_match:
            comp_match = re.search(r"([a-zA-Z\s.-]+?)\s+(?:and|vs\.?)\s+([a-zA-Z\s.-]+)\s+(?:comparison|traffic|weather|air quality|aqi)", q, re.IGNORECASE)

        if comp_match:
            loc1 = comp_match.group(2).strip() if comp_match.lastindex and comp_match.lastindex >= 2 else ""
            loc2 = comp_match.group(3).strip() if comp_match.lastindex and comp_match.lastindex >= 3 else ""
            if not loc1 and comp_match.lastindex and comp_match.lastindex >= 2:
                loc1 = comp_match.group(1).strip()
                loc2 = comp_match.group(2).strip()

            intent = "AIR_QUALITY" if any(w in q_lower for w in ["aqi", "air", "pollution"]) else "TRAFFIC"
            return ParsedAgentIntent(
                intent="COMPARISON",
                comparison_locations=[loc1, loc2],
                requires_comparison=True,
                location_query=loc1,
            )

        # 2. Domain classification
        intent = "GENERAL_INTELLIGENCE"
        if any(w in q_lower for w in ["monthly outlook", "30 day", "30-day", "long range", "next month", "climatology"]):
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
        elif any(w in q_lower for w in ["hazard", "pothole", "asphalt", "danger", "road condition"]):
            intent = "HAZARDS"
        elif any(w in q_lower for w in ["event", "incident", "happening", "activity", "alert", "quake", "earthquake"]):
            intent = "EVENTS"
        elif any(w in q_lower for w in ["route", "safest route", "directions", "how to reach"]):
            intent = "ROUTE"

        # 3. Location extraction
        loc_patterns = [
            r"(?:show me|tell me|what is|how is|what's|give me|what are)\s+(?:the\s+)?(?:current\s+)?(?:traffic|weather|air quality|aqi|rating|overall rating|forecast|outlook|updates|live updates|road conditions|road hazards|public safety alerts|safety alerts|hazards|roads)\s+\b(?:in|for|at|around|near|of)\s+([a-zA-Z\s.,'-]+?)(?:\?|\.|\!|$)",
            r"(?:forecast|outlook|updates|traffic|weather|aqi|air quality|rating|condition|road conditions|road hazards|safety alerts|public safety)\s+\b(?:for|in|at|around|near|of)\s+([a-zA-Z\s.,'-]+?)(?:\?|\.|\!|$)",
            r"\b(?:in|at|around|for|near|of|to|check)\s+([a-zA-Z\s.,'-]+?)(?:\?|\.|\!|$)",
            r"^([a-zA-Z\s.,'-]+?)\s+(?:traffic|weather|aqi|air quality|rating|overall rating|condition|forecast|outlook|updates|roads|road conditions|safety alerts)",
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

        # Handle Comparison Requests (e.g. Delhi vs Mumbai Air Quality)
        if parsed.intent == "COMPARISON" and parsed.comparison_locations and len(parsed.comparison_locations) >= 2:
            loc_a_name, loc_b_name = parsed.comparison_locations[0], parsed.comparison_locations[1]
            all_activities.append(AgentToolActivity(step=f"Comparing '{loc_a_name}' and '{loc_b_name}'", status="IN_PROGRESS"))

            res_a_list = await GeocodingProvider.search(loc_a_name)
            res_b_list = await GeocodingProvider.search(loc_b_name)

            if res_a_list and res_b_list:
                loc_a, loc_b = res_a_list[0], res_b_list[0]
                # Concurrently fetch AQI for both
                aqi_a, aqi_b = await asyncio.gather(
                    AirQualityProvider.get_air_quality(loc_a["latitude"], loc_a["longitude"], country_code=loc_a.get("countryCode")),
                    AirQualityProvider.get_air_quality(loc_b["latitude"], loc_b["longitude"], country_code=loc_b.get("countryCode")),
                )
                val_a = aqi_a.get("value")
                val_b = aqi_b.get("value")
                scale_a = aqi_a.get("scale", "AQI")
                cat_a = aqi_a.get("category", "Unknown")
                cat_b = aqi_b.get("category", "Unknown")

                msg = (
                    f"**Air Quality Comparison** between **{loc_a.get('city', loc_a_name)}** and **{loc_b.get('city', loc_b_name)}**:\n\n"
                    f"• **{loc_a.get('city', loc_a_name)}**: {val_a} ({cat_a}, scale: {scale_a}) via {aqi_a.get('source')}\n"
                    f"• **{loc_b.get('city', loc_b_name)}**: {val_b} ({cat_b}, scale: {aqi_b.get('scale', 'AQI')}) via {aqi_b.get('source')}\n\n"
                )
                if val_a is not None and val_b is not None:
                    if val_a < val_b:
                        msg += f"**{loc_a.get('city', loc_a_name)}** currently has cleaner air than **{loc_b.get('city', loc_b_name)}**."
                    elif val_b < val_a:
                        msg += f"**{loc_b.get('city', loc_b_name)}** currently has cleaner air than **{loc_a.get('city', loc_a_name)}**."
                    else:
                        msg += f"Both cities report identical air quality indices ({val_a})."

                all_activities.append(AgentToolActivity(step="Comparison complete", status="COMPLETED"))

                # Center on the primary location and show AQI layer
                actions = [
                    AgentMapAction(type="CENTER_MAP", payload={"latitude": loc_a["latitude"], "longitude": loc_a["longitude"], "zoom": 11}),
                    AgentMapAction(type="SHOW_AQI_LAYER", payload={"latitude": loc_a["latitude"], "longitude": loc_a["longitude"], "data": aqi_a}),
                ]

                return {
                    "id": f"AGENT-{int(datetime.now(timezone.utc).timestamp())}",
                    "message": msg,
                    "intent": "COMPARISON",
                    "location": loc_a,
                    "data": {
                        "comparison": {
                            "locationA": {"location": loc_a, "summary": aqi_a},
                            "locationB": {"location": loc_b, "summary": aqi_b},
                            "verdict": msg,
                        }
                    },
                    "sources": [
                        {"type": "Air Quality", "source": aqi_a.get("source", "Open-Meteo"), "detail": f"{loc_a.get('city')}: {val_a}"},
                        {"type": "Air Quality", "source": aqi_b.get("source", "Open-Meteo"), "detail": f"{loc_b.get('city')}: {val_b}"},
                    ],
                    "confidence": 0.90,
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

        elif intent == "OVERALL_RATING":
            all_activities.append(AgentToolActivity(step=f"Evaluating full UrbanPulse condition for {city_display}", status="IN_PROGRESS"))
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

            score = cond.get("overallScore")
            score_txt = f"**{score} / 100** ({cond.get('label', 'FAVORABLE')})" if score is not None else "Unavailable"
            conf_val = cond.get("confidence", 0.7)
            known = cond.get("knownSignals", 4)
            missing = cond.get("missingSignals", 2)

            message = (
                f"**UrbanPulse Rating for {city_display}**: {score_txt}\n\n"
                f"• **Confidence**: {int(conf_val * 100)}% ({known} active signals verified, {missing} municipal feeds missing)\n"
                f"• **Traffic**: {traffic_data.get('trafficStatus', 'Normal')} ({traffic_data.get('detail', 'Flowing')})\n"
                f"• **Air Quality**: {aqi_data.get('category', 'Moderate')} ({aqi_data.get('scale', 'AQI')} {aqi_data.get('value', '--')})\n"
                f"• **Weather**: {weather_data.get('current', {}).get('temperatureC', '--')} ({weather_data.get('current', {}).get('conditionLabel', '--')})\n"
                f"• **Road Surface**: {roads_data.get('roadConditionStatus', 'No Verified Feed')}\n"
                f"• **Active Incidents**: {len(events_data)} logged in {radius_km} km radius"
            )

            actions.append(AgentMapAction(type="SHOW_EVENTS_LAYER"))
            if traffic_data.get("status") == "AVAILABLE":
                actions.append(AgentMapAction(type="SHOW_TRAFFIC_LAYER"))

            sources.append({"type": "Urban Condition", "source": "UrbanPulse Deterministic Scoring Engine", "detail": f"Score {score}/100"})
            all_activities.append(AgentToolActivity(step="Rating and pillar breakdown calculated", status="COMPLETED"))
            confidence = conf_val

        elif intent in ("EVENTS", "HAZARDS"):
            all_activities.append(AgentToolActivity(step=f"Scanning live events and infrastructure feeds within {radius_km} km of {city_display}", status="IN_PROGRESS"))
            fusion_res = await EventFusionService.get_live_events_near_location(lat, lon, radius_km, city_name=city_display)
            events = fusion_res.get("events", [])
            data_payload["events"] = events
            actions.append(AgentMapAction(type="SHOW_EVENTS_LAYER"))

            is_road_query = any(w in query_lower for w in ["road", "pothole", "asphalt", "pavement", "street condition"])
            is_civil_query = any(w in query_lower for w in ["police", "crime", "safety alert", "public safety", "dispatch"])

            if is_road_query:
                road_info = await RoadProvider.get_road_status_async(lat, lon, radius_km, events)
                data_payload["roads"] = road_info
                pothole_count = road_info.get("condition", {}).get("potholeCount", 0)
                surface_type = road_info.get("surface", {}).get("material", "Asphalt / Paved")
                meas_type = road_info.get("surface", {}).get("measurementType", "MAPPED_ATTRIBUTE")

                message = (
                    f"**Road Surface & Infrastructure for {city_display}** ({radius_km} km radius):\n\n"
                    f"- **Network Mapping**: {road_info.get('roadNetworkStatus', 'AVAILABLE')} (Primary/secondary corridors mapped)\n"
                    f"- **Surface Material**: **{surface_type}** (*source: OpenStreetMap mapped attributes*)\n"
                    f"- **Pavement Condition**: {road_info.get('condition', {}).get('message', 'No continuous sensor feed')}\n"
                    f"- **Active Road Hazards**: {pothole_count} verified alert(s) in active radius\n\n"
                    f"*Note: UrbanPulse clearly distinguishes mapped road geometry from physical pavement roughness inspection.*"
                )
                for s in road_info.get("sources", []):
                    sources.append({"type": "Roads", "source": s.get("name"), "detail": s.get("role")})
            elif is_civil_query:
                safety_info = await CrimeProvider.get_crime_events_async(
                    lat, lon, radius_km, country_code=target_loc.get("countryCode"), city=city_display
                )
                data_payload["civilSafety"] = safety_info
                incidents = safety_info.get("incidents", [])
                updates = safety_info.get("updates", [])

                if safety_info.get("feedCapability") in ("OFFICIAL_PUBLIC_SAFETY_FEED", "OPEN_CRIME_DATA"):
                    message = (
                        f"**Civil Safety & Public Feeds for {city_display}**:\n\n"
                        f"- **Feed Status**: **{safety_info.get('status')}** ({safety_info.get('sources', [{}])[0].get('name')})\n"
                        f"- **Verified Incidents**: **{safety_info.get('incidentCount', 0)}** record(s) indexed\n"
                        f"- **Active Advisories**: {len(updates)} civic safety protocol(s)\n\n"
                        f"*Law enforcement open data connected for this jurisdiction.*"
                    )
                else:
                    message = (
                        f"**Civil Safety & Public Feeds for {city_display}**:\n\n"
                        f"- **Feed Status**: {safety_info.get('message', 'No verified public safety feed covers this location.')}\n"
                        f"- **Authoritative Advisories**: {len(updates)} civil defense bulletin(s) active\n\n"
                        f"*UrbanPulse strictly refrains from reporting '0 crimes' or false safety guarantees in the absence of verified law enforcement feeds.*"
                    )
                for s in safety_info.get("sources", []):
                    sources.append({"type": "Civil Safety", "source": s.get("name"), "detail": s.get("authority")})
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
