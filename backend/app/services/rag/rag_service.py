"""
UrbanPulse Location-Aware RAG Service
Maintains dual knowledge stores:
1. STABLE KNOWLEDGE: Emergency response, disaster procedures, civil defense guidelines.
2. RECENT KNOWLEDGE: Authoritative bulletins, municipal announcements, road maintenance advisories.
Uses geospatial proximity scoring, authority ranking, and expiration filtering.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import math
import logging

logger = logging.getLogger("urbanpulse.rag")


# Authoritative Knowledge Seed Documents
KNOWLEDGE_STORE: List[Dict[str, Any]] = [
    # Global Stable Knowledge
    {
        "id": "DOC-STABLE-EARTHQUAKE-01",
        "title": "Global Seismic Response & Structural Safety Procedure",
        "content": (
            "During seismic tremors: Drop, Cover, and Hold On. Stay away from glass windows, unanchored masonry, "
            "and electrical power lines. If inside a vehicle, pull over to a clear location away from overpasses and bridges. "
            "Wait for authorized structural clearance before re-entering compromised infrastructure."
        ),
        "location": None,
        "country": None,
        "category": "STABLE",
        "docType": "STABLE_KNOWLEDGE",
        "eventType": "EARTHQUAKE",
        "source": "USGS & Global Civil Defense Consortium",
        "authorityScore": 0.98,
        "confidence": 0.99,
        "publishedAt": "2026-01-01T00:00:00Z",
        "expiresAt": None,
    },
    {
        "id": "DOC-STABLE-FLOOD-01",
        "title": "Urban Flash Flood & Road Inundation Transit Protocols",
        "content": (
            "Never attempt to drive or walk through moving water over 15cm (6 inches) deep. Water levels rise rapidly in low-lying "
            "subway underpasses and ring road junctions. Obey official perimeter barriers. Seek vertical evacuation to higher ground."
        ),
        "location": None,
        "country": None,
        "category": "STABLE",
        "docType": "STABLE_KNOWLEDGE",
        "eventType": "FLOOD",
        "source": "World Meteorological Organization Emergency Guidance",
        "authorityScore": 0.96,
        "confidence": 0.98,
        "publishedAt": "2026-01-01T00:00:00Z",
        "expiresAt": None,
    },
    {
        "id": "DOC-STABLE-AQI-01",
        "title": "Standard-Aware Atmospheric Health & Particulate Exposure Guidelines",
        "content": (
            "When local AQI reaches Poor or Severe thresholds (CPCB > 200, EAQI > 60, or US AQI > 150), sensitive groups "
            "should avoid prolonged outdoor exertion. Wear verified N95/FFP2 particulate filtration masks outdoors and activate "
            "indoor HEPA air purification systems."
        ),
        "location": None,
        "country": None,
        "category": "STABLE",
        "docType": "STABLE_KNOWLEDGE",
        "eventType": "AIR_QUALITY",
        "source": "WHO Air Quality Guidelines",
        "authorityScore": 0.97,
        "confidence": 0.99,
        "publishedAt": "2026-01-01T00:00:00Z",
        "expiresAt": None,
    },
    # Recent Regional Authoritative Bulletins
    {
        "id": "DOC-RECENT-BENGALURU-01",
        "title": "Bengaluru Outer Ring Road & Silk Board Corridor Transit Advisory",
        "content": (
            "Traffic police bulletin: Heavy vehicle restrictions active on Outer Ring Road (Hebbal to Silk Board) during peak morning "
            "(08:30–11:00) and evening (17:30–20:30) commuter windows to reduce corridor choke points."
        ),
        "location": "Bengaluru",
        "country": "India",
        "category": "RECENT",
        "docType": "RECENT_UPDATE",
        "eventType": "TRAFFIC",
        "source": "Bengaluru Traffic Police Official Dispatch",
        "authorityScore": 0.94,
        "confidence": 0.95,
        "publishedAt": "2026-09-12T06:00:00Z",
        "expiresAt": "2026-10-01T00:00:00Z",
    },
    {
        "id": "DOC-RECENT-DELHI-01",
        "title": "Delhi NCR Winter Anti-Dust & Construction Regulation Advisory",
        "content": (
            "Environment ministry bulletin: Graded Response Action Plan (GRAP) guidelines active across Delhi NCR. Construction sites "
            "must operate continuous water misters, and mechanized road sweeping is active on arterial corridors to control PM10."
        ),
        "location": "Delhi",
        "country": "India",
        "category": "RECENT",
        "docType": "RECENT_UPDATE",
        "eventType": "AIR_QUALITY",
        "source": "Commission for Air Quality Management (CAQM)",
        "authorityScore": 0.95,
        "confidence": 0.96,
        "publishedAt": "2026-09-11T09:00:00Z",
        "expiresAt": "2026-10-15T00:00:00Z",
    },
    {
        "id": "DOC-RECENT-NEWYORK-01",
        "title": "NYC Transit & MTA Infrastructure Maintenance Notice",
        "content": (
            "MTA service advisory: Scheduled track maintenance on express transit lines between Manhattan and Queens during weekend hours. "
            "Expect alternate routing and moderate commuter delays on surface avenue connections."
        ),
        "location": "New York",
        "country": "United States",
        "category": "RECENT",
        "docType": "RECENT_UPDATE",
        "eventType": "TRAFFIC",
        "source": "Metropolitan Transportation Authority (MTA)",
        "authorityScore": 0.93,
        "confidence": 0.94,
        "publishedAt": "2026-09-10T12:00:00Z",
        "expiresAt": "2026-09-25T00:00:00Z",
    },
    {
        "id": "DOC-RECENT-LONDON-01",
        "title": "Transport for London (TfL) Central Congestion & Low Emission Advisory",
        "content": (
            "TfL travel advisory: Ultra Low Emission Zone (ULEZ) standards enforced across all London boroughs. Commuters are advised to "
            "utilize public rail arteries during weekday core hours to minimize central road congestion."
        ),
        "location": "London",
        "country": "United Kingdom",
        "category": "RECENT",
        "docType": "RECENT_UPDATE",
        "eventType": "TRAFFIC",
        "source": "Transport for London (TfL)",
        "authorityScore": 0.94,
        "confidence": 0.95,
        "publishedAt": "2026-09-11T08:00:00Z",
        "expiresAt": "2026-10-01T00:00:00Z",
    },
    {
        "id": "DOC-RECENT-TOKYO-01",
        "title": "Tokyo Metropolitan Disaster Prevention & Seismic Reinforcement Notice",
        "content": (
            "Tokyo Disaster Prevention Division: Evacuation center signage and emergency battery backup stations updated across all 23 wards. "
            "Residents are reminded to keep household emergency packs stocked and verify local shelter map pins."
        ),
        "location": "Tokyo",
        "country": "Japan",
        "category": "RECENT",
        "docType": "RECENT_UPDATE",
        "eventType": "HAZARDS",
        "source": "Tokyo Metropolitan Government Disaster Management",
        "authorityScore": 0.96,
        "confidence": 0.97,
        "publishedAt": "2026-09-09T04:00:00Z",
        "expiresAt": "2026-11-01T00:00:00Z",
    },
]


class LocationAwareRAGService:
    @classmethod
    def search_knowledge(
        cls,
        query: str,
        location_meta: Optional[Dict[str, Any]] = None,
        event_type: Optional[str] = None,
        doc_type: Optional[str] = None,
        limit: int = 4,
    ) -> List[Dict[str, Any]]:
        """
        Performs location-aware semantic & metadata retrieval:
        1. Filters out expired alerts
        2. Optionally filters by doc_type ('STABLE_KNOWLEDGE' vs 'RECENT_UPDATE' vs 'LIVE_ALERT')
        3. Scores documents by:
           - Geographic relevance (same city > same country > global)
           - Domain / intent match
           - Authority score
        4. Returns ranked knowledge chunks with source provenance
        """
        location_meta = location_meta or {}
        target_city = (location_meta.get("city") or "").lower()
        target_country = (location_meta.get("country") or "").lower()
        q_lower = query.lower()

        now_iso = datetime.now(timezone.utc).isoformat()
        ranked_results: List[tuple[float, Dict[str, Any]]] = []

        for doc in KNOWLEDGE_STORE:
            # Check docType filter
            if doc_type and doc.get("docType") != doc_type and doc.get("category") != doc_type:
                continue

            # Check expiration
            expires_at = doc.get("expiresAt")
            if expires_at and expires_at < now_iso:
                continue

            score = 0.0

            # 1. Geographic relevance
            doc_loc = (doc.get("location") or "").lower()
            doc_country = (doc.get("country") or "").lower()

            if doc_loc and target_city and doc_loc in target_city:
                score += 50.0  # Exact city match
            elif doc_country and target_country and doc_country in target_country:
                score += 25.0  # Same country match
            elif not doc_loc and not doc_country:
                # Global authoritative guidance
                score += 15.0 if not doc_type or doc_type == "STABLE_KNOWLEDGE" else 0.0
            else:
                score -= 30.0  # Different location penalty (prevents unrelated city pollution)

            # 2. Domain / Keyword match
            doc_text = f"{doc['title']} {doc['content']} {doc.get('eventType', '')}".lower()
            query_words = [w for w in q_lower.split() if len(w) > 3]
            for w in query_words:
                if w in doc_text:
                    score += 8.0

            if event_type and doc.get("eventType") == event_type:
                score += 20.0

            # 3. Authority score weighting
            score += doc.get("authorityScore", 0.5) * 10.0

            # Only accept positive relevance scores
            if score > 5.0:
                ranked_results.append((score, doc))

        ranked_results.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, doc in ranked_results[:limit]:
            d = dict(doc)
            d["relevanceScore"] = round(score, 2)
            results.append(d)
        return results

    @classmethod
    async def retrieve_relevant_knowledge(
        cls,
        latitude: float,
        longitude: float,
        query: str = "safety civil defense",
        city: Optional[str] = None,
        country: Optional[str] = None,
        doc_type: Optional[str] = None,
        limit: int = 4,
    ) -> List[Dict[str, Any]]:
        """
        Async interface for location-aware RAG retrieval.
        """
        location_meta = {"city": city, "country": country, "latitude": latitude, "longitude": longitude}
        return cls.search_knowledge(query=query, location_meta=location_meta, doc_type=doc_type, limit=limit)
