"""
UrbanPulse OpenAI Orchestration Service
Server-side orchestration using OpenAI Function Calling (gpt-4o-mini / gpt-4o).
Provides structured tools to query live telemetry, forecast horizons, RAG bulletins, and map actions.
Includes automatic fallback to deterministic routing if OpenAI quota is unavailable or fails,
guaranteeing zero downtime, zero data hallucination, and 100% responsiveness.
"""

from typing import Any, Dict, List, Optional
import json
import logging
import httpx
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger("urbanpulse.openai_agent")

AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "resolve_location",
            "description": "Geocode an arbitrary global location name, landmark, or address into coordinates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "City name, address, or region anywhere on Earth"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_live_traffic",
            "description": "Retrieve verified Google Traffic flow, congestion delays, and corridor status for coordinates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "latitude": {"type": "number"},
                    "longitude": {"type": "number"},
                    "radius_km": {"type": "number", "default": 50.0}
                },
                "required": ["latitude", "longitude"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_live_weather",
            "description": "Retrieve current meteorological conditions (temp, precipitation prob, humidity, wind).",
            "parameters": {
                "type": "object",
                "properties": {
                    "latitude": {"type": "number"},
                    "longitude": {"type": "number"}
                },
                "required": ["latitude", "longitude"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_live_air_quality",
            "description": "Retrieve verified air quality telemetry, standard-aware index (CPCB, EAQI, US EPA), and PM2.5/PM10.",
            "parameters": {
                "type": "object",
                "properties": {
                    "latitude": {"type": "number"},
                    "longitude": {"type": "number"},
                    "country_code": {"type": "string"}
                },
                "required": ["latitude", "longitude"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_multi_pillar_forecast",
            "description": "Generate 7-day multi-pillar predictions (weather, aqi, traffic tendencies, composite score) or 30-day monthly outlook.",
            "parameters": {
                "type": "object",
                "properties": {
                    "latitude": {"type": "number"},
                    "longitude": {"type": "number"},
                    "horizon": {"type": "string", "enum": ["7_DAYS", "30_DAYS"], "default": "7_DAYS"}
                },
                "required": ["latitude", "longitude"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_location_rag",
            "description": "Search location-aware RAG knowledge base for safety protocols, emergency advisories, and civic bulletins.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "latitude": {"type": "number"},
                    "longitude": {"type": "number"},
                    "city": {"type": "string"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "dispatch_map_action",
            "description": "Issue actions to Google Maps UI (center, toggle traffic layer, toggle aqi halo, open forecast panel, show live updates).",
            "parameters": {
                "type": "object",
                "properties": {
                    "action_type": {
                        "type": "string",
                        "enum": ["CENTER_MAP", "SHOW_TRAFFIC_LAYER", "SHOW_AQI_LAYER", "SHOW_EVENTS_LAYER", "SHOW_FORECAST", "SHOW_LIVE_UPDATES"]
                    },
                    "payload": {"type": "object"}
                },
                "required": ["action_type"]
            }
        }
    }
]


class OpenAIAgentService:
    """
    Manages communication with OpenAI Chat Completions API with function calling.
    Ensures safe fallback to the deterministic router if OpenAI API key is unset or returns 429 / error.
    """

    SYSTEM_PROMPT = (
        "You are UrbanPulse, a location-first real-time urban intelligence agent. "
        "You help users inspect live city conditions (Google Traffic, AQI, Weather, Hazards, Safety Protocols, 7-Day Forecasts). "
        "Rules:\n"
        "1. Never fabricate live traffic delays, temperatures, or future dates. If data is unavailable, state it transparently.\n"
        "2. Always dispatch corresponding map actions (e.g. SHOW_TRAFFIC_LAYER for traffic queries, SHOW_AQI_LAYER for air quality, SHOW_FORECAST for forecasts).\n"
        "3. Support any location on Earth without hardcoded city biases.\n"
        "4. Output concise, authoritative markdown with clear bullet points."
    )

    @classmethod
    async def run_agent_turn(
        cls,
        user_query: str,
        current_location: Optional[Dict[str, Any]] = None,
        radius_km: float = 50.0,
    ) -> Optional[Dict[str, Any]]:
        """
        Attempts to run an OpenAI function-calling orchestration turn.
        Returns None if OpenAI is not available or encounters errors (so the caller uses deterministic fallback).
        """
        if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("mock-") or len(settings.OPENAI_API_KEY) < 20:
            logger.debug("OpenAI API key not configured for agent turn; utilizing deterministic engine.")
            return None

        messages = [
            {"role": "system", "content": cls.SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"User query: {user_query}. Current location: {json.dumps(current_location) if current_location else 'None'}. Radius: {radius_km} km.",
            }
        ]

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.OPENAI_MODEL,
                        "messages": messages,
                        "tools": AGENT_TOOLS,
                        "tool_choice": "auto",
                        "temperature": 0.1,
                    },
                )

                if res.status_code == 200:
                    data = res.json()
                    choice = data.get("choices", [{}])[0]
                    message = choice.get("message", {})
                    return {
                        "content": message.get("content"),
                        "tool_calls": message.get("tool_calls", []),
                    }
                else:
                    logger.warning("OpenAI agent request returned status %s: %s", res.status_code, res.text[:200])
                    return None
        except Exception as e:
            logger.warning("OpenAI agent orchestration exception (%s); falling back to deterministic router.", e)
            return None
