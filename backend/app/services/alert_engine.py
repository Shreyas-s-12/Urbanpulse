"""AlertEngine service for Phase 4.

Handles creation of alerts with deduplication, cooldown, and priority calculation.
"""

import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from ..db.database import get_db
from ..models.alert import Alert, AlertSeverity
from ..models.monitor import Monitor

# Cooldown periods (in minutes) per severity
COOLDOWN_MINUTES = {
    "info": 15,
    "low": 15,
    "high": 5,
    "critical": 5,
}

class AlertEngine:
    @staticmethod
    async def _last_alert_time(session, monitor_id: str, severity: str) -> Optional[datetime]:
        # Retrieve most recent alert for given monitor and severity
        result = await session.execute(
            Alert.__table__.select()
            .where(Alert.monitor_id == monitor_id)
            .where(Alert.severity == severity)
            .order_by(Alert.created_at.desc())
            .limit(1)
        )
        row = result.first()
        return row["created_at"] if row else None

    @staticmethod
    async def _is_cooldown_active(last_time: Optional[datetime], severity: str) -> bool:
        if not last_time:
            return False
        minutes = COOLDOWN_MINUTES.get(severity.lower(), 5)
        return datetime.utcnow() - last_time < timedelta(minutes=minutes)

    @staticmethod
    async def create_alert(
        session,
        monitor: Monitor,
        severity: AlertSeverity,
        title: str,
        description: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Optional[Alert]:
        """Create a new alert if cooldown permits.

        Returns the Alert instance if created, otherwise None (cooldown active).
        """
        # Deduplication: same monitor, same severity, recent within cooldown?
        last_time = await AlertEngine._last_alert_time(session, str(monitor.id), severity.value)
        if await AlertEngine._is_cooldown_active(last_time, severity.value):
            return None

        alert = Alert(
            id=uuid.uuid4(),
            monitor_id=monitor.id,
            severity=severity,
            title=title,
            description=description,
            payload=payload,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(alert)
        await session.flush()  # ensure id is generated
        return alert
