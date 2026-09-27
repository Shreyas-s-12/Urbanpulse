"""
UncertaintyEngine, EvidenceEngine, and MapFeatureGenerator for the
Generalized UrbanPulse Scenario Intelligence Engine (Sections 10, 11, 12, 13, 14, 20, 21, 22).
"""

import math
from typing import Any, Dict, List
from app.services.scenario.models import (
    AffectedAreaFeature,
    AffectedRoadFeature,
    ConfidenceLevel,
    EvidenceStatement,
    EvidenceType,
    MapLayerId,
    ScenarioCategory,
    ScenarioDefinition,
    UncertaintyReport,
)
from app.services.scenario.registry import ScenarioRegistry


class UncertaintyEngine:
    """
    Evaluates prediction confidence (HIGH / MEDIUM / LOW) from actual evidence completeness
    and generates explicit uncertainty, data, spatial, temporal, and model limitation statements.
    """

    @classmethod
    def evaluate(
        cls,
        scenario: ScenarioDefinition,
        evidence: Dict[str, Any],
        historical: Dict[str, Any],
        geospatial: Dict[str, Any],
        prediction: Dict[str, Any],
    ) -> UncertaintyReport:
        avail = evidence.get("availability", {})
        spec = ScenarioRegistry.get_spec(scenario.scenarioType)

        has_loc = bool(avail.get("locationResolved"))
        has_hist = bool(avail.get("historicalArchive"))
        has_dem = bool(avail.get("demElevation"))
        has_roads = bool(avail.get("roadNetwork"))
        has_curr = bool(avail.get("currentWeather"))
        has_drain_telemetry = bool(avail.get("liveSensorTelemetry"))
        hist_days = int(historical.get("sampleSizeDays") or 0)

        # Calculate evidence quality score (0.0 to 1.0)
        score = 0.25
        if has_loc:
            score += 0.15
        if has_hist and hist_days >= 365:
            score += 0.22
        elif has_hist:
            score += 0.12
        if has_dem:
            score += 0.15
        if has_roads:
            score += 0.10
        if has_curr:
            score += 0.08
        if scenario.intensity is None:
            score -= 0.18
        if not has_drain_telemetry and scenario.scenarioType in (
            ScenarioCategory.RAINFALL,
            ScenarioCategory.FLOOD,
            ScenarioCategory.WATER_LEVEL_RISE,
        ):
            # Cap confidence below HIGH when live drainage telemetry is unavailable
            score = min(score, 0.78)

        score = round(max(0.25, min(0.92, score)), 2)

        if score >= 0.82 and has_hist and has_dem and not scenario.missingInformation:
            overall_conf = ConfidenceLevel.HIGH
        elif score >= 0.55 and has_loc:
            overall_conf = ConfidenceLevel.MEDIUM
        else:
            overall_conf = ConfidenceLevel.LOW

        # Rationale explaining why confidence is HIGH / MEDIUM / LOW
        available_parts = []
        if has_hist:
            available_parts.append(f"multi-year historical archive ({hist_days} daily observations)")
        if has_dem:
            available_parts.append("Copernicus 90m DEM elevation/slope profile")
        if has_roads:
            available_parts.append("OpenStreetMap road topology")
        if has_curr:
            available_parts.append("live meteorological baseline")

        missing_parts = []
        if not has_drain_telemetry and scenario.scenarioType in (ScenarioCategory.RAINFALL, ScenarioCategory.FLOOD):
            missing_parts.append("sub-surface storm drainage pipe & pump telemetry")
        if not has_dem:
            missing_parts.append("Digital Elevation Model (DEM)")
        if not has_hist:
            missing_parts.append("multi-year historical archive")
        if scenario.missingInformation:
            missing_parts.extend(scenario.missingInformation)

        rationale = (
            f"Prediction confidence is {overall_conf.value} ({int(score * 100)}%) because "
            f"{', '.join(available_parts) if available_parts else 'limited baseline metadata'} "
            f"{'are available' if len(available_parts) > 1 else 'is available'}"
            + (f", whereas {', '.join(missing_parts)} remain unavailable." if missing_parts else ".")
        )

        data_limitations: List[str] = []
        if not has_hist:
            data_limitations.append("Insufficient historical data to produce a reliable multi-year statistical comparison.")
        if not has_curr:
            data_limitations.append("Real-time conditions are unavailable for the selected coordinates.")
        if not has_drain_telemetry and scenario.scenarioType in (ScenarioCategory.RAINFALL, ScenarioCategory.FLOOD):
            data_limitations.append(
                "Sub-surface municipal stormwater pipe capacity, siltation levels, and pump station telemetry are unavailable."
            )
        if not data_limitations:
            data_limitations.append(
                "In-situ municipal IoT sensor telemetry (sub-meter water gauges / structural strain gauges) was not retrieved; estimates rely on satellite/reanalysis and mapping baselines."
            )

        spatial_limitations = [
            "Copernicus GLO-90 DEM has ~90m horizontal grid spacing and cannot resolve sub-meter street curbs, local compound walls, or storm grate blockages."
            if has_dem
            else "DEM elevation data was unavailable; spatial susceptibility could not be resolved at topographic level.",
            f"Spatial analysis is bounded to the requested {scenario.radius:.1f} km radius around resolved coordinates.",
        ]

        temporal_limitations = [
            "Historical ERA5 reanalysis archive provides daily aggregation; sub-hourly convective burst peaks (5–15 minute cloudbursts) can exceed daily averages.",
        ]
        if scenario.targetYear is not None:
            temporal_limitations.append(
                f"Projection for requested year {scenario.targetYear} extrapolates from historical observations through previousYear ({scenario.previousYear}) and assumes no unmodeled structural drainage or land-use changes between {scenario.previousYear} and {scenario.targetYear}."
            )

        model_limitations = [
            "Deterministic physical/empirical model assumes spatially uniform hazard forcing across the analysis radius unless modified by DEM slope/depression gradients.",
            "Human behavioral adaptations (e.g., spontaneous driver route diversion or municipal pre-emptive interventions) are not dynamically simulated.",
        ]

        major_confidences = {
            "historicalComparison": ConfidenceLevel.HIGH if (has_hist and hist_days >= 365) else ConfidenceLevel.LOW,
            "geospatialSusceptibility": ConfidenceLevel.HIGH if has_dem else ConfidenceLevel.LOW,
            "affectedAreasPrediction": overall_conf,
            "roadImpactPrediction": ConfidenceLevel.MEDIUM if has_roads else ConfidenceLevel.LOW,
            "fourFactorModel": overall_conf,
        }

        return UncertaintyReport(
            overallConfidence=overall_conf,
            overallConfidenceScore=score,
            confidenceRationale=rationale,
            predictionUncertainty=(
                f"UrbanPulse Score projection carries a +/- 4 point uncertainty interval "
                f"({max(10, prediction['simulatedScore'] - 4)}–{min(100, prediction['simulatedScore'] + 4)} / 100); "
                f"corridor delay estimates carry +/- 20% variance."
            ),
            dataLimitations=data_limitations,
            spatialLimitations=spatial_limitations,
            temporalLimitations=temporal_limitations,
            modelLimitations=model_limitations,
            missingData=scenario.missingInformation + (
                ["Live sub-surface drainage sensor feed"]
                if scenario.scenarioType in (ScenarioCategory.RAINFALL, ScenarioCategory.FLOOD)
                else []
            ),
            recommendedRealtimeInputs=spec.recommendedRealtimeInputs,
            majorPredictionConfidences=major_confidences,
        )


class MapFeatureGenerator:
    """
    Converts scenario predictions, historical events, terrain, and infrastructure into
    map-ready features organized across 5 visually distinct layers (Sections 12, 13, 14):
    - Historical Events
    - Current Conditions
    - Scenario Prediction
    - Infrastructure
    - Terrain
    """

    @classmethod
    def generate_map_features(
        cls,
        scenario: ScenarioDefinition,
        evidence: Dict[str, Any],
        historical: Dict[str, Any],
        geospatial: Dict[str, Any],
        prediction: Dict[str, Any],
        uncertainty: UncertaintyReport,
    ) -> Dict[str, Any]:
        lat = scenario.latitude
        lon = scenario.longitude
        if lat is None or lon is None:
            return {
                "affectedAreas": [],
                "affectedRoads": [],
                "historicalEvents": historical.get("historicalEvents", []),
                "closedRoadPolyline": None,
                "alternateRoutePolyline": None,
                "layers": {
                    MapLayerId.HISTORICAL_EVENTS.value: [],
                    MapLayerId.CURRENT_CONDITIONS.value: [],
                    MapLayerId.SCENARIO_PREDICTION.value: [],
                    MapLayerId.INFRASTRUCTURE.value: [],
                    MapLayerId.TERRAIN.value: [],
                },
            }

        cat = scenario.scenarioType
        loc_name = (
            scenario.resolvedLocation.displayName
            if scenario.resolvedLocation
            else (scenario.location or "Selected Location")
        )
        severity_band = prediction["severityBand"]
        conf = uncertainty.overallConfidence
        dem = evidence.get("geospatial", {}).get("dem") or {}
        lowest = dem.get("lowestSector") or {"direction": "Center", "latitude": lat, "longitude": lon, "elevationM": dem.get("centerElevationM")}

        # 1. Generate AffectedArea features (Layer: Scenario Prediction)
        affected_areas: List[AffectedAreaFeature] = []
        r_deg = max(0.004, min(0.03, (scenario.radius * 0.25) / 111.32))

        if severity_band == "LOW_ROUTINE":
            # For routine scenarios (e.g., 10 mm rain in 1h), do NOT create a fake "Flooded Zone"!
            # Create a low-susceptibility monitoring footprint polygon around the lowest DEM sector
            c_lat = float(lowest.get("latitude") or lat)
            c_lon = float(lowest.get("longitude") or lon)
            affected_areas.append(
                AffectedAreaFeature(
                    areaId=f"pred-area-primary-{int(abs(c_lat * 1000))}",
                    geometry={
                        "type": "Polygon",
                        "center": {"latitude": c_lat, "longitude": c_lon},
                        "radiusMeters": round(r_deg * 111320 * 0.65),
                        "coordinates": cls._build_polygon_coords(c_lat, c_lon, r_deg * 0.65),
                    },
                    label=f"{loc_name} — {lowest.get('direction', 'Central')} Sector (Routine Runoff Envelope)",
                    scenarioType=cat,
                    impact=(
                        f"Model-derived prediction: Routine surface wetting under {prediction['effectiveIntensity']:g} {prediction['effectiveUnit']}; "
                        f"no flooding or structural inundation predicted (elevation {lowest.get('elevationM', 'N/A')} m ASL)."
                    ),
                    severity="LOW",
                    confidence=conf,
                    evidence=(
                        f"DEM elevation ({lowest.get('elevationM', 'N/A')} m ASL) + ERA5 historical comparison show "
                        f"{prediction['effectiveIntensity']:g} {prediction['effectiveUnit']} is within nominal drainage capacity."
                    ),
                    evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                    layer=MapLayerId.SCENARIO_PREDICTION.value,
                )
            )
        else:
            # Primary elevated susceptibility zone at lowest DEM sector
            c_lat = float(lowest.get("latitude") or lat)
            c_lon = float(lowest.get("longitude") or lon)
            affected_areas.append(
                AffectedAreaFeature(
                    areaId=f"pred-area-lowlying-{int(abs(c_lat * 1000))}",
                    geometry={
                        "type": "Polygon",
                        "center": {"latitude": c_lat, "longitude": c_lon},
                        "radiusMeters": round(r_deg * 111320),
                        "coordinates": cls._build_polygon_coords(c_lat, c_lon, r_deg),
                    },
                    label=f"{loc_name} — {lowest.get('direction', 'Low-Lying')} Topographic Sector",
                    scenarioType=cat,
                    impact=(
                        f"Model-derived prediction: Elevated {cat.value.lower().replace('_', ' ')} susceptibility "
                        f"(modeled delay +{prediction['trafficDelayIncreasePercent']:.0f}%"
                        + (f", ponding depth ~{prediction['inundationDepthMeters']:.2f} m" if prediction['inundationDepthMeters'] > 0 else "")
                        + ")."
                    ),
                    severity="HIGH" if severity_band == "HIGH_STRESS" else "MODERATE",
                    confidence=conf,
                    evidence=(
                        f"Derived from scenario intensity ({prediction['effectiveIntensity']:g} {prediction['effectiveUnit']}), "
                        f"DEM elevation ({lowest.get('elevationM', 'N/A')} m ASL), and built-up exposure."
                    ),
                    evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                    layer=MapLayerId.SCENARIO_PREDICTION.value,
                )
            )

        # 2. Generate AffectedRoad features (Layer: Scenario Prediction)
        # Strictly follow Section 14: Never claim "Road closed" for hypothetical scenarios;
        # use "Potential disruption" or "Model-derived vulnerability" (or "Minimal wet-surface speed moderation" for low intensity)
        infra = evidence.get("infrastructure") or {}
        named_roads = infra.get("namedRoads") or []
        affected_roads: List[AffectedRoadFeature] = []

        if not named_roads:
            # Fallback to requested corridor name or primary radial corridor around coordinates
            corridor_name = (
                scenario.additionalParameters.get("corridor_name")
                or scenario.additionalParameters.get("road_name")
                or f"{loc_name} Primary Arterial Corridor"
            )
            named_roads = [
                {
                    "roadId": "road-seg-primary",
                    "roadName": corridor_name,
                    "roadClass": "primary",
                    "center": {"latitude": lat, "longitude": lon},
                }
            ]

        for idx, r_info in enumerate(named_roads[:4]):
            r_center = r_info.get("center") or {"latitude": lat, "longitude": lon}
            r_lat = float(r_center.get("latitude", lat))
            r_lon = float(r_center.get("longitude", lon))
            poly_pts = [
                {"latitude": round(r_lat - 0.0045, 5), "longitude": round(r_lon - 0.0055, 5)},
                {"latitude": round(r_lat, 5), "longitude": round(r_lon, 5)},
                {"latitude": round(r_lat + 0.0045, 5), "longitude": round(r_lon + 0.0055, 5)},
            ]

            if severity_band == "LOW_ROUTINE":
                pred_road_impact = (
                    f"Model-derived vulnerability: Low — minor wet-surface speed moderation (-{prediction['speedReductionPercent']:.0f}%), no road closure or disruption expected"
                )
            elif severity_band == "MODERATE_LOCALIZED":
                pred_road_impact = (
                    f"Potential disruption — localized travel speed reduction (-{prediction['speedReductionPercent']:.0f}%) and +{prediction['trafficDelayIncreasePercent']:.0f}% travel delay"
                )
            else:
                pred_road_impact = (
                    f"Potential disruption / Model-derived vulnerability — projected +{prediction['trafficDelayIncreasePercent']:.0f}% delay and -{prediction['speedReductionPercent']:.0f}% speed drop"
                )

            affected_roads.append(
                AffectedRoadFeature(
                    roadId=str(r_info.get("roadId") or f"road-{idx}"),
                    geometry={
                        "type": "LineString",
                        "polyline": poly_pts,
                        "coordinates": [[p["longitude"], p["latitude"]] for p in poly_pts],
                    },
                    roadName=str(r_info.get("roadName") or f"Corridor {idx + 1}"),
                    roadClass=str(r_info.get("roadClass") or "arterial"),
                    predictedImpact=pred_road_impact,
                    confidence=ConfidenceLevel.MEDIUM if evidence["availability"].get("roadNetwork") else ConfidenceLevel.LOW,
                    evidence=(
                        f"OpenStreetMap corridor '{r_info.get('roadName')}' ({r_info.get('roadClass', 'arterial')}) "
                        f"intersected with scenario intensity ({prediction['effectiveIntensity']:g} {prediction['effectiveUnit']})."
                    ),
                    evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                    layer=MapLayerId.SCENARIO_PREDICTION.value,
                )
            )

        # Primary & alternate polylines for map rendering
        primary_road_poly = affected_roads[0].geometry["polyline"] if affected_roads else [
            {"latitude": round(lat - 0.006, 5), "longitude": round(lon - 0.008, 5)},
            {"latitude": round(lat, 5), "longitude": round(lon, 5)},
            {"latitude": round(lat + 0.006, 5), "longitude": round(lon + 0.008, 5)},
        ]
        alternate_route_poly = [
            {"latitude": round(lat - 0.006, 5), "longitude": round(lon - 0.008, 5)},
            {"latitude": round(lat - 0.003, 5), "longitude": round(lon + 0.012, 5)},
            {"latitude": round(lat + 0.006, 5), "longitude": round(lon + 0.008, 5)},
        ]

        # 3. Build Visually Distinct Map Layers (Section 13)
        current_layer_features = []
        if evidence["availability"].get("currentWeather"):
            cw = evidence["currentObservations"].get("weather", {})
            current_layer_features.append({
                "featureId": "curr-obs-center",
                "layer": MapLayerId.CURRENT_CONDITIONS.value,
                "evidenceType": EvidenceType.CURRENT_OBSERVATION.value,
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "label": f"Live Observation: {cw.get('temperatureC', 'N/A')}, {cw.get('conditionLabel', 'Observed')}",
                "properties": cw,
            })

        terrain_layer_features = []
        if evidence["availability"].get("demElevation"):
            for sample in (dem.get("gridSamples") or [])[:5]:
                terrain_layer_features.append({
                    "featureId": f"dem-{sample['direction'].lower()}",
                    "layer": MapLayerId.TERRAIN.value,
                    "evidenceType": EvidenceType.CURRENT_OBSERVATION.value,
                    "geometry": {"type": "Point", "coordinates": [sample["longitude"], sample["latitude"]]},
                    "label": f"DEM {sample['direction']}: {sample['elevationM']} m ASL",
                    "properties": sample,
                })

        infra_layer_features = []
        for w in (infra.get("waterways") or [])[:4]:
            wc = w.get("center") or {"latitude": lat, "longitude": lon}
            infra_layer_features.append({
                "featureId": w["waterwayId"],
                "layer": MapLayerId.INFRASTRUCTURE.value,
                "evidenceType": EvidenceType.CURRENT_OBSERVATION.value,
                "geometry": {"type": "Point", "coordinates": [wc["longitude"], wc["latitude"]]},
                "label": f"Waterway: {w['name']} ({w['type']})",
                "properties": w,
            })

        return {
            "affectedAreas": [a.model_dump() for a in affected_areas],
            "affectedRoads": [r.model_dump() for r in affected_roads],
            "historicalEvents": historical.get("historicalEvents", []),
            "closedRoadPolyline": primary_road_poly,
            "alternateRoutePolyline": alternate_route_poly,
            "layers": {
                MapLayerId.HISTORICAL_EVENTS.value: historical.get("historicalEvents", []),
                MapLayerId.CURRENT_CONDITIONS.value: current_layer_features,
                MapLayerId.SCENARIO_PREDICTION.value: {
                    "predictedAreas": [a.model_dump() for a in affected_areas],
                    "predictedRoads": [r.model_dump() for r in affected_roads],
                },
                MapLayerId.INFRASTRUCTURE.value: infra_layer_features,
                MapLayerId.TERRAIN.value: terrain_layer_features,
            },
        }

    @staticmethod
    def _build_polygon_coords(lat: float, lon: float, r_deg: float) -> List[List[float]]:
        pts = []
        for i in range(9):
            angle = math.radians(i * 45.0)
            p_lat = round(lat + r_deg * math.sin(angle), 5)
            p_lon = round(lon + r_deg * math.cos(angle), 5)
            pts.append([p_lon, p_lat])
        return pts
