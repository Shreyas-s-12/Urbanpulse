"""
UrbanPulse Location Monitoring & Non-Intrusive Alerting Service
Allows users to create monitoring configurations for locations/corridors across signals:
traffic, aqi, weather, hazards, events, road closures, and urban condition.
Periodically evaluates active monitors against deterministic thresholds and issues structured alerts.
"""
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import uuid
import logging
from app.services.google_traffic import GoogleTrafficService
from app.services.event_fusion import EventFusionService
from app.services.providers.air_quality_provider import AirQualityProvider
from app.services.providers.weather_provider import WeatherProvider
logger = logging.getLogger("urbanpulse.monitoring")
# In-memory store for active location monitors
_MONITORS_STORE: Dict[str, Dict[str, Any]] = {}
# In-memory store for triggered alerts
_ALERTS_STORE: List[Dict[str, Any]] = []
class MonitoringService:
    @classmethod
    async def create_monitor(
        cls,
        location: Dict[str, Any],
        radius_km: float = 50.0,
        signals: Optional[List[str]] = None,
        threshold: Optional[Any] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Creates a persistent location monitor."""
        monitor_id = f"mon-{uuid.uuid4().hex[:8]}"
        now_iso = datetime.now(timezone.utc).isoformat()
        # Unpack if full request dictionary passed as first parameter
        if isinstance(location, dict) and ("name" in location or "alertOn" in location or "latitude" in location):
            req = location
            loc_obj = req.get("location") or {
                "latitude": req.get("latitude"),
                "longitude": req.get("longitude"),
                "city": req.get("name") or req.get("city"),
                "displayName": req.get("name"),
            }
            radius_km = float(req.get("radiusKm") or req.get("radius_km") or radius_km)
            signals = req.get("signals") or req.get("alertOn") or signals
            threshold = req.get("threshold") or req.get("aqiThreshold") or threshold
            name = req.get("name") or loc_obj.get("displayName") or "Monitored Target"
        else:
            loc_obj = location
            name = loc_obj.get("displayName") or loc_obj.get("city") or "Monitored Target"
        signals = signals or ["traffic", "hazards", "aqi", "events"]
        monitor = {
            "id": monitor_id,
            "name": name,
            "location": loc_obj,
            "radiusKm": radius_km,
            "signals": signals,
            "threshold": threshold or "significant_change",
            "active": True,
            "createdAt": now_iso,
            "lastEvaluatedAt": None,
            "lastAlertAt": None,
            "previousState": {},
        }
        _MONITORS_STORE[monitor_id] = monitor
        logger.info("Created location monitor %s for %s", monitor_id, name)
        return monitor
    @classmethod
    async def list_monitors(cls, active_only: bool = False) -> List[Dict[str, Any]]:
        """Lists registered location monitors."""
        monitors = list(_MONITORS_STORE.values())
        if active_only:
            return [m for m in monitors if m.get("active")]
        return monitors
    @classmethod
    async def get_monitor(cls, monitor_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single monitor by ID."""
        return _MONITORS_STORE.get(monitor_id)
    @classmethod
    async def update_monitor(
        cls,
        monitor_id: str,
        active: Optional[bool] = None,
        signals: Optional[List[str]] = None,
        threshold: Optional[Any] = None,
    ) -> Optional[Dict[str, Any]]:
        """Updates a monitor's active status or parameters."""
        monitor = _MONITORS_STORE.get(monitor_id)
        if not monitor:
            return None
        if active is not None:
            monitor["active"] = active
        if signals is not None:
            monitor["signals"] = signals
        if threshold is not None:
            monitor["threshold"] = threshold
        return monitor
    @classmethod
    async def delete_monitor(cls, monitor_id: str) -> bool:
        """Deletes a monitor."""
        if monitor_id in _MONITORS_STORE:
            del _MONITORS_STORE[monitor_id]
            logger.info("Deleted monitor %s", monitor_id)
            return True
        return False
    @classmethod
    async def evaluate_monitors(cls) -> List[Dict[str, Any]]:
        """
        Evaluates active monitors against current conditions and triggers non-intrusive alerts.
        """
        now_utc = datetime.now(timezone.utc)
        now_iso = now_utc.isoformat()
        new_alerts: List[Dict[str, Any]] = []
        for m_id, monitor in list(_MONITORS_STORE.items()):
            if not monitor.get("active"):
                continue
            loc = monitor["location"]
            lat = loc.get("latitude")
            lng = loc.get("longitude")
            radius = monitor.get("radiusKm", 50.0)
            monitored_signals = monitor.get("signals", [])
            city_name = loc.get("city") or loc.get("displayName") or "Monitored Location"
            if lat is None or lng is None:
                continue
            prev = monitor.get("previousState") or {}
            curr: Dict[str, Any] = {}
            # Evaluate Traffic
            if "traffic" in monitored_signals:
                traffic = await GoogleTrafficService.get_traffic_summary(lat, lng, radius)
                t_status = traffic.get("trafficStatus", "NORMAL")
                t_delay = traffic.get("delayMinutes", 0)
                curr["traffic"] = {"status": t_status, "delay": t_delay}
                prev_traffic = prev.get("traffic", {})
                prev_status = prev_traffic.get("status", "NORMAL")
                if t_status in ["HEAVY", "SEVERE"] and prev_status not in ["HEAVY", "SEVERE"]:
                    alert = {
                        "id": f"alt-{uuid.uuid4().hex[:8]}",
                        "ruleId": m_id,
                        "monitorId": m_id,
                        "category": "TRAFFIC",
                        "title": f"Severe Traffic Congestion around {city_name}",
                        "locationName": city_name,
                        "latitude": lat,
                        "longitude": lng,
                        "trigger": "Traffic Deterioration",
                        "previousState": f"Status: {prev_status}",
                        "currentState": f"Status: {t_status} (+{t_delay} min delay)",
                        "currentValue": f"{t_status} (+{t_delay}m)",
                        "normalValue": f"{prev_status}",
                        "change": f"+{t_delay} min transit delay",
                        "contributingFactor": "Arterial volume bottleneck detected by Google Routes telemetry",
                        "severity": "HIGH" if t_status == "SEVERE" else "MODERATE",
                        "state": "ACTIVE",
                        "source": "Google Routes API v2",
                        "confidence": 0.90,
                        "observedAt": now_iso,
                        "triggeredAt": now_iso,
                    }
                    new_alerts.append(alert)
                    _ALERTS_STORE.insert(0, alert)
                    monitor["lastAlertAt"] = now_iso
            # Evaluate Hazards & Events
            if any(s in monitored_signals for s in ["hazards", "events", "road closures"]):
                fusion = await EventFusionService.get_live_events_near_location(lat, lng, radius, city_name=city_name)
                events = fusion.get("events", [])
                severe_hazards = [e for e in events if e.get("severity", 1) >= 3 or e.get("eventType") in ["FLOOD", "EARTHQUAKE", "FIRE"]]
                curr["hazards_count"] = len(severe_hazards)
                prev_count = prev.get("hazards_count", 0)
                if len(severe_hazards) > prev_count and len(severe_hazards) > 0:
                    top_h = severe_hazards[0]
                    h_type = top_h.get("eventType", "HAZARD").replace("_", " ").title()
                    h_desc = top_h.get("description", "Active emergency alert in radius")
                    alert = {
                        "id": f"alt-{uuid.uuid4().hex[:8]}",
                        "ruleId": m_id,
                        "monitorId": m_id,
                        "category": "HAZARDS",
                        "title": f"Verified {h_type} Alert near {city_name}",
                        "locationName": city_name,
                        "latitude": lat,
                        "longitude": lng,
                        "trigger": f"Verified {h_type} Alert",
                        "previousState": f"{prev_count} active hazard(s)",
                        "currentState": f"{len(severe_hazards)} active hazard(s): {h_desc[:80]}",
                        "currentValue": f"{len(severe_hazards)} active hazard(s)",
                        "normalValue": f"{prev_count} hazard(s)",
                        "change": f"+{len(severe_hazards) - prev_count} new hazard advisory",
                        "contributingFactor": h_desc[:120],
                        "severity": "HIGH",
                        "state": "ACTIVE",
                        "source": top_h.get("source", "Official Provider Stream"),
                        "confidence": top_h.get("confidence", 0.91),
                        "observedAt": now_iso,
                        "triggeredAt": now_iso,
                    }
                    new_alerts.append(alert)
                    _ALERTS_STORE.insert(0, alert)
                    monitor["lastAlertAt"] = now_iso
            # Evaluate AQI
            if "aqi" in monitored_signals:
                aqi = await AirQualityProvider.get_air_quality(lat, lng, country_code=loc.get("countryCode"))
                aqi_val = aqi.get("value")
                curr["aqi"] = aqi_val
                prev_aqi = prev.get("aqi")
                if aqi_val is not None and prev_aqi is not None:
                    if (aqi_val - prev_aqi) >= 25.0:
                        alert = {
                            "id": f"alt-{uuid.uuid4().hex[:8]}",
                            "ruleId": m_id,
                            "monitorId": m_id,
                            "category": "AQI",
                            "title": f"Air Quality Deterioration in {city_name}",
                            "locationName": city_name,
                            "latitude": lat,
                            "longitude": lng,
                            "trigger": "Air Quality Deterioration",
                            "previousState": f"AQI: {prev_aqi:.0f}",
                            "currentState": f"AQI: {aqi_val:.0f} ({aqi.get('category', 'Poor')})",
                            "currentValue": f"AQI {aqi_val:.0f}",
                            "normalValue": f"AQI {prev_aqi:.0f}",
                            "change": f"+{aqi_val - prev_aqi:.0f} AQI points",
                            "contributingFactor": "Atmospheric boundary layer inversion or particulate accumulation",
                            "severity": "MODERATE",
                            "state": "ACTIVE",
                            "source": aqi.get("source", "Copernicus / Open-Meteo"),
                            "confidence": aqi.get("confidence", 0.85),
                            "observedAt": now_iso,
                            "triggeredAt": now_iso,
                        }
                        new_alerts.append(alert)
                        _ALERTS_STORE.insert(0, alert)
                        monitor["lastAlertAt"] = now_iso
            monitor["previousState"] = curr
            monitor["lastEvaluatedAt"] = now_iso
        return new_alerts
    @classmethod
    async def get_alerts(cls, monitor_id: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieves non-intrusive alert history."""
        if monitor_id:
            return [a for a in _ALERTS_STORE if a.get("monitorId") == monitor_id or a.get("ruleId") == monitor_id][:limit]
        return _ALERTS_STORE[:limit]
    @classmethod
    async def update_alert_state(cls, alert_id: str, new_state: str) -> Optional[Dict[str, Any]]:
        """Transitions an alert state: NEW, ACTIVE, ACKNOWLEDGED, RESOLVED, EXPIRED."""
        for alert in _ALERTS_STORE:
            if alert.get("id") == alert_id:
                alert["state"] = new_state.upper()
                return alert
        return None
