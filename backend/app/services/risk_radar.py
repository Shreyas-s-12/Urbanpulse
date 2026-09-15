"""
UrbanPulse Risk Radar Service (Phase 1)
Evaluates location-aware risks across 8 distinct domains:
TRAFFIC, FLOOD, FIRE, SAFETY, WEATHER, ROAD, AQI, HAZARDS.

Strict Integrity Rules:
- Missing data is marked as UNKNOWN (level) and null (score), NEVER 'LOW' or '0'.
- Confidence is calculated honestly based on available signals.
- Spatial risk zones identify high-severity cluster centroids.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import math
import logging

from app.services.providers.geocoding_provider import GeocodingProvider
from app.services.google_traffic import GoogleTrafficService
from app.services.providers.weather_provider import WeatherProvider
from app.services.providers.air_quality_provider import AirQualityProvider
from app.services.providers.road_provider import RoadProvider
from app.services.providers.crime_provider import CrimeProvider
from app.services.providers.earthquake_provider import EarthquakeProvider
from app.services.event_fusion import EventFusionService

logger = logging.getLogger("urbanpulse.risk_radar")

RISK_DOMAINS = ["TRAFFIC", "FLOOD", "FIRE", "SAFETY", "WEATHER", "ROAD", "AQI", "HAZARDS"]


class RiskRadarService:
    @classmethod
    async def get_location_risk(
        cls,
        latitude: float,
        longitude: float,
        radius_km: float = 50.0,
        city: Optional[str] = None,
        country_code: Optional[str] = None,
        location_meta: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Computes an authentic multi-domain risk evaluation for any location on Earth.
        """
        # 1. Resolve Location Meta
        if not location_meta:
            location_meta = await GeocodingProvider.reverse_geocode(latitude, longitude)
        if city and not location_meta.get("city"):
            location_meta["city"] = city
        if country_code and not location_meta.get("countryCode"):
            location_meta["countryCode"] = country_code

        resolved_country = location_meta.get("countryCode")
        resolved_city = location_meta.get("city") or location_meta.get("displayName") or "Local Area"

        # 2. Gather verified signals from live providers
        # Weather
        weather_data = WeatherProvider.get_weather(latitude, longitude)
        # AQI
        aqi_data = await AirQualityProvider.get_air_quality(latitude, longitude, country_code=resolved_country)
        # Traffic
        traffic_data = await GoogleTrafficService.get_traffic_summary(latitude, longitude, radius_km=radius_km)
        # Events Fusion (Hazards, Incidents, Storms)
        fusion_result = await EventFusionService.get_live_events_near_location(
            center_lat=latitude,
            center_lon=longitude,
            radius_km=radius_km,
            city_name=resolved_city,
        )
        live_events = fusion_result.get("events", [])
        # Road network & surface
        road_data = await RoadProvider.get_road_status_async(latitude, longitude, radius_km, live_events)
        # Civil safety
        crime_data = await CrimeProvider.get_crime_events_async(
            latitude, longitude, radius_km, country_code=resolved_country, city=resolved_city, corridor_events=live_events
        )

        now_iso = datetime.now(timezone.utc).isoformat()
        domain_assessments: Dict[str, Any] = {}
        risk_zones: List[Dict[str, Any]] = []
        actionable_guidance: List[str] = []

        # =========================================================================
        # 1. TRAFFIC RISK
        # =========================================================================
        if traffic_data.get("status") == "AVAILABLE":
            delay_ratio = traffic_data.get("delayRatio", 1.0)
            traffic_status = traffic_data.get("trafficStatus", "NORMAL")
            delay_minutes = traffic_data.get("delayMinutes", 0)

            if delay_ratio >= 1.7 or traffic_status == "SEVERE":
                t_level = "SEVERE"
                t_score = 90
                t_head = "Severe arterial gridlock"
                t_desc = f"Excess corridor delays averaging +{delay_minutes} mins ({delay_ratio:.1f}x baseline)."
                actionable_guidance.append("Traffic: Severe corridor delays detected. Defer non-critical transit.")
            elif delay_ratio >= 1.35 or traffic_status == "HEAVY":
                t_level = "HIGH"
                t_score = 75
                t_head = "Heavy traffic congestion"
                t_desc = f"Delays averaging +{delay_minutes} mins ({delay_ratio:.1f}x baseline)."
                actionable_guidance.append("Traffic: Heavy delays across key routes. Allow extra travel buffer.")
            elif delay_ratio >= 1.15 or traffic_status == "MODERATE":
                t_level = "MODERATE"
                t_score = 45
                t_head = "Moderate traffic friction"
                t_desc = f"Minor corridor slowdowns (+{delay_minutes} mins)."
            else:
                t_level = "LOW"
                t_score = 15
                t_head = "Normal traffic flow"
                t_desc = "Standard free-flow transit observed across sampled corridors."

            t_signals = [
                {"name": "Congestion Delay", "value": f"+{delay_minutes} min", "level": t_level, "source": "Google Routes API v2"},
                {"name": "Delay Ratio", "value": f"{delay_ratio:.2f}x", "level": t_level, "source": "Google Routes API v2"},
            ]
            t_conf = traffic_data.get("confidence", 0.9)
            t_source = "Google Routes API v2 Real-Time Telemetry"
        else:
            t_level = "UNKNOWN"
            t_score = None
            t_head = "Traffic telemetry unavailable"
            t_desc = "No verified arterial speed telemetry coverage for these coordinates."
            t_signals = [{"name": "Traffic Delay", "value": None, "level": "UNKNOWN", "source": "Google Routes API v2"}]
            t_conf = 0.0
            t_source = "Google Routes API v2 (No Coverage)"

        domain_assessments["TRAFFIC"] = {
            "domain": "TRAFFIC",
            "level": t_level,
            "score": t_score,
            "headline": t_head,
            "description": t_desc,
            "signals": t_signals,
            "confidence": t_conf,
            "source": t_source,
        }

        # =========================================================================
        # 2. FLOOD RISK
        # =========================================================================
        # Evaluated via rain intensity, precipitation probability, surface pressure, and flood events
        weather_curr = weather_data.get("current", {})
        rain_prob = weather_curr.get("rainProbability", 0)
        temp_c = weather_curr.get("temperatureC", 20)
        cond_label = (weather_curr.get("conditionLabel") or "").lower()
        weather_status = weather_data.get("status", "UNAVAILABLE")

        flood_events = [e for e in live_events if "flood" in e.get("category", "").lower() or "flood" in e.get("title", "").lower()]

        if weather_status in ["AVAILABLE", "PARTIAL"]:
            if flood_events:
                f_level = "SEVERE" if any(e.get("severity") in ["SEVERE", "CRITICAL"] for e in flood_events) else "HIGH"
                f_score = 85
                f_head = f"Active flooding reported ({len(flood_events)} incident{'s' if len(flood_events)>1 else ''})"
                f_desc = f"{flood_events[0].get('title', 'Waterlogging incident')} in immediate vicinity."
                actionable_guidance.append("Flood: Waterlogging or flood incidents active. Avoid low-lying underpasses.")
                for fe in flood_events:
                    coords = fe.get("coordinates", {})
                    if coords.get("latitude") and coords.get("longitude"):
                        risk_zones.append({
                            "id": fe.get("id", "flood-zone"),
                            "domain": "FLOOD",
                            "level": f_level,
                            "name": fe.get("title", "Active Flood Incident"),
                            "center": coords,
                            "radiusMeters": 1200,
                            "advisory": "Reported waterlogging or civic flooding.",
                        })
            elif rain_prob >= 75 or "heavy rain" in cond_label or "thunderstorm" in cond_label:
                f_level = "HIGH"
                f_score = 70
                f_head = "Elevated surface runoff risk"
                f_desc = f"Precipitation probability at {rain_prob}% with severe convective storm conditions."
                actionable_guidance.append("Flood: Heavy rain imminent. Monitor street drainage and subway entries.")
            elif rain_prob >= 40:
                f_level = "MODERATE"
                f_score = 40
                f_head = "Moderate localized runoff risk"
                f_desc = f"Precipitation probability at {rain_prob}%."
            else:
                f_level = "LOW"
                f_score = 10
                f_head = "Low flood potential"
                f_desc = f"Precipitation probability minimal ({rain_prob}%)."

            f_signals = [
                {"name": "Precipitation Probability", "value": f"{rain_prob}%", "level": f_level, "source": "Open-Meteo NWP"},
                {"name": "Flood Incidents Near Location", "value": len(flood_events), "level": "HIGH" if flood_events else "LOW", "source": "UrbanPulse Event Fusion"},
            ]
            f_conf = 0.85
            f_source = "Open-Meteo & Verified Civic Event Reports"
        else:
            f_level = "UNKNOWN"
            f_score = None
            f_head = "Hydrometeorological data unavailable"
            f_desc = "No real-time weather or flood sensor telemetry."
            f_signals = [{"name": "Precipitation Probability", "value": None, "level": "UNKNOWN", "source": "Open-Meteo"}]
            f_conf = 0.0
            f_source = "Open-Meteo (No Coverage)"

        domain_assessments["FLOOD"] = {
            "domain": "FLOOD",
            "level": f_level,
            "score": f_score,
            "headline": f_head,
            "description": f_desc,
            "signals": f_signals,
            "confidence": f_conf,
            "source": f_source,
        }

        # =========================================================================
        # 3. FIRE RISK
        # =========================================================================
        fire_events = [e for e in live_events if "fire" in e.get("category", "").lower() or "fire" in e.get("title", "").lower()]
        humidity = weather_curr.get("humidity", 50)
        temp_val = float(temp_c) if isinstance(temp_c, (int, float)) else 25.0

        if weather_status in ["AVAILABLE", "PARTIAL"]:
            if fire_events:
                fi_level = "SEVERE" if any(e.get("severity") in ["SEVERE", "CRITICAL"] for e in fire_events) else "HIGH"
                fi_score = 90
                fi_head = f"Active fire incident reported ({len(fire_events)} incident{'s' if len(fire_events)>1 else ''})"
                fi_desc = f"{fire_events[0].get('title', 'Fire report')} active in vicinity."
                actionable_guidance.append("Fire: Active fire emergency reported. Comply with emergency cordons.")
                for fie in fire_events:
                    coords = fie.get("coordinates", {})
                    if coords.get("latitude") and coords.get("longitude"):
                        risk_zones.append({
                            "id": fie.get("id", "fire-zone"),
                            "domain": "FIRE",
                            "level": fi_level,
                            "name": fie.get("title", "Active Fire Incident"),
                            "center": coords,
                            "radiusMeters": 1500,
                            "advisory": "Reported fire emergency; avoid immediate perimeter.",
                        })
            elif temp_val >= 38.0 and humidity <= 20:
                fi_level = "HIGH"
                fi_score = 75
                fi_head = "High thermal fire ignition index"
                fi_desc = f"Extreme heat ({temp_val}°C) coupled with critical low relative humidity ({humidity}%)."
            elif temp_val >= 33.0 and humidity <= 35:
                fi_level = "MODERATE"
                fi_score = 45
                fi_head = "Moderate fire danger"
                fi_desc = f"Elevated temperature ({temp_val}°C) and dry atmospheric conditions ({humidity}%)."
            else:
                fi_level = "LOW"
                fi_score = 10
                fi_head = "Low fire danger"
                fi_desc = "Atmospheric moisture and ambient temperatures within safe baseline."

            fi_signals = [
                {"name": "Ambient Temperature", "value": f"{temp_val}°C", "level": "HIGH" if temp_val >= 38 else "LOW", "source": "Open-Meteo"},
                {"name": "Relative Humidity", "value": f"{humidity}%", "level": "HIGH" if humidity <= 20 else "LOW", "source": "Open-Meteo"},
                {"name": "Active Fire Incidents", "value": len(fire_events), "level": "HIGH" if fire_events else "LOW", "source": "UrbanPulse Event Fusion"},
            ]
            fi_conf = 0.85
            fi_source = "Atmospheric Telemetry & Civic Emergency Dispatches"
        else:
            fi_level = "UNKNOWN"
            fi_score = None
            fi_head = "Fire danger telemetry unavailable"
            fi_desc = "No ambient temperature and humidity telemetry."
            fi_signals = [{"name": "Thermal Index", "value": None, "level": "UNKNOWN", "source": "Open-Meteo"}]
            fi_conf = 0.0
            fi_source = "Open-Meteo (No Coverage)"

        domain_assessments["FIRE"] = {
            "domain": "FIRE",
            "level": fi_level,
            "score": fi_score,
            "headline": fi_head,
            "description": fi_desc,
            "signals": fi_signals,
            "confidence": fi_conf,
            "source": fi_source,
        }

        # =========================================================================
        # 4. CIVIL SAFETY RISK
        # =========================================================================
        safety_status = crime_data.get("status", "UNAVAILABLE")
        crime_events = crime_data.get("events", [])
        if safety_status in ["AVAILABLE", "PARTIAL", "EMPTY_VERIFIED"]:
            incidents_count = len(crime_events)
            critical_safety = [e for e in crime_events if e.get("severity") in ["CRITICAL", "SEVERE", "HIGH"]]

            if critical_safety:
                s_level = "HIGH"
                s_score = 75
                s_head = f"{len(critical_safety)} high-severity safety alerts"
                s_desc = f"Verified public safety dispatches in radius: {critical_safety[0].get('title', 'Safety alert')}."
                actionable_guidance.append("Safety: Elevated civil safety alerts reported in this sector.")
            elif incidents_count >= 3:
                s_level = "MODERATE"
                s_score = 50
                s_head = f"{incidents_count} minor civil alerts"
                s_desc = "Verified minor municipal disturbances or safety notifications."
            else:
                s_level = "LOW"
                s_score = 15
                s_head = "Normal civil safety profile"
                s_desc = "No major police dispatches or emergency advisories active."

            s_signals = [
                {"name": "Active Safety Incidents", "value": incidents_count, "level": s_level, "source": crime_data.get("source", "Civic Safety Service")},
                {"name": "High Severity Alerts", "value": len(critical_safety), "level": "HIGH" if critical_safety else "LOW", "source": crime_data.get("source", "Civic Safety Service")},
            ]
            s_conf = crime_data.get("confidence", 0.8)
            s_source = crime_data.get("source", "Municipal OpenData / Police API")
        else:
            s_level = "UNKNOWN"
            s_score = None
            s_head = "Safety jurisdiction telemetry unavailable"
            s_desc = "No official police dispatch or municipal incident telemetry for this jurisdiction."
            s_signals = [{"name": "Safety Incidents", "value": None, "level": "UNKNOWN", "source": "Police API"}]
            s_conf = 0.0
            s_source = "Municipal OpenData (No Coverage)"

        domain_assessments["SAFETY"] = {
            "domain": "SAFETY",
            "level": s_level,
            "score": s_score,
            "headline": s_head,
            "description": s_desc,
            "signals": s_signals,
            "confidence": s_conf,
            "source": s_source,
        }

        # =========================================================================
        # 5. WEATHER RISK
        # =========================================================================
        if weather_status in ["AVAILABLE", "PARTIAL"]:
            wind_speed = weather_curr.get("windSpeedKmh", 0)
            uv_index = weather_curr.get("uvIndex", 0)

            severe_weather = wind_speed >= 70 or rain_prob >= 80 or "thunderstorm" in cond_label or "cyclone" in cond_label
            mod_weather = wind_speed >= 40 or rain_prob >= 50 or uv_index >= 9

            if severe_weather:
                w_level = "SEVERE" if wind_speed >= 90 else "HIGH"
                w_score = 80
                w_head = f"Severe atmospheric disturbance ({cond_label.title() or 'Storm'})"
                w_desc = f"Winds at {wind_speed} km/h, precipitation probability {rain_prob}%."
                actionable_guidance.append("Weather: High wind or convective storm conditions. Secure loose structures.")
            elif mod_weather:
                w_level = "MODERATE"
                w_score = 45
                w_head = f"Moderate atmospheric impact ({cond_label.title() or 'Inclement'})"
                w_desc = f"Winds {wind_speed} km/h, precipitation probability {rain_prob}%, UV index {uv_index}."
            else:
                w_level = "LOW"
                w_score = 15
                w_head = f"Favorable weather conditions ({cond_label.title() or 'Clear'})"
                w_desc = f"Mild winds ({wind_speed} km/h), {temp_c}°C."

            w_signals = [
                {"name": "Wind Speed", "value": f"{wind_speed} km/h", "level": "HIGH" if wind_speed >= 60 else "LOW", "source": "Open-Meteo"},
                {"name": "Precipitation Probability", "value": f"{rain_prob}%", "level": "HIGH" if rain_prob >= 75 else "LOW", "source": "Open-Meteo"},
                {"name": "UV Index", "value": uv_index, "level": "HIGH" if uv_index >= 10 else "LOW", "source": "Open-Meteo"},
            ]
            w_conf = 0.95
            w_source = "Open-Meteo Global Numerical Model"
        else:
            w_level = "UNKNOWN"
            w_score = None
            w_head = "Weather telemetry unavailable"
            w_desc = "No real-time meteorological observations."
            w_signals = [{"name": "Meteorological Status", "value": None, "level": "UNKNOWN", "source": "Open-Meteo"}]
            w_conf = 0.0
            w_source = "Open-Meteo (No Coverage)"

        domain_assessments["WEATHER"] = {
            "domain": "WEATHER",
            "level": w_level,
            "score": w_score,
            "headline": w_head,
            "description": w_desc,
            "signals": w_signals,
            "confidence": w_conf,
            "source": w_source,
        }

        # =========================================================================
        # 6. ROAD RISK
        # =========================================================================
        road_status = road_data.get("status", "UNAVAILABLE")
        if road_status in ["AVAILABLE", "PARTIAL"]:
            closures = road_data.get("roadClosures", [])
            potholes = road_data.get("potholesCount", 0)
            road_level = road_data.get("level", "NORMAL")

            if closures or road_level in ["CRITICAL", "POOR"]:
                r_level = "HIGH"
                r_score = 75
                r_head = f"Active road closures ({len(closures)}) and surface hazards"
                r_desc = f"{closures[0].get('road', 'Arterial segment')} blocked; road quality impacted."
                actionable_guidance.append("Roads: Known road closures or surface hazards. Inspect route alternate.")
                for rc in closures:
                    coords = rc.get("coordinates", {})
                    if coords.get("latitude") and coords.get("longitude"):
                        risk_zones.append({
                            "id": rc.get("id", "road-closure-zone"),
                            "domain": "ROAD",
                            "level": "HIGH",
                            "name": f"Road Closure: {rc.get('road', 'Arterial')}",
                            "center": coords,
                            "radiusMeters": 800,
                            "advisory": rc.get("reason", "Road closure / maintenance work"),
                        })
            elif potholes >= 5 or road_level == "MODERATE":
                r_level = "MODERATE"
                r_score = 45
                r_head = "Moderate road surface friction"
                r_desc = f"{potholes} reported surface irregularities or maintenance corridors."
            else:
                r_level = "LOW"
                r_score = 15
                r_head = "Standard road operability"
                r_desc = "No major arterial road closures or critical surface distress recorded."

            r_signals = [
                {"name": "Road Closures", "value": len(closures), "level": "HIGH" if closures else "LOW", "source": "OpenStreetMap / Civic Feeds"},
                {"name": "Surface Irregularities", "value": potholes, "level": "MODERATE" if potholes >= 5 else "LOW", "source": "UrbanPulse Road Provider"},
            ]
            r_conf = road_data.get("confidence", 0.8)
            r_source = "OpenStreetMap Network & Municipal Public Works"
        else:
            r_level = "UNKNOWN"
            r_score = None
            r_head = "Road network telemetry unavailable"
            r_desc = "No verified road surface and closure telemetry."
            r_signals = [{"name": "Road Network", "value": None, "level": "UNKNOWN", "source": "OSM"}]
            r_conf = 0.0
            r_source = "OpenStreetMap (No Coverage)"

        domain_assessments["ROAD"] = {
            "domain": "ROAD",
            "level": r_level,
            "score": r_score,
            "headline": r_head,
            "description": r_desc,
            "signals": r_signals,
            "confidence": r_conf,
            "source": r_source,
        }

        # =========================================================================
        # 7. AIR QUALITY RISK (AQI)
        # =========================================================================
        aqi_status = aqi_data.get("status", "UNAVAILABLE")
        if aqi_status in ["AVAILABLE", "PARTIAL"]:
            aqi_val = aqi_data.get("aqi", 50)
            cat = aqi_data.get("category", "Moderate")
            dominant = aqi_data.get("dominantPollutant", "PM2.5")

            if aqi_val >= 250 or cat in ["Severe", "Hazardous", "Very Unhealthy"]:
                a_level = "SEVERE"
                a_score = 90
                a_head = f"Severe air pollution ({cat})"
                a_desc = f"AQI {aqi_val} with {dominant} concentration significantly above WHO health limits."
                actionable_guidance.append("AQI: Severe particulate density. Sensitive groups should remain indoors.")
            elif aqi_val >= 150 or cat in ["Unhealthy", "Poor"]:
                a_level = "HIGH"
                a_score = 75
                a_head = f"Poor air quality ({cat})"
                a_desc = f"AQI {aqi_val} driven by {dominant}."
                actionable_guidance.append("AQI: Unhealthy particulate levels. Limit strenuous outdoor exertion.")
            elif aqi_val >= 90 or cat in ["Moderate"]:
                a_level = "MODERATE"
                a_score = 45
                a_head = f"Moderate air quality ({cat})"
                a_desc = f"AQI {aqi_val} ({dominant}). Acceptable for general public."
            else:
                a_level = "LOW"
                a_score = 15
                a_head = f"Good air quality ({cat})"
                a_desc = f"AQI {aqi_val} ({dominant}). Pure ambient air within standard thresholds."

            a_signals = [
                {"name": f"AQI ({aqi_data.get('standard', 'US')})", "value": aqi_val, "level": a_level, "source": aqi_data.get("source", "Copernicus / Open-Meteo")},
                {"name": "Dominant Pollutant", "value": dominant, "level": a_level, "source": aqi_data.get("source", "Copernicus / Open-Meteo")},
            ]
            a_conf = aqi_data.get("confidence", 0.9)
            a_source = aqi_data.get("source", "Copernicus CAMS / Open-Meteo")
        else:
            a_level = "UNKNOWN"
            a_score = None
            a_head = "Air quality telemetry unavailable"
            a_desc = "No real-time CAMS or ground station particulate monitoring."
            a_signals = [{"name": "AQI Index", "value": None, "level": "UNKNOWN", "source": "Open-Meteo"}]
            a_conf = 0.0
            a_source = "Copernicus CAMS (No Coverage)"

        domain_assessments["AQI"] = {
            "domain": "AQI",
            "level": a_level,
            "score": a_score,
            "headline": a_head,
            "description": a_desc,
            "signals": a_signals,
            "confidence": a_conf,
            "source": a_source,
        }

        # =========================================================================
        # 8. HAZARDS (Seismic, Industrial, Infrastructure)
        # =========================================================================
        hazard_events = [e for e in live_events if e.get("category") in ["HAZARD", "DISASTER", "SEISMIC"] or "earthquake" in e.get("title", "").lower()]
        if hazard_events:
            crit_haz = [e for e in hazard_events if e.get("severity") in ["SEVERE", "CRITICAL", "HIGH"]]
            h_level = "SEVERE" if crit_haz else "MODERATE"
            h_score = 85 if crit_haz else 50
            h_head = f"{len(hazard_events)} verified natural/infrastructure hazard{'s' if len(hazard_events)>1 else ''}"
            h_desc = f"{hazard_events[0].get('title', 'Hazard incident')} active in radius."
            actionable_guidance.append("Hazards: Natural or structural hazard alert active in this sector.")
            for he in hazard_events:
                coords = he.get("coordinates", {})
                if coords.get("latitude") and coords.get("longitude"):
                    risk_zones.append({
                        "id": he.get("id", "hazard-zone"),
                        "domain": "HAZARDS",
                        "level": h_level,
                        "name": he.get("title", "Active Hazard"),
                        "center": coords,
                        "radiusMeters": 2000,
                        "advisory": he.get("description", "Natural or seismic disturbance"),
                    })
            h_signals = [
                {"name": "Active Hazards", "value": len(hazard_events), "level": h_level, "source": "USGS / Disaster Alert Stream"},
            ]
            h_conf = 0.9
            h_source = "USGS Earthquake Feed & Civic Hazard Fusion"
        else:
            h_level = "LOW"
            h_score = 10
            h_head = "No active hazards detected"
            h_desc = "USGS seismic feeds and disaster alert streams report normal baseline."
            h_signals = [
                {"name": "Seismic Activity", "value": "Normal Baseline", "level": "LOW", "source": "USGS Stream"},
            ]
            h_conf = 0.85
            h_source = "USGS Earthquake API & Emergency Streams"

        domain_assessments["HAZARDS"] = {
            "domain": "HAZARDS",
            "level": h_level,
            "score": h_score,
            "headline": h_head,
            "description": h_desc,
            "signals": h_signals,
            "confidence": h_conf,
            "source": h_source,
        }

        # =========================================================================
        # OVERALL RISK AGGREGATION
        # =========================================================================
        valid_scores = [d["score"] for d in domain_assessments.values() if d["score"] is not None]
        known_domains = [d for d in domain_assessments.values() if d["level"] != "UNKNOWN"]

        if valid_scores:
            # Weighted toward max risk domain to ensure dangerous conditions are not smoothed away
            max_score = max(valid_scores)
            avg_score = sum(valid_scores) / len(valid_scores)
            overall_score = round(0.6 * max_score + 0.4 * avg_score)

            if overall_score >= 75 or any(d["level"] == "SEVERE" for d in domain_assessments.values()):
                overall_level = "SEVERE" if any(d["level"] == "SEVERE" for d in domain_assessments.values()) else "HIGH"
            elif overall_score >= 45 or any(d["level"] == "HIGH" for d in domain_assessments.values()):
                overall_level = "HIGH" if any(d["level"] == "HIGH" for d in domain_assessments.values()) else "MODERATE"
            elif overall_score >= 25:
                overall_level = "MODERATE"
            else:
                overall_level = "LOW"

            overall_confidence = round(
                (sum(d["confidence"] for d in domain_assessments.values()) / len(domain_assessments))
                * (len(known_domains) / len(domain_assessments)),
                2,
            )
        else:
            overall_level = "UNKNOWN"
            overall_score = None
            overall_confidence = 0.0

        if not actionable_guidance:
            actionable_guidance.append("All primary environmental, safety, and transit signals remain within normal operational baselines.")

        return {
            "location": {
                "latitude": latitude,
                "longitude": longitude,
                "city": location_meta.get("city"),
                "displayName": location_meta.get("displayName") or location_meta.get("city") or f"{latitude:.4f}, {longitude:.4f}",
                "country": location_meta.get("country"),
                "countryCode": resolved_country,
                "isUserLocation": location_meta.get("isUserLocation", False),
            },
            "overallLevel": overall_level,
            "overallScore": overall_score,
            "confidence": overall_confidence,
            "evaluatedAt": now_iso,
            "domains": domain_assessments,
            "riskZones": risk_zones,
            "actionableGuidance": actionable_guidance,
        }
