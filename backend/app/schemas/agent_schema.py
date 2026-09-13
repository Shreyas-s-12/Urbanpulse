"""
UrbanPulse Location Intelligence Agent Schemas
Strict typed models for intent parsing, tool routing, map action dispatch, and API request/response.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, timezone


AgentIntent = Literal[
    "TRAFFIC",
    "WEATHER",
    "AIR_QUALITY",
    "OVERALL_RATING",
    "EVENTS",
    "HAZARDS",
    "ROUTE",
    "GENERAL_INTELLIGENCE",
    "COMPARISON",
    "FORECAST",
    "MONTHLY_OUTLOOK",
    "LIVE_UPDATES",
]

AgentTimeQualifier = Literal["CURRENT", "FORECAST", "HISTORICAL"]

AgentMapActionType = Literal[
    "CENTER_MAP",
    "SET_ZOOM",
    "SHOW_TRAFFIC_LAYER",
    "HIDE_TRAFFIC_LAYER",
    "SHOW_AQI_LAYER",
    "HIDE_AQI_LAYER",
    "SHOW_EVENTS_LAYER",
    "HIDE_EVENTS_LAYER",
    "DRAW_ROUTE",
    "CLEAR_ROUTE",
    "SHOW_FORECAST",
    "SHOW_LIVE_UPDATES",
]


class ParsedAgentIntent(BaseModel):
    intent: AgentIntent
    location_query: Optional[str] = None
    comparison_locations: Optional[List[str]] = None
    time_qualifier: Optional[AgentTimeQualifier] = "CURRENT"
    radius_km: Optional[float] = None
    requires_comparison: bool = False
    is_follow_up: bool = False


class AgentMapAction(BaseModel):
    type: AgentMapActionType
    payload: Optional[Dict[str, Any]] = None


class AgentToolActivity(BaseModel):
    step: str
    status: Literal["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"] = "COMPLETED"
    detail: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AgentInteractionRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    current_location: Optional[Dict[str, Any]] = None
    selected_radius_km: float = 50.0
    conversation_history: Optional[List[Dict[str, str]]] = None


class AgentInteractionResponse(BaseModel):
    id: str
    message: str
    intent: AgentIntent
    location: Optional[Dict[str, Any]] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    sources: List[Dict[str, Any]] = Field(default_factory=list)
    confidence: float = 1.0
    actions: List[AgentMapAction] = Field(default_factory=list)
    tool_activities: List[AgentToolActivity] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
