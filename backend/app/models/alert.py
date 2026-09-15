from sqlalchemy import Column, String, Boolean, DateTime, JSON, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from enum import Enum as PyEnum
import uuid
from datetime import datetime
from ..db.database import Base

class AlertSeverity(str, PyEnum):
    INFO = "info"
    LOW = "low"
    HIGH = "high"
    CRITICAL = "critical"

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    monitor_id = Column(UUID(as_uuid=True), ForeignKey("monitors.id"), nullable=False)
    severity = Column(Enum(AlertSeverity), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(String, nullable=True)
    payload = Column(JSON, nullable=True)  # Additional data (e.g., event details)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    monitor = relationship("Monitor", back_populates="alerts")
