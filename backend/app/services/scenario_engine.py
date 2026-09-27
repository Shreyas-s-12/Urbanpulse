"""
UrbanPulse Generalized Scenario Intelligence Engine (Orchestrator)
Orchestrates the full evidence-grounded pipeline:
User Query / Request
     ↓
ScenarioParser
     ↓
ScenarioDefinition
     ↓
ScenarioRegistry
     ↓
EvidenceRetriever (Relevant Data Sources)
     ↓
HistoricalComparator (Multi-Year Archive & Analog Events)
     ↓
FeatureBuilder & GeoSpatialAnalyzer (DEM, Slope, Drainage, Road Network, Population)
     ↓
PredictionEngine (Deterministic Model + Dynamic 4-Factor Impact Model)
     ↓
UncertaintyEngine (Confidence HIGH/MEDIUM/LOW + Limitations + Real-Time Data Needed)
     ↓
EvidenceEngine & MapFeatureGenerator (Visually Distinct Layers)
     ↓
ScenarioResponseGenerator (14-Section Structured Report + Map + Chat Output)
"""

from typing import Any, Dict, List, Optional
import logging

from app.services.urban_intel import UrbanIntelService
from app.services.scenario import (
    EvidenceEngine,
    EvidenceRetriever,
    FeatureBuilder,
    GeoSpatialAnalyzer,
    HistoricalComparator,
    MapFeatureGenerator,
    PredictionEngine,
    ScenarioCategory,
    ScenarioDefinition,
    ScenarioParser,
    ScenarioRegistry,
    ScenarioResponseGenerator,
    UncertaintyEngine,
)

logger = logging.getLogger("urbanpulse.scenario")


class ScenarioEngineService:
    """
    Entry point for the Generalized UrbanPulse Scenario Intelligence Engine.
    Supports both free-form natural language queries (e.g. "Assume 10 mm rainfall occurs in 1 hour in Malleswaram")
    and structured API payloads for any location, hazard category, intensity, duration, and requested year.
    """

    @classmethod
    async def analyze_scenario(
        cls,
        query: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        scenario_type: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
        radius_km: float = 5.0,
        location_name: Optional[str] = None,
        location_meta: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        return await cls.simulate_scenario(
            latitude=latitude,
            longitude=longitude,
            scenario_type=scenario_type,
            parameters=parameters,
            radius_km=radius_km,
            location_meta=location_meta,
            query=query,
            location_name=location_name,
            **kwargs,
        )

    @classmethod
    async def simulate_scenario(
        cls,
        latitude: Any = None,
        longitude: Optional[float] = None,
        scenario_type: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
        radius_km: float = 5.0,
        location_meta: Optional[Dict[str, Any]] = None,
        query: Optional[str] = None,
        location_name: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Executes an evidence-grounded scenario intelligence analysis across any supported
        location, condition, intensity, duration, and target year.
        """
        # 1. Unpack if dictionary passed as first argument
        if isinstance(latitude, dict):
            req = latitude
            query = req.get("query") or req.get("prompt") or query
            lat_raw = req.get("latitude")
            lon_raw = req.get("longitude")
            if isinstance(req.get("location"), dict):
                loc_obj = req["location"]
                location_meta = loc_obj
                lat_raw = lat_raw if lat_raw is not None else loc_obj.get("latitude")
                lon_raw = lon_raw if lon_raw is not None else loc_obj.get("longitude")
                location_name = location_name or loc_obj.get("city") or loc_obj.get("displayName")
            elif isinstance(req.get("location"), str):
                location_name = location_name or req["location"]

            location_name = location_name or req.get("locationName") or req.get("city")
            s_type_raw = req.get("scenarioType") or req.get("scenario_type") or req.get("scenario") or scenario_type
            parameters = dict(req.get("parameters") or parameters or {})
            for extra_k in ("intensity", "unit", "duration", "duration_hours", "targetYear", "requestedYear", "year"):
                if extra_k in req and extra_k not in parameters:
                    parameters[extra_k] = req[extra_k]
            radius_val = float(req.get("radiusKm") or req.get("radius_km") or req.get("radius") or radius_km or 5.0)
            location_meta = location_meta or req.get("location_meta") or req.get("locationMeta")
        else:
            lat_raw = latitude
            lon_raw = longitude
            s_type_raw = scenario_type
            parameters = dict(parameters or {})
            radius_val = float(radius_km or 5.0)

        lat_f = float(lat_raw) if lat_raw is not None else None
        lon_f = float(lon_raw) if lon_raw is not None else None

        # 2. Parse & Normalize into ScenarioDefinition + Resolve Dynamic Location
        scenario_def: ScenarioDefinition = await ScenarioParser.parse_and_resolve(
            query=query,
            latitude=lat_f,
            longitude=lon_f,
            scenario_type=s_type_raw,
            parameters=parameters,
            radius_km=radius_val,
            location_name=location_name,
            location_meta=location_meta,
        )

        # 3. Retrieve Baseline Score from UrbanIntelService if coordinates are resolved
        baseline_score = 76
        if scenario_def.latitude is not None and scenario_def.longitude is not None:
            try:
                intel = await UrbanIntelService.get_full_intelligence(
                    scenario_def.latitude,
                    scenario_def.longitude,
                    min(scenario_def.radius, 50.0),
                )
                cond = intel.get("condition", {})
                baseline_score = int(cond.get("overallScore") or 76)
            except Exception:
                pass

        # 4. Retrieve Scenario-Relevant Evidence Sources (EvidenceRetriever)
        evidence = await EvidenceRetriever.retrieve_evidence(scenario_def)

        # 5. Historical Comparison (HistoricalComparator)
        historical = HistoricalComparator.compare(scenario_def, evidence)

        # 6. Build Geospatial & Environmental Feature Vector (FeatureBuilder & GeoSpatialAnalyzer)
        features = FeatureBuilder.build_features(scenario_def, evidence, historical)
        geospatial = GeoSpatialAnalyzer.analyze(scenario_def, evidence, features)

        # 7. Deterministic Model Prediction & Dynamic 4-Factor Impact Evaluation (PredictionEngine)
        prediction = PredictionEngine.predict(
            scenario=scenario_def,
            evidence=evidence,
            historical=historical,
            geospatial=geospatial,
            features=features,
            baseline_score=baseline_score,
        )

        # 8. Evaluate Confidence & Limitations (UncertaintyEngine)
        uncertainty = UncertaintyEngine.evaluate(
            scenario=scenario_def,
            evidence=evidence,
            historical=historical,
            geospatial=geospatial,
            prediction=prediction,
        )

        # 9. Generate Visually Distinct Map Layers & Features (MapFeatureGenerator)
        map_features = MapFeatureGenerator.generate_map_features(
            scenario=scenario_def,
            evidence=evidence,
            historical=historical,
            geospatial=geospatial,
            prediction=prediction,
            uncertainty=uncertainty,
        )

        # 10. Generate Complete 14-Section Response (ScenarioResponseGenerator & EvidenceEngine)
        response = ScenarioResponseGenerator.generate(
            scenario=scenario_def,
            evidence=evidence,
            historical=historical,
            geospatial=geospatial,
            prediction=prediction,
            uncertainty=uncertainty,
            map_features=map_features,
        )

        return response
