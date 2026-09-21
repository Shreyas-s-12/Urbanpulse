"""
UrbanPulse Ranking Intelligence Schemas
Strict typed models for multi-domain ranking queries, candidate evaluations,
and structured ranking responses across World, Country, State/Region, and City scopes.
"""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone


RankingMetricType = Literal["AQI", "TRAFFIC", "POPULATION", "TEMPERATURE"]
RankingEntityType = Literal["CITY", "STATE", "REGION", "PROVINCE", "COUNTRY", "DISTRICT", "PLACE"]
RankingOrder = Literal["DESC", "ASC"]
RankingTimeWindow = Literal["CURRENT", "FORECAST", "HISTORICAL"]


class RankedEntity(BaseModel):
    rank: int
    id: str
    name: str
    geography: Dict[str, float]  # {"lat": float, "lon": float}
    value: float
    unit: str
    category: str
    source: str
    timestamp: str
    confidence: float
    coverage: Literal["AVAILABLE", "PARTIAL", "NO_COVERAGE", "STALE"]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RankingRequest(BaseModel):
    metric: RankingMetricType
    entityType: RankingEntityType = "CITY"
    scope: str = "INDIA"  # "WORLD", "INDIA", "USA", "KARNATAKA", etc.
    scopeId: Optional[str] = None
    limit: int = 10
    order: RankingOrder = "DESC"
    timeWindow: RankingTimeWindow = "CURRENT"
    subMetric: Optional[str] = None  # "DENSITY", "COUNT", "CONGESTION_RATIO", "SPEED", "MAX_TEMP", "MIN_TEMP"


class RankingResponse(BaseModel):
    metric: RankingMetricType
    entityType: RankingEntityType
    scope: str
    limit: int
    order: RankingOrder
    rankingMetric: str  # Explicit documented formula or metric name
    results: List[RankedEntity]
    candidateCount: int
    validCount: int
    coverage: float  # Percentage: (validCount / candidateCount) * 100
    source: str
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    confidence: float = 0.90
    status: Literal["SUCCESS", "PARTIAL", "INSUFFICIENT_DATA", "PROVIDER_ERROR"] = "SUCCESS"
    datasetYear: Optional[int] = None
    isLive: bool = True
    error: Optional[str] = None
