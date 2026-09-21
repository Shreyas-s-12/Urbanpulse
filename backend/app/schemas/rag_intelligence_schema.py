"""
UrbanPulse Dedicated RAG Intelligence Schemas
Provides strict typed contracts for:
- GeoRAG (Satellite Environmental Intelligence)
- CrisisRAG (Emergency Response Intelligence)
- AquaRAG (Water Intelligence)
- Common Dynamic Prediction Engine (Arbitrary Target Year, 4 Domain Factors)
- Auditable Multi-Source Evidence Citations (FACT, MODEL_PREDICTION, INFERENCE, HISTORICAL_CONTEXT)
"""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone


EvidenceType = Literal["FACT", "MODEL_PREDICTION", "INFERENCE", "HISTORICAL_CONTEXT"]
DataStatus = Literal["AVAILABLE", "PARTIAL", "NO_COVERAGE", "STALE", "ERROR"]
FactorStatus = Literal["AVAILABLE", "PARTIAL", "INSUFFICIENT_HISTORICAL_DATA"]
RAGModuleType = Literal["GEORAG", "CRISISRAG", "AQUARAG"]


class EvidenceCitation(BaseModel):
    source: str
    title: str
    date: str
    relevance: float = Field(ge=0.0, le=1.0)
    location: Optional[str] = None
    evidenceSnippet: str
    link: Optional[str] = None
    evidenceType: EvidenceType = "FACT"
    dataStatus: DataStatus = "AVAILABLE"


class PredictionFactor(BaseModel):
    factorName: str
    prediction: str
    confidence: float = Field(ge=0.0, le=1.0)
    historicalBasis: str
    source: str
    evidence: str
    status: FactorStatus = "AVAILABLE"


class PredictionResponse(BaseModel):
    targetYear: int
    requestedYear: int
    previousYear: int
    module: RAGModuleType
    factors: List[PredictionFactor]
    modelProvenance: str
    generatedAt: str
    explanation: str


class RAGQueryRequest(BaseModel):
    query: str
    latitude: float
    longitude: float
    locationName: Optional[str] = None
    cityName: Optional[str] = None
    country: Optional[str] = "India"


class RAGPredictionRequest(BaseModel):
    targetYear: int = 2028
    latitude: float
    longitude: float
    locationName: Optional[str] = None
    cityName: Optional[str] = None


class RAGQueryResponse(BaseModel):
    query: str
    module: RAGModuleType
    answer: str
    evidence: List[EvidenceCitation]
    confidence: float
    temporalClassification: Optional[str] = None
    limitations: Optional[str] = None


# Module-specific Context Payloads
class GeoRAGContextResponse(BaseModel):
    location: Dict[str, Any]
    satelliteImagery: Dict[str, Any]
    environmentalReports: List[EvidenceCitation]
    environmentalData: Dict[str, Any]
    aiAnalysis: str
    dataStatus: DataStatus = "AVAILABLE"


class CrisisRAGContextResponse(BaseModel):
    location: Dict[str, Any]
    currentAlerts: List[Dict[str, Any]]
    officialAdvisories: List[EvidenceCitation]
    roadShelterInfo: Dict[str, Any]
    categorizedEvents: Dict[str, List[Dict[str, Any]]]  # CURRENT, RECENT, HISTORICAL, FORECAST
    aiSituationBrief: str
    dataStatus: DataStatus = "AVAILABLE"


class AquaRAGContextResponse(BaseModel):
    location: Dict[str, Any]
    sensorStatus: Dict[str, Any]
    waterQualityRating: str
    historicalTrends: List[Dict[str, Any]]
    evidence: List[EvidenceCitation]
    aiWaterIntelligence: str
    dataStatus: DataStatus = "AVAILABLE"
