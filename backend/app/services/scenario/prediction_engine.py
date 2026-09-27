"""
PredictionEngine for the Generalized UrbanPulse Scenario Intelligence Engine.
Executes deterministic, physics- and empirical-grounded impact calculations across
all 16 scenario categories.
Strictly enforces:
- Section 5: Do NOT assume a scenario causes damage (e.g., 10 mm rainfall in 1h != flooding).
- Section 14: Never claim "Road closed" for hypothetical scenarios; use "Potential disruption" or "Model-derived vulnerability".
- Section 17: Generalized 4-Factor Impact Model dynamically tailored to the ScenarioCategory.
"""

from typing import Any, Dict, List, Optional
from app.services.scenario.models import (
    ConfidenceLevel,
    EvidenceStatement,
    EvidenceType,
    FactorEvaluation,
    ScenarioCategory,
    ScenarioDefinition,
)
from app.services.scenario.registry import ScenarioRegistry


class PredictionEngine:
    """
    Deterministic multi-hazard prediction layer that transforms:
    ScenarioDefinition + Historical Comparison + Geospatial Features + Infrastructure + Current Conditions
    into bounded impact estimates and dynamic 4-factor evaluations.
    """

    @classmethod
    def predict(
        cls,
        scenario: ScenarioDefinition,
        evidence: Dict[str, Any],
        historical: Dict[str, Any],
        geospatial: Dict[str, Any],
        features: Dict[str, Any],
        baseline_score: int = 76,
    ) -> Dict[str, Any]:
        cat = scenario.scenarioType
        spec = ScenarioRegistry.get_spec(cat)
        dur_hrs = max(0.5, float(scenario.durationHours or 1.0))

        # Resolve effective intensity for modeling (while noting if default reference was used)
        raw_intensity = scenario.intensity
        used_reference_intensity = False
        if raw_intensity is None:
            used_reference_intensity = True
            eff_intensity = spec.moderateThresholdIntensity
        else:
            eff_intensity = float(raw_intensity)
            # If user passed a percentage increase (e.g. +40% rainfall in legacy calls), convert to physical mm
            if cat == ScenarioCategory.RAINFALL and scenario.unit == "%":
                eff_intensity = round(25.0 * (1.0 + eff_intensity / 100.0), 1)
            elif cat == ScenarioCategory.EXTREME_HEAT and (
                (scenario.unit and "delta" in scenario.unit) or eff_intensity <= 15.0
            ):
                eff_intensity = round(float(features.get("currentTempC") or 30.0) + eff_intensity, 1)

        # Evaluate severity band without assuming damage (Section 5)
        if eff_intensity <= spec.routineMaxIntensity:
            severity_band = "LOW_ROUTINE"
            causes_significant_disruption = False
        elif eff_intensity < spec.moderateThresholdIntensity:
            severity_band = "MODERATE_LOCALIZED"
            causes_significant_disruption = False
        elif eff_intensity < spec.severeThresholdIntensity:
            severity_band = "ELEVATED_STRESS"
            causes_significant_disruption = True
        else:
            severity_band = "HIGH_STRESS"
            causes_significant_disruption = True

        # Evaluate the 4 Scenario-Specific Impact Factors (Section 17)
        four_factors = cls._evaluate_four_factors(
            cat=cat,
            spec=spec,
            eff_intensity=eff_intensity,
            dur_hrs=dur_hrs,
            severity_band=severity_band,
            features=features,
        )

        # Compute deterministic metrics (score delta, traffic delay, speed reduction, inundation depth, environmental impact)
        mean_factor_score = sum(f.score or 20.0 for f in four_factors) / max(1, len(four_factors))

        if severity_band == "LOW_ROUTINE":
            # Critical rule: e.g. 10 mm rain in 1h does NOT cause flood or road closure
            score_drop = max(2, min(6, round(mean_factor_score * 0.12)))
            traffic_delay_pct = round(max(3.0, min(12.0, mean_factor_score * 0.22)), 1)
            speed_reduction_pct = round(max(2.0, min(8.0, mean_factor_score * 0.16)), 1)
            inundation_depth_m = 0.0
            flood_risk_label = (
                f"LOW — {eff_intensity:g} {scenario.unit or spec.defaultUnit} over {dur_hrs:g}h is within routine "
                f"surface runoff envelope; does NOT automatically cause general flooding."
                if cat in (ScenarioCategory.RAINFALL, ScenarioCategory.FLOOD, ScenarioCategory.STORM)
                else "LOW (Not a hydrological flooding scenario)"
            )
            traffic_status_label = (
                f"ROUTINE / MINOR WET-PAVEMENT SLOWDOWN (+{traffic_delay_pct:.0f}% travel time variance; no closures predicted)"
            )
        elif severity_band == "MODERATE_LOCALIZED":
            score_drop = max(6, min(14, round(mean_factor_score * 0.24)))
            traffic_delay_pct = round(min(28.0, 10.0 + mean_factor_score * 0.32), 1)
            speed_reduction_pct = round(min(20.0, 7.0 + mean_factor_score * 0.24), 1)
            inundation_depth_m = (
                round(max(0.02, (eff_intensity - spec.routineMaxIntensity) * 0.003), 2)
                if cat in (ScenarioCategory.RAINFALL, ScenarioCategory.FLOOD, ScenarioCategory.STORM)
                else 0.0
            )
            flood_risk_label = (
                f"MODERATE LOCALIZED — Potential transient curb-side waterlogging ({inundation_depth_m:.2f} m modeled ponding in low-lying DEM pockets); no widespread inundation."
                if cat in (ScenarioCategory.RAINFALL, ScenarioCategory.FLOOD, ScenarioCategory.STORM)
                else "LOW"
            )
            traffic_status_label = f"MODERATE (+{traffic_delay_pct:.0f}% modeled corridor travel delay)"
        else:
            score_drop = max(10, min(32, round(mean_factor_score * 0.36)))
            traffic_delay_pct = round(min(65.0, 18.0 + mean_factor_score * 0.52), 1)
            speed_reduction_pct = round(min(42.0, 12.0 + mean_factor_score * 0.38), 1)
            inundation_depth_m = (
                round(max(0.12, (eff_intensity - spec.routineMaxIntensity) * 0.006), 2)
                if cat in (ScenarioCategory.RAINFALL, ScenarioCategory.FLOOD, ScenarioCategory.STORM, ScenarioCategory.CYCLONE)
                else round(eff_intensity * 0.35, 2)
                if cat in (ScenarioCategory.WATER_LEVEL_RISE, ScenarioCategory.COASTAL_INUNDATION, ScenarioCategory.STORM_SURGE)
                else 0.0
            )
            flood_risk_label = (
                f"HIGH (Elevated surface runoff & low-lying depression accumulation risk; modeled ponding depth ~{inundation_depth_m:.2f} m)"
                if cat in (
                    ScenarioCategory.RAINFALL,
                    ScenarioCategory.FLOOD,
                    ScenarioCategory.STORM,
                    ScenarioCategory.CYCLONE,
                    ScenarioCategory.WATER_LEVEL_RISE,
                    ScenarioCategory.COASTAL_INUNDATION,
                    ScenarioCategory.STORM_SURGE,
                )
                else "LOW (Non-hydrological hazard)"
            )
            traffic_status_label = f"HEAVY (+{traffic_delay_pct:.0f}% projected arterial delay; potential corridor disruption)"

        simulated_score = max(15, baseline_score - score_drop)

        # Build explicit MODEL-DERIVED PREDICTION statements
        prediction_statements: List[EvidenceStatement] = []
        loc_name = (
            scenario.resolvedLocation.displayName
            if scenario.resolvedLocation
            else (scenario.location or "Selected Location")
        )

        if cat == ScenarioCategory.RAINFALL:
            rate_mm_hr = round(eff_intensity / dur_hrs, 1)
            if severity_band == "LOW_ROUTINE":
                prediction_statements.append(
                    EvidenceStatement(
                        statement=(
                            f"A scenario of {eff_intensity:g} mm rainfall over {dur_hrs:g} hour(s) ({rate_mm_hr:g} mm/hr) at {loc_name} "
                            f"falls below typical urban waterlogging thresholds (>25–35 mm/hr). The deterministic runoff model predicts "
                            f"routine surface wetting and minor gutter flow without general flooding, road closure, or structural damage."
                        ),
                        evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                        confidence=ConfidenceLevel.HIGH if features["hasHistoricalArchive"] else ConfidenceLevel.MEDIUM,
                        source="UrbanPulse Hydrological & Kinematic Model",
                    )
                )
                if features["hasDem"] and (features.get("depressionDepthM") or 0.0) >= 3.0:
                    lowest = features.get("lowestSector") or {}
                    prediction_statements.append(
                        EvidenceStatement(
                            statement=(
                                f"Given the local DEM depression differential of {features['depressionDepthM']:.1f} m toward the "
                                f"{lowest.get('direction', 'lowest')} sector ({lowest.get('elevationM')} m ASL), minor shallow curb-side "
                                f"puddling (<0.03 m) and a brief -{speed_reduction_pct:.0f}% wet-pavement speed moderation may occur."
                            ),
                            evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                            confidence=ConfidenceLevel.MEDIUM,
                            source="UrbanPulse DEM Topographic Convergence Model",
                        )
                    )
            else:
                prediction_statements.append(
                    EvidenceStatement(
                        statement=(
                            f"Under {eff_intensity:g} mm rainfall over {dur_hrs:g} hour(s) ({rate_mm_hr:g} mm/hr), modeled surface runoff "
                            f"exceeds routine curb-inlet intake, generating elevated waterlogging susceptibility in low-lying depressions "
                            f"(modeled ponding depth ~{inundation_depth_m:.2f} m) and a projected +{traffic_delay_pct:.0f}% arterial travel time delay."
                        ),
                        evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                        confidence=ConfidenceLevel.MEDIUM,
                        source="UrbanPulse Hydrological & Kinematic Model",
                    )
                )

        elif cat == ScenarioCategory.EXTREME_HEAT:
            prediction_statements.append(
                EvidenceStatement(
                    statement=(
                        f"A {eff_intensity:.1f}°C thermal event lasting {dur_hrs:g} hour(s) ({round(dur_hrs / 24.0, 1):g} days) "
                        f"compared to the local 95th percentile historical maximum ({features.get('historicalP95TempC') or 33.0:.1f}°C) "
                        f"produces {'moderate ambient heat stress' if severity_band == 'LOW_ROUTINE' else 'elevated Urban Heat Island retention, increased cooling water/power demand, and thermal exposure across built-up sectors'}."
                    ),
                    evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                    confidence=ConfidenceLevel.MEDIUM,
                    source="UrbanPulse Thermal & UHI Balance Model",
                )
            )

        elif cat == ScenarioCategory.LANDSLIDE:
            slope_deg = features.get("maxSlopeDegrees")
            if not features["hasDem"]:
                prediction_statements.append(
                    EvidenceStatement(
                        statement=(
                            "Digital Elevation Model (DEM) slope gradients are unavailable; slope failure vulnerability "
                            "cannot be asserted without terrain elevation data."
                        ),
                        evidenceType=EvidenceType.UNKNOWN_INSUFFICIENT_DATA,
                        confidence=ConfidenceLevel.LOW,
                        source="UrbanPulse Slope Stability Model",
                    )
                )
            elif (slope_deg or 0.0) < 5.0:
                prediction_statements.append(
                    EvidenceStatement(
                        statement=(
                            f"Measured DEM maximum terrain slope across {loc_name} is {slope_deg:.2f}° (flat to gently undulating relief). "
                            f"Because slope gradients are well below critical mass-wasting initiation angles (>15°), the model predicts "
                            f"LOW landslide susceptibility even under rainfall forcing."
                        ),
                        evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                        confidence=ConfidenceLevel.HIGH,
                        source="UrbanPulse Infinite-Slope Geotechnical Model",
                    )
                )
            else:
                prediction_statements.append(
                    EvidenceStatement(
                        statement=(
                            f"Combining a measured terrain slope of {slope_deg:.2f}° with {eff_intensity:g} mm triggering precipitation "
                            f"indicates {severity_band.replace('_', ' ').lower()} shear stress along hillside cuts and embankment corridors."
                        ),
                        evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                        confidence=ConfidenceLevel.MEDIUM,
                        source="UrbanPulse Infinite-Slope Geotechnical Model",
                    )
                )

        elif cat == ScenarioCategory.EARTHQUAKE:
            prediction_statements.append(
                EvidenceStatement(
                    statement=(
                        f"For a hypothetical Mw {eff_intensity:.1f} seismic event near {loc_name}, attenuation modeling projects "
                        f"{'light tremor perception without structural damage (Mw < 4.0)' if severity_band == 'LOW_ROUTINE' else 'moderate-to-strong ground shaking across built-up sectors with potential non-structural/corridor inspection delays'}."
                    ),
                    evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                    confidence=ConfidenceLevel.MEDIUM,
                    source="UrbanPulse Seismic Ground-Motion Attenuation Model",
                )
            )

        else:
            prediction_statements.append(
                EvidenceStatement(
                    statement=(
                        f"Under the {spec.displayName} ({eff_intensity:g} {scenario.unit or spec.defaultUnit}), deterministic stress modeling "
                        f"projects a {severity_band.replace('_', ' ').lower()} impact profile across {loc_name} "
                        f"(projected score {simulated_score}/100 vs baseline {baseline_score}/100)."
                    ),
                    evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                    confidence=ConfidenceLevel.MEDIUM,
                    source="UrbanPulse Multi-Hazard Scenario Model",
                )
            )

        # Environmental Impact summary tailored to the scenario
        env_impact = cls._build_environmental_impact(cat, eff_intensity, dur_hrs, severity_band, features)

        return {
            "effectiveIntensity": eff_intensity,
            "effectiveUnit": scenario.unit or spec.defaultUnit,
            "usedReferenceIntensity": used_reference_intensity,
            "severityBand": severity_band,
            "causesSignificantDisruption": causes_significant_disruption,
            "baselineScore": baseline_score,
            "simulatedScore": simulated_score,
            "scoreDrop": score_drop,
            "trafficDelayIncreasePercent": traffic_delay_pct,
            "speedReductionPercent": speed_reduction_pct,
            "inundationDepthMeters": inundation_depth_m,
            "floodRiskLabel": flood_risk_label,
            "trafficStatusLabel": traffic_status_label,
            "environmentalImpact": env_impact,
            "populationExposure": {
                "populationDensityPerKm2": features["populationDensityKm2"],
                "estimatedResidentsInRadius": features["estimatedPopulationInRadius"],
                "modeledExposedPopulation": int(
                    round(
                        features["estimatedPopulationInRadius"]
                        * (0.08 if severity_band == "LOW_ROUTINE" else 0.28 if severity_band == "MODERATE_LOCALIZED" else 0.55)
                    )
                ),
                "evidenceType": EvidenceType.MODEL_DERIVED_PREDICTION.value,
            },
            "fourFactors": [f.model_dump() for f in four_factors],
            "statements": [s.model_dump() for s in prediction_statements],
        }

    @classmethod
    def _evaluate_four_factors(
        cls,
        cat: ScenarioCategory,
        spec: Any,
        eff_intensity: float,
        dur_hrs: float,
        severity_band: str,
        features: Dict[str, Any],
    ) -> List[FactorEvaluation]:
        """
        Computes the 4 scenario-specific impact factors defined in ScenarioRegistry.
        """
        evaluations: List[FactorEvaluation] = []
        has_dem = features["hasDem"]
        has_drainage = features["hasDrainageMap"]
        dep_m = float(features.get("depressionDepthM") or 0.0)
        slope_deg = float(features.get("maxSlopeDegrees") or 0.0)
        pop_density = float(features.get("populationDensityKm2") or 3000.0)
        built_up = float(features.get("builtUpFraction") or 0.45)

        # Normalized intensity ratio relative to moderate threshold
        intensity_ratio = eff_intensity / max(1.0, spec.moderateThresholdIntensity)

        for idx, f_spec in enumerate(spec.fourFactors):
            fid = f_spec.factorId

            # Factor 1: Topographic / Primary Hazard Susceptibility
            if idx == 0:
                if fid == "waterlogging_susceptibility":
                    if not has_dem:
                        evaluations.append(
                            FactorEvaluation(
                                factorId=fid,
                                factorName=f_spec.name,
                                description=f_spec.description,
                                score=None,
                                status="UNKNOWN / INSUFFICIENT DATA (DEM Unavailable)",
                                evidenceType=EvidenceType.UNKNOWN_INSUFFICIENT_DATA,
                                confidence=ConfidenceLevel.LOW,
                                explanation="DEM elevation grid is unavailable; elevation-based waterlogging susceptibility is not asserted.",
                                sources=["Copernicus DEM Check"],
                            )
                        )
                        continue
                    score = min(95.0, round(max(8.0, (intensity_ratio * 32.0) + (dep_m * 3.5)), 1))
                    status = "LOW (Routine Runoff)" if score < 35 else "MODERATE (Localized Depression Pooling)" if score < 65 else "HIGH (Basin Accumulation Risk)"
                    expl = (
                        f"Modeled from {eff_intensity:g} mm precipitation over {dur_hrs:g}h and a measured DEM depression differential of {dep_m:.1f} m "
                        f"(elevation range {features['minElevationM']:.1f}–{features['maxElevationM']:.1f} m ASL)."
                    )
                    evaluations.append(
                        FactorEvaluation(
                            factorId=fid,
                            factorName=f_spec.name,
                            description=f_spec.description,
                            score=score,
                            status=status,
                            evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                            confidence=ConfidenceLevel.HIGH,
                            explanation=expl,
                            sources=["Copernicus GLO-90 DEM", "Open-Meteo ERA5 Archive"],
                        )
                    )
                elif fid == "slope_susceptibility":
                    if not has_dem:
                        evaluations.append(
                            FactorEvaluation(
                                factorId=fid,
                                factorName=f_spec.name,
                                description=f_spec.description,
                                score=None,
                                status="UNKNOWN / INSUFFICIENT DATA (DEM Unavailable)",
                                evidenceType=EvidenceType.UNKNOWN_INSUFFICIENT_DATA,
                                confidence=ConfidenceLevel.LOW,
                                explanation="DEM elevation data is unavailable; slope susceptibility cannot be computed.",
                                sources=["Copernicus DEM Check"],
                            )
                        )
                        continue
                    score = min(95.0, round(max(5.0, slope_deg * 4.2), 1))
                    status = "LOW (Gentle Gradient)" if slope_deg < 6.0 else "MODERATE" if slope_deg < 15.0 else "HIGH (Steep Slope)"
                    evaluations.append(
                        FactorEvaluation(
                            factorId=fid,
                            factorName=f_spec.name,
                            description=f_spec.description,
                            score=score,
                            status=status,
                            evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                            confidence=ConfidenceLevel.HIGH,
                            explanation=f"Derived from DEM maximum terrain slope of {slope_deg:.2f}° and relief of {features['elevationReliefM']:.1f} m.",
                            sources=["Copernicus GLO-90 DEM"],
                        )
                    )
                elif fid == "heat_exposure":
                    p95_t = float(features.get("historicalP95TempC") or 33.0)
                    anomaly_c = max(0.0, eff_intensity - p95_t)
                    score = min(96.0, round(max(12.0, 25.0 + anomaly_c * 6.5), 1))
                    status = "LOW" if score < 35 else "MODERATE HEAT STRESS" if score < 65 else "EXTREME THERMAL EXPOSURE"
                    evaluations.append(
                        FactorEvaluation(
                            factorId=fid,
                            factorName=f_spec.name,
                            description=f_spec.description,
                            score=score,
                            status=status,
                            evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                            confidence=ConfidenceLevel.HIGH,
                            explanation=f"Scenario temperature ({eff_intensity:.1f}°C) is {anomaly_c:+.1f}°C relative to the local 95th percentile historical maximum ({p95_t:.1f}°C).",
                            sources=["Open-Meteo ERA5 Temperature Archive", "Open-Meteo Live"],
                        )
                    )
                else:
                    score = min(95.0, round(max(10.0, intensity_ratio * 48.0), 1))
                    status = "LOW" if score < 35 else "MODERATE" if score < 65 else "ELEVATED"
                    evaluations.append(
                        FactorEvaluation(
                            factorId=fid,
                            factorName=f_spec.name,
                            description=f_spec.description,
                            score=score,
                            status=status,
                            evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                            confidence=ConfidenceLevel.MEDIUM,
                            explanation=f"Modeled from scenario intensity ({eff_intensity:g} {spec.defaultUnit}) relative to regional baseline thresholds.",
                            sources=["UrbanPulse Deterministic Hazard Model"],
                        )
                    )

            # Factor 2: Secondary Environmental / Infrastructure Mechanism (e.g. Drainage Stress, UHI, Soil Moisture)
            elif idx == 1:
                if fid == "drainage_stress":
                    rate_mm_hr = eff_intensity / dur_hrs
                    score = min(94.0, round(max(8.0, (rate_mm_hr / 35.0) * 52.0 * (0.7 + built_up * 0.6)), 1))
                    status = (
                        "WITHIN NOMINAL CAPACITY (Low Stress)"
                        if rate_mm_hr <= 15.0
                        else "MODERATE CONVEYANCE LOAD"
                        if rate_mm_hr <= 35.0
                        else "HIGH DRAINAGE SURCHARGE RISK"
                    )
                    drain_note = (
                        f"Mapped waterways count: {features['waterwaysCount']}."
                        if has_drainage
                        else "Sub-surface municipal pipe telemetry is unavailable; estimated from runoff rate and impervious fraction."
                    )
                    evaluations.append(
                        FactorEvaluation(
                            factorId=fid,
                            factorName=f_spec.name,
                            description=f_spec.description,
                            score=score,
                            status=status,
                            evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION if has_drainage else EvidenceType.INFERENCE,
                            confidence=ConfidenceLevel.MEDIUM if has_drainage else ConfidenceLevel.LOW,
                            explanation=f"Runoff rate of {rate_mm_hr:.1f} mm/hr across {int(built_up * 100)}% impervious proxy. {drain_note}",
                            sources=["OpenStreetMap Hydrography", "Runoff Rational Method Model"],
                        )
                    )
                elif fid == "built_environment_heat":
                    score = min(92.0, round(max(15.0, built_up * 65.0 + intensity_ratio * 22.0), 1))
                    status = "LOW UHI AMPLIFICATION" if score < 40 else "MODERATE UHI RETENTION" if score < 70 else "HIGH URBAN HEAT ISLAND AMPLIFICATION"
                    evaluations.append(
                        FactorEvaluation(
                            factorId=fid,
                            factorName=f_spec.name,
                            description=f_spec.description,
                            score=score,
                            status=status,
                            evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                            confidence=ConfidenceLevel.MEDIUM,
                            explanation=f"Built-up impervious surface proxy ({int(built_up * 100)}%) increases nocturnal thermal retention and surface sensible heat flux.",
                            sources=["WorldPop Urban Density Proxy", "Urban Energy Balance Model"],
                        )
                    )
                else:
                    score = min(92.0, round(max(12.0, intensity_ratio * 45.0 + built_up * 18.0), 1))
                    status = "LOW" if score < 35 else "MODERATE" if score < 65 else "ELEVATED"
                    evaluations.append(
                        FactorEvaluation(
                            factorId=fid,
                            factorName=f_spec.name,
                            description=f_spec.description,
                            score=score,
                            status=status,
                            evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                            confidence=ConfidenceLevel.MEDIUM,
                            explanation=f"Secondary susceptibility evaluated across {dur_hrs:g}h duration and local terrain/surface properties.",
                            sources=["UrbanPulse Multi-Hazard Scenario Model"],
                        )
                    )

            # Factor 3: Corridor / Sectoral Stress (e.g. Road Disruption, Water Demand, Rainfall Trigger)
            elif idx == 2:
                score = min(94.0, round(max(6.0, intensity_ratio * 42.0 + (features["namedRoadsCount"] * 2.0)), 1))
                if severity_band == "LOW_ROUTINE":
                    score = min(24.0, score)
                    status = "MINIMAL / ROUTINE OPERATIONS (No Road Closures)"
                elif severity_band == "MODERATE_LOCALIZED":
                    status = "MODERATE (Potential Localized Slowdowns)"
                else:
                    status = "ELEVATED (Model-Derived Corridor Vulnerability)"
                evaluations.append(
                    FactorEvaluation(
                        factorId=fid,
                        factorName=f_spec.name,
                        description=f_spec.description,
                        score=score,
                        status=status,
                        evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                        confidence=ConfidenceLevel.MEDIUM,
                        explanation=(
                            f"Evaluated across {max(1, features['namedRoadsCount'])} mapped road corridor(s) and scenario intensity "
                            f"({eff_intensity:g} {spec.defaultUnit}). Hypothetical impact represents potential disruption, not an observed closure."
                        ),
                        sources=["OpenStreetMap Road Network", "Kinematic Traffic Perturbation Model"],
                    )
                )

            # Factor 4: Population & Asset Exposure
            else:
                pop_score = min(95.0, round(max(12.0, (pop_density / 6500.0) * 55.0 + intensity_ratio * 20.0), 1))
                status = "LOW EXPOSURE DENSITY" if pop_score < 35 else "MODERATE URBAN EXPOSURE" if pop_score < 68 else "HIGH DENSITY EXPOSURE"
                evaluations.append(
                    FactorEvaluation(
                        factorId=fid,
                        factorName=f_spec.name,
                        description=f_spec.description,
                        score=pop_score,
                        status=status,
                        evidenceType=EvidenceType.MODEL_DERIVED_PREDICTION,
                        confidence=ConfidenceLevel.MEDIUM,
                        explanation=(
                            f"Based on ~{pop_density:,.0f} residents/km² (~{features['estimatedPopulationInRadius']:,} residents within "
                            f"the {features['radiusKm']:.1f} km analysis radius)."
                        ),
                        sources=["WorldPop Population Exposure Dataset"],
                    )
                )

        return evaluations

    @classmethod
    def _build_environmental_impact(
        cls,
        cat: ScenarioCategory,
        eff_intensity: float,
        dur_hrs: float,
        severity_band: str,
        features: Dict[str, Any],
    ) -> Dict[str, Any]:
        if cat == ScenarioCategory.RAINFALL:
            rate = round(eff_intensity / dur_hrs, 1)
            return {
                "summary": (
                    f"Precipitation rate of {rate:g} mm/hr ({eff_intensity:g} mm total) produces routine surface wetting and topsoil infiltration without environmental degradation."
                    if severity_band == "LOW_ROUTINE"
                    else f"Precipitation rate of {rate:g} mm/hr generates elevated stormwater runoff, urban street wash-off, and transient turbidity in receiving surface drains."
                ),
                "runoffRateMmHr": rate,
                "evidenceType": EvidenceType.MODEL_DERIVED_PREDICTION.value,
            }
        elif cat == ScenarioCategory.EXTREME_HEAT:
            return {
                "summary": (
                    f"Sustained {eff_intensity:.1f}°C air temperature accelerates evapotranspiration, increases photochemical surface ozone formation, and elevates urban canopy thermal load."
                ),
                "ambientTempC": eff_intensity,
                "evidenceType": EvidenceType.MODEL_DERIVED_PREDICTION.value,
            }
        elif cat == ScenarioCategory.AIR_QUALITY_EVENT:
            return {
                "summary": f"Particulate / pollutant concentration at {eff_intensity:g} AQI degrades ambient visibility and increases acute respiratory exposure.",
                "projectedAqi": eff_intensity,
                "evidenceType": EvidenceType.MODEL_DERIVED_PREDICTION.value,
            }
        return {
            "summary": f"Modeled environmental perturbation under {cat.value} ({eff_intensity:g}) is classified as {severity_band.replace('_', ' ').lower()}.",
            "evidenceType": EvidenceType.MODEL_DERIVED_PREDICTION.value,
        }
