"""
UrbanPulse Deterministic Scenario Simulation Engine
Simulates "what-if" urban disruptions (heavy rainfall, road closures, traffic surges, AQI spikes, extreme heat, floods)
using deterministic physical and heuristic models grounded in current baseline observations.
Strictly labeled as SIMULATION with uncertainty ranges, assumptions, and limitations.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import logging

from app.services.urban_intel import UrbanIntelService
from app.services.providers.geocoding_provider import GeocodingProvider

logger = logging.getLogger("urbanpulse.scenario")


class ScenarioEngineService:
    @classmethod
    async def simulate_scenario(
        cls,
        latitude: Any = None,
        longitude: Optional[float] = None,
        scenario_type: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
        radius_km: float = 50.0,
        location_meta: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Executes a deterministic urban disruption scenario against current baselines.
        Accepts either a single request dictionary or individual positional/keyword arguments.
        """
        # Unpack if dict passed as first argument
        if isinstance(latitude, dict):
            req = latitude
            lat_val = float(req.get("latitude") or 0.0)
            lon_val = float(req.get("longitude") or 0.0)
            s_type_raw = str(req.get("scenarioType") or req.get("scenario_type") or "heavy_rainfall")
            parameters = req.get("parameters") or {}
            radius_km = float(req.get("radiusKm") or req.get("radius_km") or 50.0)
            location_meta = req.get("location_meta") or req.get("locationMeta")
        else:
            lat_val = float(latitude or 0.0)
            lon_val = float(longitude or 0.0)
            s_type_raw = str(scenario_type or "heavy_rainfall")
            parameters = parameters or {}

        now_utc = datetime.now(timezone.utc)
        now_iso = now_utc.isoformat()

        # 1. Resolve Location
        if not location_meta:
            location_meta = await GeocodingProvider.reverse_geocode(lat_val, lon_val)
        city_name = location_meta.get("city") or location_meta.get("displayName") or "Selected Location"

        # 2. Retrieve Current Baseline Conditions
        intel = await UrbanIntelService.get_full_intelligence(lat_val, lon_val, radius_km)
        cond = intel.get("condition", {})
        baseline_score = cond.get("overallScore") or 75

        s_type = s_type_raw.lower().strip()

        # 3. Model Simulation Effects Deterministically
        impacts: Dict[str, Any] = {}
        if s_type in ["heavy_rainfall", "heavy_rain", "rain"]:
            intensity = float(parameters.get("intensity_mm_hr") or parameters.get("intensity_mm_per_hr", 35.0))
            duration_hrs = float(parameters.get("duration_hours") or parameters.get("duration_hrs", 3.0))
            total_rain = intensity * duration_hrs

            # Projected traffic impact
            traffic_surge_min = min(40, round(12.0 + total_rain * 0.18))
            traffic_surge_max = min(60, round(22.0 + total_rain * 0.28))
            speed_reduction = round(15.0 + total_rain * 0.22, 1)
            traffic_impact = f"+{traffic_surge_min}–{traffic_surge_max}% corridor transit delay"

            # Flood risk
            if total_rain >= 80.0:
                flood_risk = "HIGH (Arterial drainage overflow & underpass inundation risk)"
                score_drop = (15, 22)
            elif total_rain >= 40.0:
                flood_risk = "MODERATE (Localized surface water pooling in low-lying intersections)"
                score_drop = (8, 14)
            else:
                flood_risk = "LOW (Transient wet pavement surface deceleration)"
                score_drop = (4, 8)

            title = "Heavy Rainfall Scenario"
            assumptions = [
                f"Simulated precipitation: {intensity:.0f} mm/hr sustained over {duration_hrs:.0f} hours (Total: {total_rain:.0f} mm).",
                "Municipal storm drainage capacity assumes nominal maintenance clearance without active blockages.",
                "Vehicle speed reduction model assumes 18-28% deceleration under heavy downpour conditions.",
            ]
            limitations = [
                "Micro-topographical stormwater accumulation requires localized sub-meter LIDAR elevation maps.",
                "Real-time pump station activation state is unobserved for this jurisdiction.",
            ]
            confidence = 0.68

            impacts = {
                "traffic": {
                    "roadSpeedReductionPercent": speed_reduction,
                    "trafficDelayIncreasePercent": (traffic_surge_min + traffic_surge_max) / 2,
                    "description": traffic_impact,
                },
                "floodRisk": {
                    "inundationDepthMeters": round(total_rain / 1000.0, 2),
                    "description": flood_risk,
                },
            }

        elif s_type in ["major_road_closure", "road_closure", "closure"]:
            corridor = parameters.get("corridor_name") or "Primary Radial Arterial"
            traffic_impact = f"+25–45% delay on adjoining collector corridors due to diverted traffic volume"
            flood_risk = "NONE (Disruption confined to vehicular mobility & transit routing)"
            score_drop = (10, 18)
            title = "Major Road Closure Scenario"
            assumptions = [
                f"Closure applied to central corridor: '{corridor}'.",
                "Traffic rerouting assumes standard alternative collector street capacity without construction bottlenecks.",
            ]
            limitations = ["Dynamic driver diversion compliance varies with real-time navigation GPS penetration."]
            confidence = 0.72
            impacts = {
                "traffic": {
                    "roadSpeedReductionPercent": 30.0,
                    "trafficDelayIncreasePercent": 35.0,
                    "description": traffic_impact,
                },
                "floodRisk": {"description": flood_risk},
            }

        elif s_type in ["traffic_surge", "traffic_increase", "volume_surge"]:
            surge_pct = float(parameters.get("surge_percent", 30.0))
            traffic_impact = f"+{int(surge_pct * 0.9)}–{int(surge_pct * 1.3)}% peak delay across radial network"
            flood_risk = "NONE"
            score_drop = (max(5, int(surge_pct * 0.25)), max(8, int(surge_pct * 0.45)))
            title = "Traffic Volume Surge Scenario"
            assumptions = [f"Simulated {surge_pct:.0f}% uniform vehicular volume increase entering network."]
            limitations = ["Origin-destination distribution shifts during special events are non-uniform."]
            confidence = 0.75
            impacts = {
                "traffic": {
                    "trafficDelayIncreasePercent": surge_pct,
                    "description": traffic_impact,
                },
                "floodRisk": {"description": flood_risk},
            }

        elif s_type in ["aqi_deterioration", "pollution_spike", "smog"]:
            pm25_spike = float(parameters.get("pm25_increase", 50.0))
            traffic_impact = "No direct mobility reduction; outdoor activities and transit stops advisories in effect"
            flood_risk = "NONE"
            score_drop = (max(6, int(pm25_spike * 0.15)), max(12, int(pm25_spike * 0.30)))
            title = "Air Quality Inversion & Deterioration Scenario"
            assumptions = [f"Simulated PM2.5 atmospheric concentration increase of {pm25_spike:.0f} µg/m³."]
            limitations = ["Atmospheric boundary layer height and ventilation coefficient are modeled estimates."]
            confidence = 0.70
            impacts = {
                "airQuality": {
                    "aqiIncreasePoints": round(pm25_spike * 1.5, 1),
                    "description": f"Air quality deterioration (+{pm25_spike} µg/m³ PM2.5)",
                },
                "traffic": {"description": traffic_impact},
                "floodRisk": {"description": flood_risk},
            }

        else:
            title = f"{s_type.replace('_', ' ').title()} Scenario"
            traffic_impact = "+10–20% localized delay"
            flood_risk = "LOW / UNCERTAIN"
            score_drop = (6, 12)
            assumptions = ["Applied standard proportional stress factor to current municipal baseline."]
            limitations = ["Limited historical precedent data for this exact scenario type at these coordinates."]
            confidence = 0.58
            impacts = {
                "traffic": {"roadSpeedReductionPercent": 15.0, "description": traffic_impact},
                "floodRisk": {"description": flood_risk},
            }

        projected_min = max(20, baseline_score - score_drop[1])
        projected_max = max(25, baseline_score - score_drop[0])
        projected_avg = round((projected_min + projected_max) / 2)
        score_delta = projected_avg - baseline_score

        return {
            "scenarioId": f"sim-{int(now_utc.timestamp())}",
            "scenario": s_type,
            "scenarioType": s_type,
            "scenarioTitle": title,
            "location": location_meta,
            "isSimulation": True,
            "label": "SIMULATION",
            "baselineScore": baseline_score,
            "projectedScoreRange": [projected_min, projected_max],
            "uncertaintyInterval": {"min": projected_min, "max": projected_max},
            "projectedTrafficImpact": traffic_impact,
            "projectedFloodRisk": flood_risk,
            "routeImpact": f"Projected travel times across major corridors increase by {traffic_impact}.",
            "impacts": impacts,
            "urbanPulseScoreImpact": {
                "baselineScore": baseline_score,
                "projectedScore": projected_avg,
                "delta": score_delta,
            },
            "confidence": confidence,
            "assumptions": assumptions,
            "limitations": limitations,
            "simulatedAt": now_iso,
            "timestamp": now_iso,
        }
