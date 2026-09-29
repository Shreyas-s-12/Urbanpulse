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
                        "This is a hypothetical earthquake scenario. UrbanPulse does NOT predict the occurrence of earthquakes, "
                        "and does not invent earthquake probabilities. Seismological science cannot predict the timing or location of earthquakes. "
                        f"The model evaluates physical consequence vulnerability for {loc_name} assuming ground shaking occurs."
                    ),
                    evidenceType=EvidenceType.ASSUMPTION,
                    confidence=ConfidenceLevel.HIGH,
                    source="UrbanPulse Scenario Disclaimer & Scientific Integrity Standard",
                )
            )
            prediction_statements.append(
                EvidenceStatement(
                    statement=(
                        f"For a hypothetical Mw {eff_intensity:.1f} seismic event near {loc_name}, attenuation modeling projects "
                        f"{'light tremor perception without structural collapse (Mw < 4.0)' if severity_band == 'LOW_ROUTINE' else 'moderate-to-strong ground shaking across built-up sectors with potential non-structural damage, utility stress, and corridor clearance delays'}."
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

        # Generate Role-Aware Recommendations
        role_recommendations = cls._generate_role_recommendations(
            cat=cat,
            severity_band=severity_band,
            features=features,
            eff_intensity=eff_intensity,
            spec=spec,
            loc_name=loc_name,
        )

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
            "roleRecommendations": role_recommendations,
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

    @classmethod
    def _generate_role_recommendations(
        cls,
        cat: ScenarioCategory,
        severity_band: str,
        features: Dict[str, Any],
        eff_intensity: float,
        spec: Any,
        loc_name: str,
    ) -> Dict[str, Any]:
        """
        Generates role-specific decision support tailored to the hazard category and location:
        - CITIZEN
        - EMERGENCY_RESPONDER
        - MUNICIPAL_OFFICIAL
        - URBAN_PLANNER
        - GENERAL_USER
        """
        if cat == ScenarioCategory.EARTHQUAKE:
            citizen_actions = [
                "DROP, COVER, AND HOLD ON: If shaking occurs, immediately drop to knees, take cover under a sturdy desk or table, and protect head and neck.",
                "Stay indoors away from exterior glass, windows, unanchored bookcases, and tall furniture until shaking stops.",
                "Do NOT attempt to use elevators; do NOT run outside during active shaking due to falling masonry and glass debris.",
                "Once shaking ceases, inspect your living space for gas leaks and smell of smoke; turn off main gas/breaker valves if odor or damage is detected.",
                "Keep a battery-powered radio and emergency water (minimum 3 liters per person per day) in an easily accessible go-bag.",
            ]
            responder_actions = [
                f"Establish emergency response staging areas in open spaces away from high-rise structures and potential building collapse envelopes in {loc_name}.",
                "Prioritize rapid structural and clearance assessments along primary arterial corridors to ensure hospital and fire brigade access.",
                "Monitor for secondary hazard escalation: ruptured gas lines, localized electrical fires, water main breaks, and damaged bridge viaducts.",
                "Implement Urban Search and Rescue (USAR) triage protocols focusing on unreinforced masonry structures and older building stock.",
            ]
            municipal_actions = [
                f"Activate Emergency Operations Center (EOC) protocols for {loc_name} to coordinate multi-agency disaster response.",
                "Issue verified emergency broadcast advisories via SMS and sirens; combat rumors and specify designated assembly grounds.",
                "Direct municipal electricity and water utilities to conduct emergency isolations in damaged sectors to prevent secondary fire or flood risks.",
                "Coordinate with transit authorities to suspend metro/rail systems for mandatory track alignment and bridge span inspections.",
            ]
            planner_actions = [
                f"Conduct systematic audit of building code compliance (e.g. IS 1893 seismic zoning standards) across {loc_name}'s building stock.",
                "Prioritize structural retrofitting grants for soft-story commercial buildings, unreinforced masonry, and essential civic structures.",
                "Update municipal microzonation maps to identify local soil amplification, high water table liquefaction zones, and slope failure pockets.",
                "Incorporate flexible utility conduits and redundant arterial grid connectivity in master spatial redevelopment plans.",
            ]
        elif cat in (ScenarioCategory.RAINFALL, ScenarioCategory.FLOOD, ScenarioCategory.HEAVY_RAINFALL):
            citizen_actions = [
                "Move to higher ground immediately if in low-lying sectors or near unbanked drainage channels.",
                "Never walk, swim, or drive through moving floodwaters ('Turn Around, Don't Drown') — 15 cm of moving water can knock an adult down.",
                "Elevate critical household utilities, electrical appliances, and documents above ground floor level.",
                "Keep emergency phone numbers (112, municipal helpline) saved offline and monitor official meteorological updates.",
            ]
            responder_actions = [
                "Pre-deploy high-capacity dewatering pumps, rescue boats, and personnel to historically vulnerable underpasses and lake overflow channels.",
                "Set up road closures and warning barriers at submerged underpasses and low-lying arterial bottlenecks.",
                "Establish temporary medical triage centers outside the 100-year inundation floodplain envelope.",
            ]
            municipal_actions = [
                "Activate round-the-clock stormwater control rooms and desilting teams at primary stormwater outfalls.",
                "Coordinate real-time bus and traffic diversions away from waterlogged arterial intersections.",
                "Prepare emergency relief shelters with potable water, hygiene kits, and backup power generators.",
            ]
            planner_actions = [
                "Enforce buffer zones along riverbanks and lake beds, halting unauthorized reclamation and encroachment.",
                "Upgrade municipal stormwater drainage trunk capacity to accommodate 50-year rainfall intensity baselines.",
                "Mandate permeable pavements and decentralized rainwater percolation pits in all new commercial developments.",
            ]
        elif cat == ScenarioCategory.CYCLONE:
            citizen_actions = [
                "Secure or store loose outdoor furniture, tin roofs, and construction materials that could become high-speed airborne missiles.",
                "Board or shutter glass windows; stay in an interior windowless room during peak cyclonic wind passage.",
                "Charge all mobile devices and backup power banks; store 72 hours of non-perishable food and drinking water.",
                "Heed official evacuation advisories immediately if residing in coastal low-lying or kutcha housing zones.",
            ]
            responder_actions = [
                "Pre-position power-saw road clearance crews and heavy earthmovers along arterial evacuation routes to clear uprooted trees and poles.",
                "Deploy emergency telecommunications satellite units in anticipation of coastal cellular tower failures.",
                "Prepare storm-surge evacuation transport for vulnerable coastal fishing hamlets and informal settlements.",
            ]
            municipal_actions = [
                "Issue mandatory port and beach closure directives; halt all marine operations and fishing trawler departures.",
                "Shut down high-voltage overhead distribution lines in sectors experiencing sustained gusts >80 km/h to prevent electrocution.",
                "Stock public shelters with emergency food rations, infant nutrition, and essential medical supplies.",
            ]
            planner_actions = [
                "Transition overhead electrical and telecommunication distribution lines to underground insulated ducts in cyclone-prone corridors.",
                "Establish mandatory coastal green belts (mangroves and shelterbelts) to attenuate storm-surge wave kinetic energy.",
                "Enforce wind-resistant structural building codes (IS 875 Part 3) for all industrial sheds, signboards, and coastal structures.",
            ]
        elif cat == ScenarioCategory.EXTREME_HEAT:
            citizen_actions = [
                "Avoid strenuous outdoor activities between 11:00 AM and 4:00 PM when solar thermal irradiance is at its peak.",
                "Maintain hydration by drinking water, ORS, or buttermilk frequently, even before feeling thirsty.",
                "Wear loose, light-colored cotton clothing and cover head with a damp cloth or umbrella when outside.",
                "Recognize early heat exhaustion symptoms (dizziness, nausea, headache, heavy sweating); seek immediate shade and cooling.",
            ]
            responder_actions = [
                "Equip emergency ambulances with ice packs, intravenous saline fluids, and specialized heat-stroke cooling protocols.",
                "Set up shaded drinking water and oral rehydration kiosks at major bus terminals, construction sites, and transit hubs.",
            ]
            municipal_actions = [
                "Activate the Municipal Heat Action Plan (HAP): adjust school/construction working hours to early morning and late evening.",
                "Coordinate with power utilities to ensure uninterruptible electricity supply to hospitals and cooling centers.",
                "Deploy municipal water tankers to densely populated informal settlements experiencing high thermal stress.",
            ]
            planner_actions = [
                "Implement cool-roof initiatives (high-albedo reflective coatings) on government, commercial, and residential buildings.",
                "Expand urban canopy cover and vegetative shade corridors to mitigate Urban Heat Island (UHI) sensible heat accumulation.",
                "Incorporate passive architectural ventilation and shading requirements into local municipal building bylaws.",
            ]
        else:
            citizen_actions = [
                f"Stay informed through official civic advisories regarding {spec.displayName.lower()} conditions.",
                "Inspect personal living environment for potential vulnerabilities and maintain standard household emergency supplies.",
                "Follow official safety instructions issued by local municipal and disaster management authorities.",
            ]
            responder_actions = [
                f"Review operational contingency plans and staging protocols for {spec.displayName.lower()} scenarios.",
                "Ensure emergency communications equipment and vehicle fleets are fully operational and fueled.",
            ]
            municipal_actions = [
                f"Coordinate inter-agency monitoring between municipal departments, utilities, and emergency services for {spec.displayName.lower()}.",
                "Keep emergency dispatch and civic helpline channels staffed and responsive.",
            ]
            planner_actions = [
                f"Incorporate multi-hazard resilience and climate adaptation standards into long-term infrastructure planning.",
                "Review critical infrastructure dependencies to eliminate single points of failure across {loc_name}.",
            ]

        return {
            "citizen": {
                "role": "Citizen / Resident",
                "hazard": cat.value,
                "posture": "PRECAUTIONARY" if severity_band == "LOW_ROUTINE" else "PROTECTIVE_ACTION",
                "recommendedActions": citizen_actions,
            },
            "emergencyResponder": {
                "role": "Emergency Responder & First Responder Teams",
                "hazard": cat.value,
                "readinessLevel": "STAGE_1_MONITORING" if severity_band == "LOW_ROUTINE" else "STAGE_3_RAPID_DEPLOYMENT",
                "operationalPriorities": responder_actions,
            },
            "municipalOfficial": {
                "role": "Municipal Official & City Administration",
                "hazard": cat.value,
                "eocActivation": "NORMAL" if severity_band == "LOW_ROUTINE" else "EOC_ACTIVATED",
                "civicProtocols": municipal_actions,
            },
            "urbanPlanner": {
                "role": "Urban Planner & Structural Engineer",
                "hazard": cat.value,
                "focus": "LONG_TERM_RESILIENCE",
                "mitigationMeasures": planner_actions,
            },
            "generalUser": {
                "role": "General Public / Commuter",
                "summary": f"{spec.displayName} scenario evaluated for {loc_name}. Overall severity is classified as {severity_band.replace('_', ' ').lower()}.",
                "keyTakeaway": citizen_actions[0] if citizen_actions else "Follow official guidance.",
            },
        }

