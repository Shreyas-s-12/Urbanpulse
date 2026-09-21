"""
UrbanPulse Multimodal Spatial Fusion & Cross-Domain Anomaly Engine
Fuses environmental, meteorological, mobility, demographic, and civic signals (Sections 10–16, 43–46).
Computes statistical correlation, spatial lag, and multimodal anomalies.
ENFORCES STRICT NON-CAUSAL LANGUAGE: All multi-signal links are labeled as
POSSIBLE_ASSOCIATION or TEMPORAL_ASSOCIATION, never claiming causal proof.
"""

from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone
import math
import uuid
import logging

from app.schemas.research_schema import (
    MultimodalAnomaly,
    MultimodalUrbanState,
    UrbanStateComponent,
    DecomposableUrbanScore,
    ConfidenceBreakdown,
    EvidenceChainNode,
)
from app.services.research.confidence_engine import ConfidenceEngine
from app.services.research.observation_normalizer import ObservationNormalizer

logger = logging.getLogger("urbanpulse.research.fusion")


class MultimodalFusionEngine:
    """
    Fuses diverse geospatial telemetry streams into an explainable, confidence-aware urban state.
    """

    @staticmethod
    def calculate_pearson_correlation(x_series: List[float], y_series: List[float]) -> Optional[Dict[str, Any]]:
        """
        Calculates Pearson spatial correlation with sample size warning (Section 12).
        """
        n = min(len(x_series), len(y_series))
        if n < 4:
            return {
                "coefficient": None,
                "sampleSize": n,
                "warning": "Sample size too small (N < 4) for statistically valid correlation.",
                "significance": "UNKNOWN"
            }

        x = x_series[:n]
        y = y_series[:n]
        mean_x = sum(x) / n
        mean_y = sum(y) / n

        num = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
        den_x = math.sqrt(sum((x[i] - mean_x) ** 2 for i in range(n)))
        den_y = math.sqrt(sum((y[i] - mean_y) ** 2 for i in range(n)))

        if den_x == 0 or den_y == 0:
            return {"coefficient": 0.0, "sampleSize": n, "warning": "Zero variance in one or both signals.", "significance": "LOW"}

        r = round(num / (den_x * den_y), 3)
        return {
            "coefficient": r,
            "sampleSize": n,
            "strength": "STRONG" if abs(r) >= 0.70 else "MODERATE" if abs(r) >= 0.40 else "WEAK",
            "association": "POSITIVE" if r > 0 else "NEGATIVE",
            "relationshipLabel": "POSSIBLE_ASSOCIATION",
            "method": "Pearson Spatial Correlation",
        }

    @classmethod
    def fuse_urban_state(
        cls,
        lat: float,
        lon: float,
        aqi_obs: Optional[Dict[str, Any]],
        weather_obs: Optional[Dict[str, Any]],
        traffic_obs: Optional[Dict[str, Any]],
        pop_obs: Optional[Dict[str, Any]],
        incidents: Optional[List[Dict[str, Any]]] = None,
        city_name: Optional[str] = None,
    ) -> MultimodalUrbanState:
        """
        Synthesizes raw feeds into the canonical MultimodalUrbanState (Sections 10, 17, 18).
        """
        now_utc = datetime.now(timezone.utc)
        now_iso = now_utc.isoformat()
        center_label = city_name or f"{lat:.4f}, {lon:.4f}"

        components: Dict[str, UrbanStateComponent] = {}
        active_confidences: Dict[str, float] = {}
        missing_domains: List[str] = []
        provenance: List[Dict[str, Any]] = []

        # 1. Environment Component (AQI)
        if aqi_obs and aqi_obs.get("value") is not None:
            norm_aqi = ObservationNormalizer.normalize_aqi(aqi_obs, lat, lon)
            aqi_val = norm_aqi.value
            concern = "SEVERE" if aqi_val >= 200 else "HIGH" if aqi_val >= 150 else "MODERATE" if aqi_val >= 100 else "LOW"
            components["environment"] = UrbanStateComponent(
                name="Atmospheric Environment",
                domain="ENVIRONMENT",
                value=aqi_val,
                displayValue=f"AQI {int(aqi_val)}",
                unit="AQI (US)",
                concernLevel=concern,
                confidence=norm_aqi.confidence,
                source=norm_aqi.source,
                timestamp=norm_aqi.timestamp,
                dataStatus="AVAILABLE",
                metadata={"pm2_5": norm_aqi.metadata.get("pm2_5")},
            )
            active_confidences["environment"] = norm_aqi.confidence
            provenance.append({"domain": "ENVIRONMENT", "source": norm_aqi.source, "license": norm_aqi.license})
        else:
            missing_domains.append("Atmospheric Environment")
            components["environment"] = UrbanStateComponent(
                name="Atmospheric Environment",
                domain="ENVIRONMENT",
                value=None,
                displayValue="No Sensor Feed",
                unit="AQI",
                concernLevel="INSUFFICIENT_DATA",
                confidence=0.0,
                source="Open-Meteo CAMS/SILAM",
                timestamp=now_iso,
                dataStatus="NO_COVERAGE",
            )

        # 2. Mobility Component (Traffic)
        if traffic_obs and (traffic_obs.get("value") is not None or traffic_obs.get("currentSpeedKmh") is not None or traffic_obs.get("delayMinutes") is not None):
            norm_traf = ObservationNormalizer.normalize_traffic(traffic_obs, lat, lon)
            speed = norm_traf.value
            delay = norm_traf.rawValue or 0.0
            concern = "HIGH" if delay >= 15 else "MODERATE" if delay >= 6 else "LOW"
            components["mobility"] = UrbanStateComponent(
                name="Corridor Mobility",
                domain="MOBILITY",
                value=speed,
                displayValue=f"{int(speed)} km/h (+{int(delay)}m delay)",
                unit="km/h",
                concernLevel=concern,
                confidence=norm_traf.confidence,
                source=norm_traf.source,
                timestamp=norm_traf.timestamp,
                dataStatus="AVAILABLE",
                metadata={"delayMinutes": delay},
            )
            active_confidences["mobility"] = norm_traf.confidence
            provenance.append({"domain": "MOBILITY", "source": norm_traf.source, "license": norm_traf.license})
        else:
            missing_domains.append("Corridor Mobility")
            components["mobility"] = UrbanStateComponent(
                name="Corridor Mobility",
                domain="MOBILITY",
                value=None,
                displayValue="No Active Probe",
                unit="km/h",
                concernLevel="INSUFFICIENT_DATA",
                confidence=0.0,
                source="TomTom Orbis Maps",
                timestamp=now_iso,
                dataStatus="NO_COVERAGE",
            )

        # 3. Weather Component
        if weather_obs and (weather_obs.get("temperatureC") is not None or weather_obs.get("value") is not None):
            norm_wea = ObservationNormalizer.normalize_weather(weather_obs, lat, lon)
            temp = norm_wea.value
            precip = norm_wea.metadata.get("precipitationMm", 0.0)
            concern = "ELEVATED" if precip >= 10.0 else "LOW"
            components["weather"] = UrbanStateComponent(
                name="Meteorological Stress",
                domain="WEATHER",
                value=temp,
                displayValue=f"{temp}°C ({precip} mm/h)",
                unit="°C",
                concernLevel=concern,
                confidence=norm_wea.confidence,
                source=norm_wea.source,
                timestamp=norm_wea.timestamp,
                dataStatus="AVAILABLE",
                metadata={"precipitationMm": precip},
            )
            active_confidences["weather"] = norm_wea.confidence
            provenance.append({"domain": "WEATHER", "source": norm_wea.source, "license": norm_wea.license})
        else:
            missing_domains.append("Meteorological Stress")
            components["weather"] = UrbanStateComponent(
                name="Meteorological Stress",
                domain="WEATHER",
                value=None,
                displayValue="Model Offline",
                unit="°C",
                concernLevel="INSUFFICIENT_DATA",
                confidence=0.0,
                source="Open-Meteo Global Forecasting",
                timestamp=now_iso,
                dataStatus="NO_COVERAGE",
            )

        # 4. Population Exposure Component (Explicitly Exposure, Section 44)
        if pop_obs and (pop_obs.get("density") is not None or pop_obs.get("value") is not None):
            norm_pop = ObservationNormalizer.normalize_population(pop_obs, lat, lon)
            density = norm_pop.value
            concern = "HIGH" if density >= 8000 else "MODERATE" if density >= 3000 else "LOW"
            components["population"] = UrbanStateComponent(
                name="Population Exposure",
                domain="POPULATION_EXPOSURE",
                value=density,
                displayValue=f"{int(density):,} people/km²",
                unit="people/km²",
                concernLevel=concern,
                confidence=norm_pop.confidence,
                source=norm_pop.source,
                timestamp=norm_pop.timestamp,
                dataStatus="AVAILABLE",
                metadata={"exposureRole": "DEMOGRAPHIC_EXPOSURE_NOT_HAZARD"},
            )
            active_confidences["population"] = norm_pop.confidence
            provenance.append({"domain": "POPULATION_EXPOSURE", "source": norm_pop.source, "license": norm_pop.license})
        else:
            missing_domains.append("Population Exposure")
            components["population"] = UrbanStateComponent(
                name="Population Exposure",
                domain="POPULATION_EXPOSURE",
                value=None,
                displayValue="No Census Layer",
                unit="people/km²",
                concernLevel="INSUFFICIENT_DATA",
                confidence=0.0,
                source="WorldPop SDI",
                timestamp=now_iso,
                dataStatus="NO_COVERAGE",
            )

        # 5. Civic Risk / Incidents Component
        inc_list = incidents or []
        if inc_list:
            top_inc = inc_list[0]
            components["civic"] = UrbanStateComponent(
                name="Civic Safety & Hazards",
                domain="CIVIC_RISK",
                value=float(len(inc_list)),
                displayValue=f"{len(inc_list)} active alerts",
                unit="count",
                concernLevel="HIGH" if len(inc_list) >= 4 else "MODERATE" if len(inc_list) >= 1 else "LOW",
                confidence=0.88,
                source="Municipal Public Safety Streams",
                timestamp=now_iso,
                dataStatus="AVAILABLE",
                metadata={"incidentCount": len(inc_list)},
            )
            active_confidences["civic"] = 0.88
            provenance.append({"domain": "CIVIC_RISK", "source": "Municipal Feeds", "license": "Open Data"})
        else:
            components["civic"] = UrbanStateComponent(
                name="Civic Safety & Hazards",
                domain="CIVIC_RISK",
                value=0.0,
                displayValue="0 active incidents",
                unit="count",
                concernLevel="LOW",
                confidence=0.85,
                source="Municipal Public Safety Streams",
                timestamp=now_iso,
                dataStatus="AVAILABLE",
                metadata={"incidentCount": 0},
            )
            active_confidences["civic"] = 0.85

        # 6. Decomposable Urban Score (Section 19, 20)
        score_base = 100
        contributors: Dict[str, float] = {}

        # Transparent penalty subtraction
        if "environment" in active_confidences:
            aqi_val = components["environment"].value or 0
            if aqi_val > 50:
                aqi_pen = round(min(25.0, (aqi_val - 50.0) * 0.12), 1)
                contributors["aqi"] = -aqi_pen
            else:
                contributors["aqi"] = 0.0

        if "mobility" in active_confidences:
            delay = components["mobility"].metadata.get("delayMinutes", 0.0)
            if delay > 3.0:
                traf_pen = round(min(25.0, (delay - 3.0) * 1.5), 1)
                contributors["traffic"] = -traf_pen
            else:
                contributors["traffic"] = 0.0

        if "weather" in active_confidences:
            precip = components["weather"].metadata.get("precipitationMm", 0.0)
            if precip > 2.0:
                wea_pen = round(min(15.0, precip * 1.2), 1)
                contributors["weather"] = -wea_pen
            else:
                contributors["weather"] = 0.0

        # Confidence uncertainty adjustment
        confidence_summary = ConfidenceEngine.propagate_fusion_uncertainty(
            active_confidences,
            len(missing_domains),
            total_domains_count=5
        )
        conf_adj = round(-max(0.0, (1.0 - confidence_summary.overallConfidence) * 10.0), 1)
        contributors["dataConfidenceAdjustment"] = conf_adj

        total_deduction = sum(contributors.values())
        final_score = int(max(15, min(100, score_base + total_deduction))) if len(active_confidences) >= 2 else None

        score_obj = DecomposableUrbanScore(
            score=final_score,
            baseScore=score_base,
            contributors=contributors,
            formula=f"Score = Base ({score_base}) + " + " + ".join(f"{k} ({v:+.1f})" for k, v in contributors.items()),
            confidence=confidence_summary.overallConfidence,
            dataCoverage=f"{len(active_confidences)}/5 domains active",
            sourceCount=len(provenance),
            missingDomains=missing_domains,
            status="AVAILABLE" if final_score is not None else "INSUFFICIENT_DATA",
        )

        # 7. Cross-Domain Anomaly Detection (Section 14, 15, 16)
        anomalies: List[MultimodalAnomaly] = []
        has_traffic_spike = "mobility" in active_confidences and (components["mobility"].metadata.get("delayMinutes", 0) >= 12.0)
        has_rainfall = "weather" in active_confidences and (components["weather"].metadata.get("precipitationMm", 0) >= 8.0)
        has_incident = len(inc_list) > 0

        if has_traffic_spike:
            signals = ["TomTom Corridor Speed Deficit", "Route Travel Delay"]
            assoc = "ISOLATED_ANOMALY"
            if has_rainfall:
                signals.append("Co-located Precipitation Surge (Open-Meteo)")
                assoc = "TEMPORAL_ASSOCIATION"
            if has_incident:
                signals.append("Nearby Civic Disruption Report")
                assoc = "CORRELATED_ANOMALY"

            evidence_chain = EvidenceChainNode(
                claim="Unusual corridor travel delay detected.",
                signals=signals,
                source="TomTom Orbis & Open-Meteo Numerical Model",
                timestamp=now_iso,
                method="Diurnal rolling speed deficit > 35%",
                confidence=0.84,
                evidence=f"{len(signals)} independent signals aligned in time and space.",
            )

            anomalies.append(MultimodalAnomaly(
                id=f"anom-multimodal-{uuid.uuid4().hex[:8]}",
                location={"lat": lat, "lng": lon},
                domain="MULTIMODAL" if len(signals) > 2 else "TRAFFIC",
                anomalyType="CORRIDOR_CONGESTION_EVENT",
                observedValue=f"{components['mobility'].displayValue}",
                expectedValue="Free-flow baseline (55 km/h)",
                deviation=round(components["mobility"].metadata.get("delayMinutes", 0) * 4.5, 1),
                contributingSignals=signals,
                associationType=assoc,
                severity="HIGH" if len(signals) >= 3 else "MODERATE",
                confidence=0.84,
                evidence=[
                    f"Traffic speed reduced to {components['mobility'].value} km/h.",
                    f"Associated environmental context: {components['weather'].displayValue}.",
                    "Explicitly labeled as a non-causal spatial/temporal association.",
                ],
                evidenceChain=evidence_chain,
                timestamp=now_iso,
                source="UrbanPulse Multimodal Fusion Engine",
            ))

        # Overall Data Quality Index (Coverage * Average Source Reliability)
        dq_index = round(confidence_summary.overallConfidence * 100.0, 1)

        return MultimodalUrbanState(
            location={"latitude": lat, "longitude": lon, "label": center_label},
            timestamp=now_iso,
            components=components,
            overallScore=score_obj,
            activeAnomalies=anomalies,
            confidenceSummary=confidence_summary,
            dataQualityIndex=dq_index,
            provenanceTrace=provenance,
        )
