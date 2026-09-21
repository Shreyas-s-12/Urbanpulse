"""
UrbanPulse Dedicated Multi-Page Intelligence Layer
Modules:
- GeoRAG (Satellite Environmental Intelligence)
- CrisisRAG (Emergency Response Intelligence)
- AquaRAG (Water Intelligence)
- Common Prediction Engine (Dynamic year, 4 domain factors)
"""

from .prediction_engine import CommonPredictionEngine
from .georag_service import GeoRAGService
from .crisisrag_service import CrisisRAGService
from .aquarag_service import AquaRAGService

__all__ = [
    "CommonPredictionEngine",
    "GeoRAGService",
    "CrisisRAGService",
    "AquaRAGService",
]
