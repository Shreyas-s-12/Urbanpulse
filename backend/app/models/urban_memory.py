from sqlalchemy import Column, String, DateTime, JSON, Float, Index
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from ..db.database import Base

class UrbanMemory(Base):
    __tablename__ = "urban_memory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_name = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    signal = Column(String(100), nullable=False)
    value = Column(JSON, nullable=True)
    observed_at = Column(DateTime, default=datetime.utcnow)
    source = Column(String(255), nullable=True)
    confidence = Column(Float, nullable=True)
    # Index for quick TTL cleanup and location queries
    __table_args__ = (
        Index("idx_urban_memory_location", "latitude", "longitude"),
    )
