"""
Generalized UrbanPulse Scenario Intelligence Engine Package.
Exports the 11 core architectural components (Section 26):
- ScenarioParser
- ScenarioRegistry
- EvidenceRetriever
- HistoricalComparator
- GeoSpatialAnalyzer
- FeatureBuilder
- PredictionEngine
- UncertaintyEngine
- EvidenceEngine
- ScenarioResponseGenerator
- MapFeatureGenerator
"""

from app.services.scenario.models import (
    AffectedAreaFeature,
    AffectedRoadFeature,
    ConfidenceLevel,
    EvidenceStatement,
    EvidenceType,
    FactorEvaluation,
    HistoricalEventFeature,
    MapLayerId,
    ResolvedLocation,
    ScenarioCategory,
    ScenarioDefinition,
    UncertaintyReport,
)
from app.services.scenario.registry import ScenarioCategorySpec, ScenarioRegistry
from app.services.scenario.parser import ScenarioParser
from app.services.scenario.evidence_retriever import EvidenceRetriever
from app.services.scenario.historical_comparator import HistoricalComparator
from app.services.scenario.geospatial_analyzer import FeatureBuilder, GeoSpatialAnalyzer
from app.services.scenario.prediction_engine import PredictionEngine
from app.services.scenario.uncertainty_and_map import MapFeatureGenerator, UncertaintyEngine
from app.services.scenario.response_generator import EvidenceEngine, ScenarioResponseGenerator

__all__ = [
    "ScenarioCategory",
    "EvidenceType",
    "ConfidenceLevel",
    "MapLayerId",
    "ResolvedLocation",
    "ScenarioDefinition",
    "EvidenceStatement",
    "FactorEvaluation",
    "AffectedAreaFeature",
    "AffectedRoadFeature",
    "HistoricalEventFeature",
    "UncertaintyReport",
    "ScenarioCategorySpec",
    "ScenarioRegistry",
    "ScenarioParser",
    "EvidenceRetriever",
    "HistoricalComparator",
    "GeoSpatialAnalyzer",
    "FeatureBuilder",
    "PredictionEngine",
    "UncertaintyEngine",
    "EvidenceEngine",
    "ScenarioResponseGenerator",
    "MapFeatureGenerator",
]
