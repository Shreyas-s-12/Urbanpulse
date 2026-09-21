"""
UrbanPulse Research Differentiation & Novel Intelligence Schemas
Standardized data contracts for confidence-aware multimodal geospatial intelligence:
- NormalizedObservation: Section 3 & 4 schema with strict source trust tiers
- ConfidenceBreakdown: Deterministic breakdown components
- MultimodalAnomaly: Cross-domain anomaly with non-causal association semantics
- UrbanStateComponent & DecomposableUrbanScore: Explainable urban state
- EvidenceChain: CLAIM -> SIGNALS -> SOURCE -> TIMESTAMP -> METHOD -> CONFIDENCE
- ScenarioSimulationResult: Bounded perturbation with uncertainty
- AblationExperimentRecord: Empirical evaluation metrics
"""

from typing import Any, Dict, List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime, timezone


class SourceTrustMetadata(BaseModel):
    sourceName: str
    sourceType: Literal[
        "SENSOR_OBSERVATION",
        "MODEL_FORECAST",
        "MODELED_DATASET",
        "OFFICIAL_REPORT",
        "LIVE_TELEMETRY",
        "HYBRID"
    ]
    sourceTier: Literal[
        "TIER_1_OFFICIAL",
        "TIER_2_REPUTABLE_MODEL",
        "TIER_3_CROWDSOURCED",
        "TIER_4_UNVERIFIED"
    ]
    license: str = "Open Access / Public Domain"
    spatialResolution: str
    temporalResolution: str
    coverage: float = Field(ge=0.0, le=1.0)
    freshness: str
    freshnessMinutes: float = Field(ge=0.0)


class ConfidenceBreakdown(BaseModel):
    overallConfidence: float = Field(ge=0.0, le=1.0)
    sourceQualityScore: float = Field(ge=0.0, le=1.0)
    sourceQualityLabel: Literal["HIGH", "MODERATE", "LOW"]
    freshnessScore: float = Field(ge=0.0, le=1.0)
    freshnessMinutes: float = Field(ge=0.0)
    freshnessLabel: Literal["LIVE", "RECENT", "DEGRADED", "STALE"]
    spatialAdequacyScore: float = Field(ge=0.0, le=1.0)
    spatialResolutionDesc: str
    coverageScore: float = Field(ge=0.0, le=1.0)
    coveragePercent: float = Field(ge=0.0, le=100.0)
    crossSourceAgreementScore: float = Field(ge=0.0, le=1.0)
    crossSourceAgreementLabel: Literal["HIGH", "MODERATE", "LOW", "SINGLE_SOURCE", "DISAGREEMENT"]
    missingnessPenalty: float = Field(ge=0.0, le=1.0, default=0.0)
    explanation: str


class NormalizedObservation(BaseModel):
    id: str
    metric: Literal["AQI", "WEATHER", "TRAFFIC", "POPULATION", "INCIDENTS", "ROAD_CONDITIONS", "HAZARDS"]
    subMetric: Optional[str] = None
    lat: float
    lng: float
    geometry: Dict[str, Any]  # GeoJSON Point or Polygon
    value: float
    rawValue: Optional[float] = None
    normalizedValue: float = Field(ge=0.0, le=1.0)
    unit: str
    timestamp: str
    source: str
    sourceType: str
    sourceTier: str
    license: str
    spatialResolution: str
    temporalResolution: str
    coverage: float = Field(ge=0.0, le=1.0)
    freshness: str
    freshnessMinutes: float
    confidence: float = Field(ge=0.0, le=1.0)
    confidenceBreakdown: Optional[ConfidenceBreakdown] = None
    status: Literal["AVAILABLE", "STALE", "NO_COVERAGE", "INSUFFICIENT_DATA", "UNKNOWN"]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EvidenceChainNode(BaseModel):
    claim: str
    signals: List[str]
    source: str
    timestamp: str
    method: str
    confidence: float
    evidence: str


class MultimodalAnomaly(BaseModel):
    id: str
    location: Dict[str, float]  # {"lat": ..., "lng": ...}
    domain: Literal["TRAFFIC", "WEATHER", "AQI", "CIVIC", "MULTIMODAL"]
    anomalyType: str
    observedValue: Any
    expectedValue: Any
    deviation: float  # Percentage departure from baseline
    zScore: Optional[float] = None
    contributingSignals: List[str]
    associationType: Literal[
        "TEMPORAL_ASSOCIATION",
        "SPATIAL_ALIGNMENT",
        "CORRELATED_ANOMALY",
        "ISOLATED_ANOMALY"
    ]
    severity: Literal["LOW", "MODERATE", "HIGH", "SEVERE"]
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: List[str]
    evidenceChain: Optional[EvidenceChainNode] = None
    timestamp: str
    source: str


class UrbanStateComponent(BaseModel):
    name: str
    domain: Literal["ENVIRONMENT", "MOBILITY", "WEATHER", "POPULATION_EXPOSURE", "CIVIC_RISK", "INFRASTRUCTURE"]
    value: Optional[float] = None
    displayValue: str
    unit: str
    concernLevel: Literal["LOW", "MODERATE", "ELEVATED", "HIGH", "SEVERE", "INSUFFICIENT_DATA"]
    confidence: float = Field(ge=0.0, le=1.0)
    source: str
    timestamp: str
    dataStatus: Literal["AVAILABLE", "PARTIAL", "STALE", "NO_COVERAGE", "INSUFFICIENT_DATA"]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DecomposableUrbanScore(BaseModel):
    score: Optional[int] = None  # None if insufficient data
    baseScore: int = 100
    contributors: Dict[str, float]  # e.g. {"traffic": -12.0, "aqi": -7.0, "weather": -5.0, "infrastructure": +2.0, "confidenceAdjustment": -3.0}
    formula: str
    confidence: float
    dataCoverage: str  # e.g. "4/6 domains available"
    sourceCount: int
    missingDomains: List[str]
    status: Literal["AVAILABLE", "PARTIAL", "INSUFFICIENT_DATA"]


class MultimodalUrbanState(BaseModel):
    location: Dict[str, Any]
    timestamp: str
    components: Dict[str, UrbanStateComponent]
    overallScore: DecomposableUrbanScore
    activeAnomalies: List[MultimodalAnomaly]
    confidenceSummary: ConfidenceBreakdown
    dataQualityIndex: float = Field(ge=0.0, le=100.0)
    provenanceTrace: List[Dict[str, Any]]


class ScenarioSimulationResult(BaseModel):
    scenarioId: str
    label: Literal["SIMULATION"] = "SIMULATION"
    title: str
    assumptions: List[str]
    baselineConditions: Dict[str, Any]
    scenarioPerturbation: Dict[str, Any]
    predictedEffects: Dict[str, Any]
    uncertaintyRange: Dict[str, List[float]]  # metric: [min, max]
    confidence: float
    decisionOptions: List[Dict[str, Any]]
    modelProvenance: str
    timestamp: str


class AblationExperimentRecord(BaseModel):
    experimentId: str
    timestamp: str
    geography: str
    timeWindow: str
    modelType: Literal["MODEL_A_SINGLE_DOMAIN", "MODEL_B_MULTIMODAL", "MODEL_C_CONFIDENCE_WEIGHTED"]
    modalitiesIncluded: List[str]
    metrics: Dict[str, float]  # precision, recall, f1, mae, rmse, latencyMs, coveragePercent
    limitations: List[str]
    datasetVersion: str = "v1.4-2026"
    reproducibilityHash: str
