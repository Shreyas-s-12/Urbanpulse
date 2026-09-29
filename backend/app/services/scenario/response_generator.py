"""
EvidenceEngine & ScenarioResponseGenerator for the Generalized UrbanPulse Scenario Intelligence Engine.
Enforces strict separation of evidence labels (HISTORICAL EVIDENCE, MODEL-DERIVED PREDICTION,
CURRENT OBSERVATION, FORECAST, ASSUMPTION, INFERENCE, UNKNOWN / INSUFFICIENT DATA)
and builds the complete 14-section Scenario Intelligence report (Section 28).
"""

from datetime import datetime, timezone
from typing import Any, Dict, List
from app.services.scenario.models import (
    ConfidenceLevel,
    EvidenceStatement,
    EvidenceType,
    ScenarioCategory,
    ScenarioDefinition,
    UncertaintyReport,
)
from app.services.scenario.registry import ScenarioRegistry


class EvidenceEngine:
    """
    Strictly separates and labels every claim by its EvidenceType (Section 10).
    Ensures assumptions are never mixed with observations or historical facts.
    """

    @classmethod
    def build_assumptions(
        cls,
        scenario: ScenarioDefinition,
        prediction: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        spec = ScenarioRegistry.get_spec(scenario.scenarioType)
        eff_val = prediction["effectiveIntensity"]
        eff_unit = prediction["effectiveUnit"]
        dur_str = scenario.duration or f"{scenario.durationHours or 1.0:g} hour(s)"

        assumptions: List[EvidenceStatement] = [
            EvidenceStatement(
                statement=(
                    f"The scenario assumes a spatially distributed {spec.displayName.lower()} of "
                    f"{eff_val:g} {eff_unit} sustained over {dur_str} across the {scenario.radius:.1f} km analysis zone."
                ),
                evidenceType=EvidenceType.ASSUMPTION,
                confidence=ConfidenceLevel.MEDIUM,
                source="Scenario Boundary Condition",
            ),
            EvidenceStatement(
                statement="Municipal infrastructure and traffic signal timing operate under standard baseline configurations without unannounced emergency diversions.",
                evidenceType=EvidenceType.ASSUMPTION,
                confidence=ConfidenceLevel.MEDIUM,
                source="Scenario Baseline Assumption",
            ),
        ]

        if prediction.get("usedReferenceIntensity"):
            assumptions.insert(
                0,
                EvidenceStatement(
                    statement=(
                        f"Because no numerical intensity was supplied in the prompt, the model evaluated a reference "
                        f"threshold of {eff_val:g} {eff_unit} for {spec.displayName}. Supply an explicit value to refine."
                    ),
                    evidenceType=EvidenceType.ASSUMPTION,
                    confidence=ConfidenceLevel.LOW,
                    source="ScenarioParser Missing-Parameter Reference",
                ),
            )

        if scenario.targetYear is not None:
            assumptions.append(
                EvidenceStatement(
                    statement=(
                        f"Target year projection ({scenario.targetYear}) assumes stationarity in local topography and "
                        f"extrapolates from multi-year historical observations through previousYear ({scenario.previousYear})."
                    ),
                    evidenceType=EvidenceType.ASSUMPTION,
                    confidence=ConfidenceLevel.MEDIUM,
                    source="Temporal Projection Assumption",
                )
            )

        return [a.model_dump() for a in assumptions]


class ScenarioResponseGenerator:
    """
    Generates the unified 14-section Scenario Intelligence response, map layers,
    markdown report, and backward-compatible API fields.
    """

    @classmethod
    def generate(
        cls,
        scenario: ScenarioDefinition,
        evidence: Dict[str, Any],
        historical: Dict[str, Any],
        geospatial: Dict[str, Any],
        prediction: Dict[str, Any],
        uncertainty: UncertaintyReport,
        map_features: Dict[str, Any],
    ) -> Dict[str, Any]:
        now_utc = datetime.now(timezone.utc)
        now_iso = now_utc.isoformat()
        spec = ScenarioRegistry.get_spec(scenario.scenarioType)

        resolved_loc = scenario.resolvedLocation.model_dump() if scenario.resolvedLocation else {}
        loc_display = resolved_loc.get("displayName") or scenario.location or "Selected Location"

        assumptions_structured = EvidenceEngine.build_assumptions(scenario, prediction)
        assumptions_text_list = [a["statement"] for a in assumptions_structured]
        limitations_text_list = (
            uncertainty.dataLimitations
            + uncertainty.spatialLimitations
            + uncertainty.temporalLimitations
            + uncertainty.modelLimitations
        )

        # Current Conditions Section (Section 20 & 28: Only if real current data is available)
        avail = evidence.get("availability", {})
        if avail.get("currentWeather") or avail.get("airQuality"):
            curr_weather = evidence.get("currentObservations", {}).get("weather", {})
            curr_aqi = evidence.get("currentObservations", {}).get("airQuality", {})
            current_conditions_section = {
                "status": "AVAILABLE",
                "evidenceType": EvidenceType.CURRENT_OBSERVATION.value,
                "weather": curr_weather if avail.get("currentWeather") else None,
                "airQuality": curr_aqi if avail.get("airQuality") else None,
                "summary": (
                    f"Current observed temperature: {curr_weather.get('temperatureC', 'N/A')}, "
                    f"condition: {curr_weather.get('conditionLabel', 'N/A')}, "
                    f"precipitation: {curr_weather.get('precipitationMm', 0.0)} mm, "
                    f"humidity: {curr_weather.get('humidity', 'N/A')}%."
                ),
            }
        else:
            current_conditions_section = {
                "status": "UNAVAILABLE",
                "evidenceType": EvidenceType.UNKNOWN_INSUFFICIENT_DATA.value,
                "summary": "Real-time conditions are unavailable.",
            }

        norm_hist_statements = [
            s.model_dump() if hasattr(s, "model_dump") else s
            for s in historical.get("statements", [])
        ]
        norm_geo_statements = [
            s.model_dump() if hasattr(s, "model_dump") else s
            for s in geospatial.get("statements", [])
        ]
        norm_pred_statements = [
            s.model_dump() if hasattr(s, "model_dump") else s
            for s in prediction.get("statements", [])
        ]

        # Build the 14-Section Final Response Structure (Section 28)
        intensity_display_str = (
            scenario.displayIntensity
            if scenario.intensity is not None and scenario.displayIntensity
            else (f"{scenario.intensity:g} {prediction['effectiveUnit']}" if scenario.intensity is not None else "Unspecified")
        )
        duration_display_str = (
            scenario.displayDuration
            if scenario.displayDuration and scenario.displayDuration != "Unspecified"
            else (scenario.duration or "Unspecified")
        )

        sections_28 = {
            "SCENARIO": {
                "scenarioType": scenario.scenarioType.value,
                "displayName": spec.displayName,
                "intensity": scenario.intensity,
                "displayIntensity": intensity_display_str,
                "effectiveModeledIntensity": scenario.intensity,
                "unit": scenario.unit or (spec.defaultUnit if scenario.intensity is not None else None),
                "duration": duration_display_str,
                "durationValue": scenario.durationValue,
                "durationUnit": scenario.durationUnit,
                "durationHours": scenario.durationHours,
                "durationMinutes": scenario.durationMinutes,
                "durationSeconds": scenario.durationSeconds,
                "targetDate": scenario.targetDate,
                "targetYear": scenario.targetYear,
                "previousYear": scenario.previousYear,
                "radiusKm": scenario.radius,
                "locationSource": scenario.locationSource,
                "isFollowUp": scenario.isFollowUp,
                "missingInformation": scenario.missingInformation,
                "rawQuery": scenario.rawQuery,
            },
            "LOCATION": resolved_loc,
            "HISTORICAL_EVIDENCE": {
                "evidenceType": (
                    EvidenceType.HISTORICAL_EVIDENCE.value
                    if historical.get("status") == "AVAILABLE"
                    else EvidenceType.UNKNOWN_INSUFFICIENT_DATA.value
                ),
                "status": historical.get("status"),
                "dimensionsCompared": historical.get("dimensionsCompared", []),
                "requestedYear": scenario.targetYear,
                "previousYear": scenario.previousYear,
                "historicalYearsAnalyzed": historical.get("historicalYearsAnalyzed", []),
                "yearProjectionContext": historical.get("yearProjectionContext"),
                "statisticalBaseline": historical.get("statisticalBaseline", {}),
                "comparableEventsCount": historical.get("comparableEventsCount", 0),
                "historicalEvents": historical.get("historicalEvents", []),
                "statements": norm_hist_statements,
            },
            "CURRENT_CONDITIONS": current_conditions_section,
            "GEOSPATIAL_SUSCEPTIBILITY": {
                **geospatial,
                "statements": norm_geo_statements,
            },
            "MODEL_DERIVED_PREDICTION": {
                "evidenceType": (
                    EvidenceType.MODEL_DERIVED_PREDICTION.value
                    if scenario.intensity is not None
                    else EvidenceType.UNKNOWN_INSUFFICIENT_DATA.value
                ),
                "severityBand": prediction["severityBand"] if scenario.intensity is not None else "INSUFFICIENT_INTENSITY_PARAMETER",
                "causesSignificantDisruption": prediction["causesSignificantDisruption"] if scenario.intensity is not None else False,
                "environmentalImpact": prediction["environmentalImpact"],
                "populationExposure": prediction["populationExposure"],
                "floodRisk": prediction["floodRiskLabel"],
                "mobilityImpact": prediction["trafficStatusLabel"],
                "statements": norm_pred_statements,
            },
            "FOUR_KEY_FACTORS": prediction["fourFactors"],
            "AFFECTED_LOCATIONS": map_features["affectedAreas"],
            "AFFECTED_INFRASTRUCTURE": {
                "affectedRoads": map_features["affectedRoads"],
                "mappedWaterways": (evidence.get("infrastructure") or {}).get("waterways", []),
            },
            "CONFIDENCE": {
                "overallConfidence": uncertainty.overallConfidence.value,
                "overallConfidenceScore": uncertainty.overallConfidenceScore,
                "rationale": uncertainty.confidenceRationale,
                "byComponent": {k: v.value for k, v in uncertainty.majorPredictionConfidences.items()},
            },
            "ASSUMPTIONS": assumptions_structured,
            "UNCERTAINTY_AND_LIMITATIONS": {
                "predictionUncertainty": uncertainty.predictionUncertainty,
                "dataLimitations": uncertainty.dataLimitations,
                "spatialLimitations": uncertainty.spatialLimitations,
                "temporalLimitations": uncertainty.temporalLimitations,
                "modelLimitations": uncertainty.modelLimitations,
                "missingData": uncertainty.missingData,
            },
            "DATA_SOURCES": evidence.get("retrievedSources", []),
            "REAL_TIME_DATA_NEEDED": uncertainty.recommendedRealtimeInputs,
            "ROLE_RECOMMENDATIONS": prediction.get("roleRecommendations", {}),
        }

        # Build formatted markdown report strictly following Section 28
        formatted_report = cls._build_markdown_report(sections_28, loc_display)

        if scenario.intensity is not None:
            title = (
                f"{spec.displayName}: {intensity_display_str}"
                + (f" ({duration_display_str})" if duration_display_str and duration_display_str != "Unspecified" else "")
                + (f" [{scenario.targetYear}]" if scenario.targetYear else "")
            )
        else:
            title = (
                f"{spec.displayName} (Intensity: Unspecified)"
                + (f" [{scenario.targetYear}]" if scenario.targetYear else "")
            )
        summary_diff = (
            prediction["statements"][0]["statement"]
            if prediction.get("statements")
            else f"{spec.displayName} analyzed for {loc_display}."
        )

        # Ensure affectedDomains includes legacy expectations when legacy scenario types are invoked
        affected_domains = list(spec.affectedDomains)
        if scenario.legacyScenarioType in ("heavy_rainfall", "heavy_rain", "rain", "rainfall_increase", "rainfall"):
            for d in ("FLOOD", "TRAFFIC", "ROADS", "WEATHER"):
                if d not in affected_domains:
                    affected_domains.append(d)
        elif scenario.legacyScenarioType in ("extreme_heat", "temperature_increase", "temperature", "heat_wave"):
            for d in ("WEATHER", "AQI", "SAFETY"):
                if d not in affected_domains:
                    affected_domains.append(d)
        elif scenario.legacyScenarioType in ("road_closure", "major_road_closure", "closure"):
            for d in ("ROADS", "TRAFFIC"):
                if d not in affected_domains:
                    affected_domains.append(d)

        affected_area_km2 = round(3.14159 * (scenario.radius ** 2) * (0.15 if prediction["severityBand"] == "LOW_ROUTINE" else 0.42), 1)
        baseline_score = prediction["baselineScore"]
        simulated_score = prediction["simulatedScore"]
        score_drop = prediction["scoreDrop"]

        return {
            # Core Identity & Strict Simulation / Evidence Grounding Flags
            "scenarioId": f"sim-{int(now_utc.timestamp())}",
            "scenarioName": scenario.legacyScenarioType,
            "scenarioType": scenario.legacyScenarioType if scenario.legacyScenarioType in (
                "heavy_rainfall",
                "road_closure",
                "major_road_closure",
                "traffic_surge",
                "traffic_increase",
                "extreme_heat",
                "aqi_deterioration",
            ) else scenario.scenarioType.value,
            "canonicalScenarioCategory": scenario.scenarioType.value,
            "scenarioTitle": title,
            "scenarioDefinition": scenario.model_dump(),
            "location": resolved_loc,
            "isSimulation": True,
            "label": "SIMULATION",
            "notObservedReality": True,
            # Complete 14-Section Evidence-Grounded Output (Section 28)
            "reportSections": sections_28,
            "formattedReport": formatted_report,
            # Direct Top-Level Accessors for New Generalized Architecture
            "fourKeyFactors": prediction["fourFactors"],
            "historicalComparison": sections_28["HISTORICAL_EVIDENCE"],
            "geospatialSusceptibility": sections_28["GEOSPATIAL_SUSCEPTIBILITY"],
            "affectedAreas": map_features["affectedAreas"],
            "affectedRoads": map_features["affectedRoads"],
            "historicalEvents": map_features["historicalEvents"],
            "mapLayers": map_features["layers"],
            "confidenceLevel": uncertainty.overallConfidence.value,
            "confidence": uncertainty.overallConfidenceScore,
            "confidenceReport": sections_28["CONFIDENCE"],
            "assumptions": assumptions_text_list,
            "assumptionsStructured": assumptions_structured,
            "limitations": limitations_text_list,
            "uncertaintyAndLimitations": sections_28["UNCERTAINTY_AND_LIMITATIONS"],
            "missingData": uncertainty.missingData,
            "recommendedRealtimeInputs": uncertainty.recommendedRealtimeInputs,
            "dataSources": evidence.get("retrievedSources", []),
            "roleRecommendations": prediction.get("roleRecommendations", {}),
            "isHypothetical": True,
            "hypotheticalDisclaimer": (
                "This is a hypothetical earthquake scenario. UrbanPulse does NOT predict the occurrence of earthquakes, cyclones, or extreme disasters."
                if scenario.scenarioType == ScenarioCategory.EARTHQUAKE
                else "This is a hypothetical scenario. UrbanPulse does NOT predict the occurrence of earthquakes, cyclones, or extreme disasters."
            ),
            "situation": scenario.situation,
            "hypotheticalScenario": scenario.scenario or f"HYPOTHETICAL_{scenario.scenarioType.value}",
            "scenarioCategory": scenario.scenarioType.value,
            "dynamicFactors": [f.model_dump() for f in spec.dynamicFactors],
            "requiredTools": list(spec.requiredTools),
            # Backward-Compatible Fields for Existing Frontend & Test Suites
            "baselineScore": baseline_score,
            "baseline": {
                "overallScore": baseline_score,
                "trafficStatus": "MODERATE",
                "floodRisk": "LOW",
                "roadCondition": "NOMINAL",
            },
            "scenario": {
                "overallScore": simulated_score,
                "trafficStatus": prediction["trafficStatusLabel"],
                "floodRisk": prediction["floodRiskLabel"],
                "roadCondition": "POTENTIAL_DISRUPTION" if prediction["causesSignificantDisruption"] else "NOMINAL_WET",
            },
            "scenarioState": {
                "overallScore": simulated_score,
                "trafficStatus": prediction["trafficStatusLabel"],
                "floodRisk": prediction["floodRiskLabel"],
                "roadCondition": "POTENTIAL_DISRUPTION" if prediction["causesSignificantDisruption"] else "NOMINAL_WET",
            },
            "difference": {
                "scoreDelta": -score_drop,
                "trafficDelayIncreasePercent": prediction["trafficDelayIncreasePercent"],
                "speedReductionPercent": prediction["speedReductionPercent"],
                "inundationDepthMeters": prediction["inundationDepthMeters"],
                "summary": summary_diff,
            },
            "affectedDomains": affected_domains,
            "affectedAreaKm2": max(0.5, affected_area_km2),
            "closedRoadPolyline": map_features["closedRoadPolyline"],
            "alternateRoutePolyline": map_features["alternateRoutePolyline"],
            "simulatedAt": now_iso,
            "timestamp": now_iso,
            "impacts": {
                "traffic": {
                    "delayIncreasePercent": prediction["trafficDelayIncreasePercent"],
                    "roadSpeedReductionPercent": prediction["speedReductionPercent"],
                    "status": prediction["trafficStatusLabel"],
                    "description": prediction["trafficStatusLabel"],
                },
                "floodRisk": prediction["floodRiskLabel"],
                "inundationDepthMeters": prediction["inundationDepthMeters"],
                "environmental": prediction["environmentalImpact"],
                "populationExposure": prediction["populationExposure"],
            },
            "uncertaintyInterval": {
                "scoreLow": max(10, simulated_score - 4),
                "scoreHigh": min(100, simulated_score + 4),
                "confidence": uncertainty.overallConfidenceScore,
                "confidenceLevel": uncertainty.overallConfidence.value,
            },
            "urbanPulseScoreImpact": {
                "baselineScore": baseline_score,
                "projectedScore": simulated_score,
                "delta": -score_drop,
            },
            "projectedScoreRange": [max(10, simulated_score - 4), min(100, simulated_score + 4)],
            "projectedTrafficImpact": prediction["trafficStatusLabel"],
            "projectedFloodRisk": prediction["floodRiskLabel"],
        }

    @classmethod
    def _build_markdown_report(cls, s: Dict[str, Any], loc_display: str) -> str:
        scen = s["SCENARIO"]
        hist = s["HISTORICAL_EVIDENCE"]
        curr = s["CURRENT_CONDITIONS"]
        geo = s["GEOSPATIAL_SUSCEPTIBILITY"]
        pred = s["MODEL_DERIVED_PREDICTION"]
        factors = s["FOUR_KEY_FACTORS"]
        areas = s["AFFECTED_LOCATIONS"]
        infra = s["AFFECTED_INFRASTRUCTURE"]
        conf = s["CONFIDENCE"]
        assump = s["ASSUMPTIONS"]
        unc = s["UNCERTAINTY_AND_LIMITATIONS"]
        sources = s["DATA_SOURCES"]
        rt = s["REAL_TIME_DATA_NEEDED"]

        hist_stmts = "\n".join(
            f"- **[{st.get('evidenceType', 'HISTORICAL EVIDENCE')}]** {st.get('statement')}"
            for st in hist.get("statements", [])
        ) or "- **[UNKNOWN / INSUFFICIENT DATA]** Insufficient historical data to produce a reliable comparison."

        geo_stmts = "\n".join(
            f"- **[{st.get('evidenceType', 'CURRENT OBSERVATION')}]** {st.get('statement')}"
            for st in geo.get("statements", [])
        ) or "- **[UNKNOWN / INSUFFICIENT DATA]** Spatial susceptibility layers unavailable."

        pred_stmts = "\n".join(
            f"- **[{st.get('evidenceType', 'MODEL-DERIVED PREDICTION')}]** {st.get('statement')}"
            for st in pred.get("statements", [])
        )

        factor_lines = "\n".join(
            f"{i + 1}. **{f['factorName']}** — `{f['status']}` "
            + (f"(Score: {f['score']}/100) " if f.get("score") is not None else "")
            + f"**[{f['evidenceType']}]** *(Confidence: {f['confidence']})*: {f['explanation']}"
            for i, f in enumerate(factors)
        )

        area_lines = "\n".join(
            f"- **{a['label']}** (`{a['severity']}`, Confidence: `{a['confidence']}`) — **[{a['evidenceType']}]**: {a['impact']}"
            for a in areas
        ) or "- No elevated spatial hazard polygons identified."

        road_lines = "\n".join(
            f"- **{r['roadName']}** ({r['roadClass']}) — `{r['predictedImpact']}` *(Confidence: {r['confidence']})* **[{r['evidenceType']}]**"
            for r in infra.get("affectedRoads", [])
        ) or "- No road segment disruptions identified."

        assump_lines = "\n".join(
            f"- **[ASSUMPTION]** {a['statement']}" for a in assump
        )

        limit_lines = "\n".join(
            f"- {lim}"
            for lim in (
                unc.get("dataLimitations", [])
                + unc.get("spatialLimitations", [])
                + unc.get("temporalLimitations", [])
                + unc.get("modelLimitations", [])
            )
        )

        source_lines = "\n".join(
            f"- **{src['name']}** (`{src['type']}`)" for src in sources
        ) or "- No external feeds retrieved."

        rt_lines = "\n".join(f"- {item}" for item in rt)

        year_line = (
            f"\n- **Requested Projection Year**: {scen['targetYear']} (Previous Year Baseline: {scen['previousYear']}, Historical Window: {', '.join(str(y) for y in hist.get('historicalYearsAnalyzed', []))})"
            if scen.get("targetYear")
            else ""
        )

        role_rec = s.get("ROLE_RECOMMENDATIONS") or {}
        role_lines = ""
        if role_rec:
            cit = role_rec.get("citizen", {})
            cit_items = "\n".join(f"  - {act}" for act in cit.get("recommendedActions", []))
            resp = role_rec.get("emergencyResponder", {})
            resp_items = "\n".join(f"  - {act}" for act in resp.get("operationalPriorities", []))
            muni = role_rec.get("municipalOfficial", {})
            muni_items = "\n".join(f"  - {act}" for act in muni.get("civicProtocols", []))
            plan = role_rec.get("urbanPlanner", {})
            plan_items = "\n".join(f"  - {act}" for act in plan.get("mitigationMeasures", []))

            role_lines = (
                f"\n\n### 15. ROLE-AWARE DECISION SUPPORT\n"
                f"- **Citizen / Resident ({cit.get('posture', 'PROTECTIVE')})**:\n{cit_items}\n"
                f"- **Emergency Responder ({resp.get('readinessLevel', 'ACTIVE')})**:\n{resp_items}\n"
                f"- **Municipal Official ({muni.get('eocActivation', 'ACTIVE')})**:\n{muni_items}\n"
                f"- **Urban Planner & Structural Engineer ({plan.get('focus', 'RESILIENCE')})**:\n{plan_items}"
            )

        eq_disclaimer = ""
        if scen.get("scenarioType") == "EARTHQUAKE":
            eq_disclaimer = (
                f"> [!IMPORTANT]\n"
                f"> **Hypothetical Scenario**: This is a hypothetical earthquake scenario. "
                f"UrbanPulse does NOT predict the occurrence of earthquakes and does not invent earthquake probabilities. "
                f"The analysis models physical consequence vulnerability for {loc_display} assuming ground shaking occurs.\n\n"
            )

        return (
            f"{eq_disclaimer}"
            f"### 1. SCENARIO\n"
            f"- **Category**: `{scen['scenarioType']}` ({scen['displayName']})\n"
            f"- **Intensity**: `{scen['effectiveModeledIntensity']} {scen['unit']}` "
            f"{'(Explicitly Supplied)' if scen['intensity'] is not None else '(Reference Threshold — Not Supplied in Query)'}\n"
            f"- **Duration**: `{scen['duration']}`\n"
            f"- **Radius**: `{scen['radiusKm']} km`{year_line}\n\n"
            f"### 2. LOCATION\n"
            f"- **Resolved Place**: {loc_display}\n"
            f"- **Canonical Coordinates**: `{s['LOCATION'].get('latitude')}, {s['LOCATION'].get('longitude')}`\n"
            f"- **Region / Country**: {s['LOCATION'].get('state') or 'N/A'}, {s['LOCATION'].get('country') or 'N/A'} (Timezone: `{s['LOCATION'].get('timezone', 'UTC')}`)\n\n"
            f"### 3. HISTORICAL EVIDENCE\n"
            f"{hist_stmts}\n\n"
            f"### 4. CURRENT CONDITIONS\n"
            f"- **[{curr['evidenceType']}]** {curr['summary']}\n\n"
            f"### 5. GEOSPATIAL SUSCEPTIBILITY\n"
            f"{geo_stmts}\n\n"
            f"### 6. MODEL-DERIVED PREDICTION\n"
            f"{pred_stmts}\n\n"
            f"### 7. FOUR KEY FACTORS ({scen['scenarioType']})\n"
            f"{factor_lines}\n\n"
            f"### 8. AFFECTED LOCATIONS (Map Layer: Scenario Prediction)\n"
            f"{area_lines}\n\n"
            f"### 9. AFFECTED INFRASTRUCTURE (Map Layer: Scenario Prediction)\n"
            f"{road_lines}\n\n"
            f"### 10. CONFIDENCE\n"
            f"- **Overall Confidence**: **{conf['overallConfidence']}** ({int(conf['overallConfidenceScore'] * 100)}%)\n"
            f"- **Rationale**: {conf['rationale']}\n\n"
            f"### 11. ASSUMPTIONS\n"
            f"{assump_lines}\n\n"
            f"### 12. UNCERTAINTY & LIMITATIONS\n"
            f"- **Prediction Interval**: {unc['predictionUncertainty']}\n"
            f"{limit_lines}\n\n"
            f"### 13. DATA SOURCES\n"
            f"{source_lines}\n\n"
            f"### 14. REAL-TIME DATA NEEDED\n"
            f"{rt_lines}"
            f"{role_lines}"
        )
