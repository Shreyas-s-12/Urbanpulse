"""
Data Models & Enumerations for the Generalized UrbanPulse Scenario Intelligence Engine.
Enforces strict separation of evidence types, confidence levels, map layers,
and scenario definitions without hardcoded locations or hazards.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ScenarioCategory(str, Enum):
    RAINFALL = "RAINFALL"
    FLOOD = "FLOOD"
    STORM = "STORM"
    CYCLONE = "CYCLONE"
    EXTREME_HEAT = "EXTREME_HEAT"
    DROUGHT = "DROUGHT"
    LANDSLIDE = "LANDSLIDE"
    EARTHQUAKE = "EARTHQUAKE"
    WILDFIRE = "WILDFIRE"
    WATER_LEVEL_RISE = "WATER_LEVEL_RISE"
    COASTAL_INUNDATION = "COASTAL_INUNDATION"
    STORM_SURGE = "STORM_SURGE"
    AIR_QUALITY_EVENT = "AIR_QUALITY_EVENT"
    EXTREME_WIND = "EXTREME_WIND"
    ROAD_DISRUPTION = "ROAD_DISRUPTION"
    OTHER = "OTHER"


class EvidenceType(str, Enum):
    HISTORICAL_EVIDENCE = "HISTORICAL EVIDENCE"
    MODEL_DERIVED_PREDICTION = "MODEL-DERIVED PREDICTION"
    CURRENT_OBSERVATION = "CURRENT OBSERVATION"
    FORECAST = "FORECAST"
    ASSUMPTION = "ASSUMPTION"
    INFERENCE = "INFERENCE"
    UNKNOWN_INSUFFICIENT_DATA = "UNKNOWN / INSUFFICIENT DATA"


class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class MapLayerId(str, Enum):
    HISTORICAL_EVENTS = "Historical Events"
    CURRENT_CONDITIONS = "Current Conditions"
    SCENARIO_PREDICTION = "Scenario Prediction"
    INFRASTRUCTURE = "Infrastructure"
    TERRAIN = "Terrain"


class ResolvedLocation(BaseModel):
    query: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None
    neighborhood: Optional[str] = None
    district: Optional[str] = None
    region: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    countryCode: Optional[str] = None
    timezone: str = "UTC"
    displayName: str = "Unresolved Location"
    administrativeBoundaries: Optional[Dict[str, Any]] = None
    selectedRadiusKm: float = 5.0
    isResolved: bool = False


class ScenarioContext(BaseModel):
    intent: str = "SCENARIO_ANALYSIS"
    scenarioType: ScenarioCategory = ScenarioCategory.OTHER
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    intensity: Optional[float] = None
    unit: Optional[str] = None
    displayIntensity: Optional[str] = None
    duration: Optional[float] = None
    durationUnit: Optional[str] = None
    durationHours: Optional[float] = None
    durationMinutes: Optional[float] = None
    durationSeconds: Optional[int] = None
    displayDuration: Optional[str] = None
    targetDate: Optional[str] = None
    targetYear: Optional[int] = None
    radius: float = 5.0
    assumptions: List[str] = Field(default_factory=list)


class ScenarioDefinition(BaseModel):
    intent: str = "SCENARIO_ANALYSIS"
    rawQuery: Optional[str] = None
    scenarioType: ScenarioCategory = ScenarioCategory.OTHER
    legacyScenarioType: str = "other"
    location: Optional[str] = None
    resolvedLocation: Optional[ResolvedLocation] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    intensity: Optional[float] = None
    unit: Optional[str] = None
    displayIntensity: Optional[str] = None
    duration: Optional[str] = None
    durationValue: Optional[float] = None
    durationUnit: Optional[str] = None
    durationHours: Optional[float] = None
    durationMinutes: Optional[float] = None
    durationSeconds: Optional[int] = None
    displayDuration: Optional[str] = None
    timePeriod: Optional[str] = None
    startTime: Optional[str] = None
    targetDate: Optional[str] = None
    targetYear: Optional[int] = None
    previousYear: Optional[int] = None
    historicalWindowYears: List[int] = Field(default_factory=list)
    radius: float = 5.0
    isFollowUp: bool = False
    locationSource: str = "EXPLICIT_QUERY"  # EXPLICIT_QUERY | SELECTED_MAP_POI | ACTIVE_CONTEXT | UNRESOLVED
    additionalParameters: Dict[str, Any] = Field(default_factory=dict)
    missingInformation: List[str] = Field(default_factory=list)


class EvidenceStatement(BaseModel):
    statement: str
    evidenceType: EvidenceType
    confidence: ConfidenceLevel = ConfidenceLevel.MEDIUM
    source: str = "UrbanPulse Scenario Intelligence Engine"
    supportingData: Optional[Dict[str, Any]] = None


class FactorEvaluation(BaseModel):
    factorId: str
    factorName: str
    description: str
    score: Optional[float] = None  # 0 to 100 susceptibility/stress index if supported by data
    status: str  # e.g., "LOW SUSCEPTIBILITY", "MODERATE STRESS", "ELEVATED EXPOSURE", "INSUFFICIENT DATA"
    evidenceType: EvidenceType = EvidenceType.MODEL_DERIVED_PREDICTION
    confidence: ConfidenceLevel = ConfidenceLevel.MEDIUM
    explanation: str
    sources: List[str] = Field(default_factory=list)


class AffectedAreaFeature(BaseModel):
    areaId: str
    geometry: Dict[str, Any]
    label: str
    scenarioType: ScenarioCategory
    impact: str
    severity: str
    confidence: ConfidenceLevel
    evidence: str
    evidenceType: EvidenceType = EvidenceType.MODEL_DERIVED_PREDICTION
    layer: str = MapLayerId.SCENARIO_PREDICTION.value


class AffectedRoadFeature(BaseModel):
    roadId: str
    geometry: Dict[str, Any]
    roadName: str
    roadClass: str = "arterial"
    predictedImpact: str  # Never "Road closed" unless verified live closure exists; uses "Potential disruption" or "Model-derived vulnerability"
    confidence: ConfidenceLevel
    evidence: str
    evidenceType: EvidenceType = EvidenceType.MODEL_DERIVED_PREDICTION
    layer: str = MapLayerId.SCENARIO_PREDICTION.value


class HistoricalEventFeature(BaseModel):
    eventId: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date: str
    eventType: str
    intensity: str
    observedImpact: str
    distanceKm: float = 0.0
    source: str
    evidenceType: EvidenceType = EvidenceType.HISTORICAL_EVIDENCE
    layer: str = MapLayerId.HISTORICAL_EVENTS.value


class UncertaintyReport(BaseModel):
    overallConfidence: ConfidenceLevel
    overallConfidenceScore: float
    confidenceRationale: str
    predictionUncertainty: str
    dataLimitations: List[str] = Field(default_factory=list)
    spatialLimitations: List[str] = Field(default_factory=list)
    temporalLimitations: List[str] = Field(default_factory=list)
    modelLimitations: List[str] = Field(default_factory=list)
    missingData: List[str] = Field(default_factory=list)
    recommendedRealtimeInputs: List[str] = Field(default_factory=list)
    majorPredictionConfidences: Dict[str, ConfidenceLevel] = Field(default_factory=dict)
