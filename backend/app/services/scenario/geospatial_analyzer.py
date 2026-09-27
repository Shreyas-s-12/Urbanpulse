"""
GeoSpatialAnalyzer & FeatureBuilder for the Generalized UrbanPulse Scenario Intelligence Engine.
Evaluates terrain, elevation, slope, drainage/waterways, road network, and land-cover/population
susceptibility strictly from available spatial evidence (Sections 8 & 20).
Never claims elevation-based vulnerability when DEM is unavailable, and never claims poor drainage
when drainage data is unavailable.
"""

from typing import Any, Dict, List
from app.services.scenario.models import (
    ConfidenceLevel,
    EvidenceStatement,
    EvidenceType,
    ScenarioCategory,
    ScenarioDefinition,
)
from app.services.scenario.registry import ScenarioRegistry


class FeatureBuilder:
    """
    Extracts a deterministic numerical and categorical feature dictionary from retrieved evidence
    to feed the PredictionEngine without LLM hallucination.
    """

    @classmethod
    def build_features(
        cls,
        scenario: ScenarioDefinition,
        evidence: Dict[str, Any],
        historical: Dict[str, Any],
    ) -> Dict[str, Any]:
        avail = evidence.get("availability", {})
        dem = evidence.get("geospatial", {}).get("dem") or {}
        infra = evidence.get("infrastructure") or {}
        curr_weather = evidence.get("currentObservations", {}).get("weather") or {}
        curr_aqi = evidence.get("currentObservations", {}).get("airQuality") or {}
        pop = evidence.get("population") or {}
        stat_base = historical.get("statisticalBaseline") or {}

        # Parse current weather values safely
        curr_temp_raw = str(curr_weather.get("temperatureC", "25.0")).replace("°C", "").strip()
        try:
            curr_temp_c = float(curr_temp_raw)
        except ValueError:
            curr_temp_c = 25.0

        curr_wind_raw = str(curr_weather.get("windSpeedKmh", curr_weather.get("windSpeed", "10.0"))).replace("km/h", "").strip()
        try:
            curr_wind_kmh = float(curr_wind_raw)
        except ValueError:
            curr_wind_kmh = 10.0

        pop_density = float(pop.get("populationDensityPerKm2") or pop.get("density") or 3200.0)
        estimated_pop_in_radius = int(pop.get("estimatedPopulation") or round(pop_density * 3.14159 * (scenario.radius ** 2)))
        built_up_fraction = min(0.92, max(0.15, round(pop_density / 12000.0, 2)))

        named_roads = infra.get("namedRoads") or []
        waterways = infra.get("waterways") or []

        return {
            # Scenario parameters
            "scenarioType": scenario.scenarioType.value,
            "intensity": scenario.intensity,
            "unit": scenario.unit,
            "durationHours": scenario.durationHours or 1.0,
            "radiusKm": scenario.radius,
            "targetYear": scenario.targetYear,
            "previousYear": scenario.previousYear,
            # Availability flags
            "hasDem": bool(avail.get("demElevation")),
            "hasDrainageMap": bool(avail.get("drainageNetwork")),
            "hasSubsurfaceDrainageTelemetry": bool(infra.get("subsurfaceDrainageTelemetryAvailable")),
            "hasRoadNetwork": bool(avail.get("roadNetwork")),
            "hasHistoricalArchive": bool(avail.get("historicalArchive")),
            "hasCurrentWeather": bool(avail.get("currentWeather")),
            # Topographic / DEM features (None if DEM unavailable)
            "centerElevationM": dem.get("centerElevationM") if avail.get("demElevation") else None,
            "minElevationM": dem.get("minElevationM") if avail.get("demElevation") else None,
            "maxElevationM": dem.get("maxElevationM") if avail.get("demElevation") else None,
            "elevationReliefM": dem.get("elevationReliefM") if avail.get("demElevation") else None,
            "depressionDepthM": dem.get("depressionDepthM") if avail.get("demElevation") else None,
            "maxSlopeDegrees": dem.get("maxSlopeDegrees") if avail.get("demElevation") else None,
            "isLowLyingCoastal": dem.get("isLowLyingCoastal") if avail.get("demElevation") else None,
            "lowestSector": dem.get("lowestSector") if avail.get("demElevation") else None,
            # Infrastructure & Land Use features
            "namedRoadsCount": len(named_roads),
            "namedRoads": named_roads,
            "waterwaysCount": len(waterways),
            "waterways": waterways,
            "populationDensityKm2": round(pop_density, 1),
            "estimatedPopulationInRadius": estimated_pop_in_radius,
            "builtUpFraction": built_up_fraction,
            # Current baseline telemetry
            "currentTempC": curr_temp_c,
            "currentHumidityPct": float(curr_weather.get("humidity") or 60.0),
            "currentPrecipMm": float(curr_weather.get("precipitationMm") or 0.0),
            "currentWindKmh": curr_wind_kmh,
            "currentAqi": float(curr_aqi.get("aqi") or 75.0) if avail.get("airQuality") else None,
            # Historical comparison percentiles
            "historicalP95RainMm": stat_base.get("p95DailyRainfallMm"),
            "historicalMaxRainMm": stat_base.get("maxObservedDailyRainfallMm"),
            "historicalP95TempC": stat_base.get("p95MaxTempC"),
            "historicalMaxTempC": stat_base.get("maxObservedTempC"),
            "historicalMaxWindKmh": stat_base.get("maxObservedWindGustKmh"),
            "historicalComparableEventsCount": historical.get("comparableEventsCount", 0),
        }


class GeoSpatialAnalyzer:
    """
    Analyzes spatial susceptibility strictly on the basis of available spatial layers.
    """

    @classmethod
    def analyze(
        cls,
        scenario: ScenarioDefinition,
        evidence: Dict[str, Any],
        features: Dict[str, Any],
    ) -> Dict[str, Any]:
        cat = scenario.scenarioType
        spec = ScenarioRegistry.get_spec(cat)
        has_dem = features["hasDem"]
        has_drainage = features["hasDrainageMap"]
        has_roads = features["hasRoadNetwork"]

        statements: List[EvidenceStatement] = []
        available_layers: List[str] = []
        unavailable_layers: List[str] = []

        # 1. Evaluate DEM / Elevation & Slope only if DEM was actually retrieved
        terrain_susceptibility = "UNKNOWN / INSUFFICIENT DATA"
        if has_dem:
            available_layers.extend(["DEM / Elevation (Copernicus GLO-90)", "Terrain Slope Gradient"])
            c_elev = features["centerElevationM"]
            min_elev = features["minElevationM"]
            max_elev = features["maxElevationM"]
            dep_m = features["depressionDepthM"]
            slope_deg = features["maxSlopeDegrees"]
            lowest = features.get("lowestSector") or {}

            if cat in (ScenarioCategory.RAINFALL, ScenarioCategory.FLOOD, ScenarioCategory.WATER_LEVEL_RISE):
                if dep_m >= 6.0:
                    terrain_susceptibility = "MODERATE_TO_HIGH_TOPOGRAPHIC_CONVERGENCE"
                    statements.append(
                        EvidenceStatement(
                            statement=(
                                f"DEM profile indicates center elevation of {c_elev:.1f} m ASL (range {min_elev:.1f}–{max_elev:.1f} m) "
                                f"with a localized depression differential of {dep_m:.1f} m toward the {lowest.get('direction', 'lowest')} sector "
                                f"({lowest.get('elevationM', min_elev):.1f} m ASL), favoring gravity-driven surface runoff convergence."
                            ),
                            evidenceType=EvidenceType.CURRENT_OBSERVATION,
                            confidence=ConfidenceLevel.HIGH,
                            source="Copernicus GLO-90 Digital Elevation Model",
                        )
                    )
                else:
                    terrain_susceptibility = "LOW_TO_MODERATE_GENTLE_RELIEF"
                    statements.append(
                        EvidenceStatement(
                            statement=(
                                f"DEM profile shows elevation ranging from {min_elev:.1f} m to {max_elev:.1f} m ASL "
                                f"(center {c_elev:.1f} m, slope {slope_deg:.2f}°, depression differential {dep_m:.1f} m), "
                                f"indicating relatively uniform terrain without deep topographic basins."
                            ),
                            evidenceType=EvidenceType.CURRENT_OBSERVATION,
                            confidence=ConfidenceLevel.HIGH,
                            source="Copernicus GLO-90 Digital Elevation Model",
                        )
                    )
            elif cat == ScenarioCategory.LANDSLIDE:
                if slope_deg >= 12.0:
                    terrain_susceptibility = "ELEVATED_SLOPE_GRADIENT"
                elif slope_deg >= 5.0:
                    terrain_susceptibility = "MODERATE_SLOPE_GRADIENT"
                else:
                    terrain_susceptibility = "LOW_SLOPE_GRADIENT_FLAT_TERRAIN"
                statements.append(
                    EvidenceStatement(
                        statement=(
                            f"DEM analysis across the {scenario.radius:.1f} km radius measures a maximum slope gradient of "
                            f"{slope_deg:.2f}° and elevation relief of {features['elevationReliefM']:.1f} m "
                            f"({min_elev:.1f}–{max_elev:.1f} m ASL)."
                        ),
                        evidenceType=EvidenceType.CURRENT_OBSERVATION,
                        confidence=ConfidenceLevel.HIGH,
                        source="Copernicus GLO-90 Digital Elevation Model",
                    )
                )
            elif cat in (ScenarioCategory.COASTAL_INUNDATION, ScenarioCategory.STORM_SURGE, ScenarioCategory.CYCLONE):
                is_coastal = bool(features.get("isLowLyingCoastal"))
                terrain_susceptibility = "LOW_ELEVATION_COASTAL_ZONE" if is_coastal else "INLAND_OR_ELEVATED_TERRAIN"
                statements.append(
                    EvidenceStatement(
                        statement=(
                            f"Terrain elevation at target coordinates is {c_elev:.1f} m above mean sea level "
                            f"({'low-elevation coastal zone susceptible to marine surge' if is_coastal else 'elevated terrain insulated from direct sea-level surge'})."
                        ),
                        evidenceType=EvidenceType.CURRENT_OBSERVATION,
                        confidence=ConfidenceLevel.HIGH,
                        source="Copernicus GLO-90 Digital Elevation Model",
                    )
                )
            else:
                terrain_susceptibility = "OBSERVED_TERRAIN_BASELINE"
                statements.append(
                    EvidenceStatement(
                        statement=f"Elevation is {c_elev:.1f} m ASL with a local terrain slope of {slope_deg:.2f}°.",
                        evidenceType=EvidenceType.CURRENT_OBSERVATION,
                        confidence=ConfidenceLevel.HIGH,
                        source="Copernicus GLO-90 Digital Elevation Model",
                    )
                )
        else:
            unavailable_layers.append("DEM / Elevation & Slope")
            statements.append(
                EvidenceStatement(
                    statement="Digital Elevation Model (DEM) data is unavailable for this request; no elevation-based vulnerability is claimed.",
                    evidenceType=EvidenceType.UNKNOWN_INSUFFICIENT_DATA,
                    confidence=ConfidenceLevel.LOW,
                    source="GeoSpatialAnalyzer",
                )
            )

        # 2. Evaluate Drainage Data strictly per Section 20 ("If drainage data is unavailable: do not claim poor drainage")
        if cat in (ScenarioCategory.RAINFALL, ScenarioCategory.FLOOD, ScenarioCategory.WATER_LEVEL_RISE, ScenarioCategory.STORM):
            if has_drainage:
                available_layers.append("Surface Waterways & Open Channels (OpenStreetMap)")
                w_names = ", ".join(w["name"] for w in features["waterways"][:3])
                statements.append(
                    EvidenceStatement(
                        statement=(
                            f"OpenStreetMap hydrographic layer identifies {features['waterwaysCount']} mapped surface waterway/drain channel(s) "
                            f"in proximity ({w_names}). However, sub-surface municipal storm sewer pipe diameter and real-time blockage telemetry are unavailable; "
                            f"poor sub-surface drainage is NOT asserted as an observed fact."
                        ),
                        evidenceType=EvidenceType.CURRENT_OBSERVATION,
                        confidence=ConfidenceLevel.MEDIUM,
                        source="OpenStreetMap Hydrographic Layer",
                    )
                )
            else:
                unavailable_layers.append("Drainage / Storm Sewer Network Telemetry")
                statements.append(
                    EvidenceStatement(
                        statement=(
                            "Sub-surface municipal drainage network geometry and sensor telemetry are unavailable; "
                            "the engine does not claim poor drainage without verified drainage data."
                        ),
                        evidenceType=EvidenceType.UNKNOWN_INSUFFICIENT_DATA,
                        confidence=ConfidenceLevel.LOW,
                        source="GeoSpatialAnalyzer",
                    )
                )

        # 3. Evaluate Road Network & Built-Up Density
        if has_roads:
            available_layers.append("Road Network Hierarchy (OpenStreetMap)")
            road_names = [r["roadName"] for r in features["namedRoads"][:4]]
            roads_desc = ", ".join(road_names) if road_names else "local arterial and collector corridors"
            statements.append(
                EvidenceStatement(
                    statement=(
                        f"OpenStreetMap road topology identifies {max(1, features['namedRoadsCount'])} primary/secondary corridor(s) "
                        f"within the analysis zone ({roads_desc})."
                    ),
                    evidenceType=EvidenceType.CURRENT_OBSERVATION,
                    confidence=ConfidenceLevel.HIGH,
                    source="OpenStreetMap Road Network",
                )
            )
        else:
            unavailable_layers.append("Detailed Road Segment Geometry")

        if evidence.get("availability", {}).get("populationExposure"):
            available_layers.append("Population & Built-Up Exposure Grid (WorldPop)")
            statements.append(
                EvidenceStatement(
                    statement=(
                        f"Estimated population density is ~{features['populationDensityKm2']:,.0f} residents/km² "
                        f"(~{features['estimatedPopulationInRadius']:,} residents within {scenario.radius:.1f} km radius; "
                        f"built-up impervious proxy: {int(features['builtUpFraction'] * 100)}%)."
                    ),
                    evidenceType=EvidenceType.INFERENCE,
                    confidence=ConfidenceLevel.MEDIUM,
                    source="WorldPop Population Dataset",
                )
            )

        susceptibility_layer_generated = bool(has_dem or has_roads)

        return {
            "susceptibilityLayerGenerated": susceptibility_layer_generated,
            "terrainSusceptibilityClassification": terrain_susceptibility,
            "requestedLayersForScenario": spec.geospatialLayers,
            "availableSpatialLayers": available_layers,
            "unavailableSpatialLayers": unavailable_layers,
            "elevationSummary": {
                "centerElevationM": features["centerElevationM"],
                "minElevationM": features["minElevationM"],
                "maxElevationM": features["maxElevationM"],
                "depressionDepthM": features["depressionDepthM"],
                "maxSlopeDegrees": features["maxSlopeDegrees"],
                "lowestSector": features["lowestSector"],
            } if has_dem else None,
            "statements": [s.model_dump() for s in statements],
        }
