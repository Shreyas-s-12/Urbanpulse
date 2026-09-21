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
    "ROADS",
    "CIVIL_SAFETY",
    "EVENTS",
    "HAZARDS",
    "ROUTE",
    "GENERAL_INTELLIGENCE",
    "COMPARISON",
    "FORECAST",
    "MONTHLY_OUTLOOK",
    "LIVE_UPDATES",
    "WHAT_CHANGED",
    "WHY_SCORE",
    "MONITOR",
    "ANOMALY",
    "SIMULATE",
    "ASK_THE_MAP",
    "ACTIVITIES",
    "RISK_RADAR",
    "PREDICT",
    "RISK_FORECAST",
    "SMART_ROUTE",
    "MISSION_MODE",
    "RECOMMEND_PLACE",
    "CASCADE",
    "WHERE_AM_I",
    "HEATMAP",
    "RANKING",
    "WHY_TRAFFIC",
    "CONFIDENCE_EXPLANATION",
    "EXPLAINABILITY",
    "EVALUATION",
]

AgentTimeQualifier = Literal["CURRENT", "FORECAST", "HISTORICAL", "SIMULATION"]

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
    "SHOW_CHANGES",
    "SHOW_SCORE",
    "SHOW_ANOMALIES",
    "SHOW_SCENARIO",
    "SHOW_COMPARISON",
    "SHOW_RISK",
    "SET_RADIUS",
    "SELECT_EVENT",
    "SELECT_PLACE",
    "SET_EVENT_FILTER",
    "SHOW_RISK_FORECAST",
    "SHOW_ROUTE",
    "SHOW_ALTERNATIVE_ROUTES",
    "FOCUS_ALERT",
    "OPEN_MISSION",
    "OPEN_MONITOR",
    "SHOW_CASCADE",
    "SHOW_HEATMAP",
    "HIDE_HEATMAP",
    "SET_HEATMAP_METRIC",
    "SET_HEATMAP_GEOGRAPHY",
    "SET_HEATMAP_TIME",
    "FOCUS_HEATMAP_HOTSPOT",
    "INVESTIGATE_HEATMAP_CELL",
    "RANK_ENTITIES",
    "SHOW_RANKING",
    "SHOW_RANKED_MARKERS",
    "CLEAR_RANKING",
    "FOCUS_RANKED_ENTITY",
]


class ParsedAgentIntent(BaseModel):
    intent: AgentIntent
    location_query: Optional[str] = None
    comparison_locations: Optional[List[str]] = None
    time_qualifier: Optional[AgentTimeQualifier] = "CURRENT"
    radius_km: Optional[float] = None
    requires_comparison: bool = False
    is_follow_up: bool = False
    ranking_params: Optional[Dict[str, Any]] = None


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


NexusResponseType = Literal[
    "RANKING",
    "COMPARISON",
    "CURRENT_STATUS",
    "EXPLANATION",
    "WHAT_CHANGED",
    "FORECAST",
    "SCENARIO",
    "LOCATION_INFO",
    "FACT",
    "GENERAL",
]


class NexusStructuredSection(BaseModel):
    title: Optional[str] = None
    type: Literal["text", "table", "bullets", "key_values", "alert"] = "text"
    content: Optional[str] = None
    items: Optional[List[str]] = None
    key_values: Optional[Dict[str, Any]] = None
    table_headers: Optional[List[str]] = None
    table_rows: Optional[List[List[Any]]] = None


class NexusStructuredResponse(BaseModel):
    type: NexusResponseType
    title: str
    summary: str
    sections: List[NexusStructuredSection] = Field(default_factory=list)
    results: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None
    sources: List[Dict[str, Any]] = Field(default_factory=list)


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
    structured_response: Optional[NexusStructuredResponse] = None

