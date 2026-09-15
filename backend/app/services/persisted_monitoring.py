"""Persisted monitoring service using async SQLAlchemy.

This replaces the in‑memory version with database‑backed monitors and alerts.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.monitor import Monitor
from ..models.alert import Alert, AlertSeverity
from ..services.significance_engine import SignificanceEngine
from ..services.alert_engine import AlertEngine
from ..services.google_traffic import GoogleTrafficService
from ..services.event_fusion import EventFusionService
from ..services.providers.air_quality_provider import AirQualityProvider

logger = logging.getLogger("urbanpulse.persisted_monitoring")


def _to_uuid(val: Any) -> Any:
    if isinstance(val, str):
        try:
            return uuid.UUID(val)
        except Exception:
            return val
    return val

def _monitor_to_dict(m: Monitor) -> Dict[str, Any]:
    return {
        "id": str(m.id),
        "user_id": str(m.user_id),
        "name": m.name,
        "criteria": m.criteria,
        "is_active": m.is_active,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }

def _alert_to_dict(a: Alert) -> Dict[str, Any]:
    return {
        "id": str(a.id),
        "monitor_id": str(a.monitor_id),
        "severity": a.severity.value if hasattr(a.severity, "value") else str(a.severity),
        "title": a.title,
        "description": a.description,
        "payload": a.payload,
        "is_active": a.is_active,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }

class PersistedMonitoringService:
    @staticmethod
    async def create_monitor(
        session: AsyncSession,
        user_id: str,
        name: str,
        location: Dict[str, Any],
        radius_km: float = 50.0,
        signals: Optional[List[str]] = None,
        threshold: Optional[Any] = None,
    ) -> Dict[str, Any]:
        u_id = _to_uuid(user_id)
        m_id = uuid.uuid4()
        monitor = Monitor(
            id=m_id,
            user_id=u_id,
            name=name,
            criteria={
                "location": location,
                "radius_km": radius_km,
                "signals": signals or ["traffic", "hazards", "aqi", "events"],
                "threshold": threshold or "significant_change",
            },
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(monitor)
        await session.flush()
        return _monitor_to_dict(monitor)

    @staticmethod
    async def list_monitors(
        session: AsyncSession, user_id: str, active_only: bool = False
    ) -> List[Dict[str, Any]]:
        u_id = _to_uuid(user_id)
        stmt = select(Monitor).where(Monitor.user_id == u_id)
        if active_only:
            stmt = stmt.where(Monitor.is_active == True)  # noqa: E712
        result = await session.execute(stmt)
        monitors = result.scalars().all()
        return [_monitor_to_dict(m) for m in monitors]

    @staticmethod
    async def get_monitor(session: AsyncSession, user_id: str, monitor_id: str) -> Optional[Monitor]:
        m_id = _to_uuid(monitor_id)
        u_id = _to_uuid(user_id)
        result = await session.get(Monitor, m_id)
        if result and result.user_id == u_id:
            return result
        return None

    @staticmethod
    async def update_monitor(
        session: AsyncSession,
        user_id: str,
        monitor_id: str,
        is_active: Optional[bool] = None,
        signals: Optional[List[str]] = None,
        threshold: Optional[Any] = None,
    ) -> Optional[Dict[str, Any]]:
        monitor = await PersistedMonitoringService.get_monitor(session, user_id, monitor_id)
        if not monitor:
            return None
        if is_active is not None:
            monitor.is_active = is_active
        if signals is not None:
            monitor.criteria["signals"] = signals
        if threshold is not None:
            monitor.criteria["threshold"] = threshold
        monitor.updated_at = datetime.utcnow()
        await session.flush()
        return _monitor_to_dict(monitor)

    @staticmethod
    async def delete_monitor(session: AsyncSession, user_id: str, monitor_id: str) -> bool:
        monitor = await PersistedMonitoringService.get_monitor(session, user_id, monitor_id)
        if not monitor:
            return False
        await session.delete(monitor)
        await session.flush()
        return True

    @staticmethod
    async def evaluate_monitors(session: AsyncSession) -> List[Dict[str, Any]]:
        """Iterate over active monitors, evaluate signals, and create alerts."""
        alerts_created: List[Alert] = []
        stmt = select(Monitor).where(Monitor.is_active == True)  # noqa: E712
        result = await session.execute(stmt)
        monitors: List[Monitor] = result.scalars().all()
        for monitor in monitors:
            criteria = monitor.criteria
            loc = criteria.get("location", {})
            lat = loc.get("latitude")
            lng = loc.get("longitude")
            if lat is None or lng is None:
                continue
            radius = criteria.get("radius_km", 50.0)
            signals = criteria.get("signals", [])
            city_name = loc.get("city") or loc.get("displayName") or "Monitored Location"
            if "traffic" in signals:
                traffic = await GoogleTrafficService.get_traffic_summary(lat, lng, radius)
                t_status = traffic.get("trafficStatus", "NORMAL")
                if t_status in ["HEAVY", "SEVERE"]:
                    severity = AlertSeverity.HIGH if t_status == "SEVERE" else AlertSeverity.INFO
                    alert = await AlertEngine.create_alert(
                        session,
                        monitor,
                        severity,
                        title=f"Severe Traffic around {city_name}",
                        description=f"Traffic status {t_status} with delay {traffic.get('delayMinutes',0)} minutes.",
                        payload=traffic,
                    )
                    if alert:
                        alerts_created.append(alert)
            if "aqi" in signals:
                aqi = await AirQualityProvider.get_air_quality(lat, lng, country_code=loc.get("countryCode"))
                aqi_val = aqi.get("value")
                if aqi_val and aqi_val > 150:
                    alert = await AlertEngine.create_alert(
                        session,
                        monitor,
                        AlertSeverity.HIGH,
                        title=f"Poor Air Quality in {city_name}",
                        description=f"AQI {aqi_val} ({aqi.get('category')}).",
                        payload=aqi,
                    )
                    if alert:
                        alerts_created.append(alert)
        await session.commit()
        return [_alert_to_dict(a) for a in alerts_created]

    @staticmethod
    async def get_alerts(session: AsyncSession, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve recent alerts for the given user, ordered by creation time descending."""
        u_id = _to_uuid(user_id)
        stmt = (
            select(Alert)
            .join(Monitor, Alert.monitor_id == Monitor.id)
            .where(Monitor.user_id == u_id)
            .order_by(Alert.created_at.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        alerts = result.scalars().all()
        return [_alert_to_dict(a) for a in alerts]
