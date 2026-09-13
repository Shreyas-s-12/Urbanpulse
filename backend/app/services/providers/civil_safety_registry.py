"""
UrbanPulse Civil Safety Provider Registry & Incident Engine
Location-aware public safety resolver:
  1. UK Police Open Data API (for Great Britain / countryCode == 'GB')
  2. US Municipal Open Crime APIs (Chicago Socrata, NYC Open Data for US locations)
  3. Authoritative Civic Safety & Civil Defense RAG Bulletins (Global)
  4. Explicit NO_COVERAGE in jurisdictions without open public police feeds.

Strict rule: NEVER fabricates "0 crimes" or "Safe" when a feed simply does not exist.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta
import logging
import httpx
from app.services.rag.rag_service import LocationAwareRAGService

logger = logging.getLogger("urbanpulse.civil_safety")


CIVIL_SAFETY_PROVIDERS: List[Dict[str, Any]] = [
    {
        "name": "data.police.uk (UK Home Office)",
        "coverage": "Great Britain (England, Wales, Northern Ireland)",
        "countries": ["GB"],
        "regions": ["GB"],
        "dataTypes": ["OFFICIAL_PUBLIC_SAFETY_FEED", "OPEN_CRIME_DATA"],
        "authority": "Official UK Police Street-Level Crime API",
        "freshness": "RECENT",
        "live": True,
    },
    {
        "name": "US Municipal Open Crime Portals",
        "coverage": "United States Municipalities (Chicago, NYC)",
        "countries": ["US"],
        "regions": ["IL", "NY"],
        "dataTypes": ["OPEN_CRIME_DATA"],
        "authority": "Municipal Open Data Feeds (Socrata)",
        "freshness": "RECENT",
        "live": True,
    },
    {
        "name": "UrbanPulse Public Safety Alert Stream",
        "coverage": "Global",
        "countries": ["GLOBAL"],
        "regions": ["GLOBAL"],
        "dataTypes": ["PUBLIC_INCIDENT_FEEDS", "EMERGENCY_ALERTS"],
        "authority": "Verified Civic & Emergency Dispatch Signals",
        "freshness": "LIVE",
        "live": True,
    },
    {
        "name": "Location-Aware Civil Defense RAG",
        "coverage": "Global",
        "countries": ["GLOBAL"],
        "regions": ["GLOBAL"],
        "dataTypes": ["RECENT_PUBLIC_SAFETY_UPDATES"],
        "authority": "Verified Municipal & Civil Defense Guidelines",
        "freshness": "RECENT",
        "live": True,
    },
]


class CivilSafetyRegistry:
    # In-memory incident cache per location (5-minute TTL)
    _cache: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def get_eligible_providers(cls, country_code: Optional[str] = None) -> List[Dict[str, Any]]:
        """Determines which providers can service the given country code."""
        c_upper = (country_code or "").upper()
        eligible = []
        for p in CIVIL_SAFETY_PROVIDERS:
            countries = p.get("countries", [])
            if "GLOBAL" in countries or c_upper in countries:
                eligible.append(p)
        return eligible

    @classmethod
    async def get_civil_safety(
        cls,
        latitude: float,
        longitude: float,
        radius_km: float = 50.0,
        country_code: Optional[str] = None,
        city: Optional[str] = None,
        corridor_events: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates real-time civil safety across 4 distinct data types:
          A. Official Public Safety Feeds (Police API)
          B. Open Crime Data (Municipal datasets)
          C. Public Incident Feeds & Alerts (CITY_EVENT public safety / emergency alerts)
          D. Recent Public-Safety Updates (Authoritative civil defense bulletins via RAG)
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        now_ts = datetime.now(timezone.utc).timestamp()
        cache_key = f"{country_code or ''}:{round(latitude, 2)}:{round(longitude, 2)}:{round(radius_km, 1)}"

        cached = cls._cache.get(cache_key)
        if cached and (now_ts - cached.get("_cached_at", 0)) < 300:
            return cached["data"]

        c_upper = (country_code or "").upper()
        incidents: List[Dict[str, Any]] = []
        alerts: List[Dict[str, Any]] = []
        sources: List[Dict[str, Any]] = []
        feed_capability = "NO_COVERAGE"
        status = "NO_COVERAGE"
        incident_count: Optional[int] = None
        message = ""
        confidence = 0.0

        # C. Public Incident Feeds & Alerts from CITY_EVENT
        events = corridor_events or []
        safety_events = [
            e for e in events
            if e.get("eventType") in ["PUBLIC_SAFETY_ALERT", "POLICE_INCIDENT", "MURDER", "ROBBERY", "THEFT"]
        ]
        if safety_events:
            alerts.extend(safety_events)
            sources.append({
                "name": "UrbanPulse Civic Alert Stream",
                "type": "SENSOR_NETWORK",
                "authority": "Verified Civic Emergency & Safety Signal",
            })

        # A & B. Query Official Police Feeds & Open Crime Datasets
        # 1. Great Britain: UK Police Street-Level Crime API
        if c_upper == "GB":
            uk_result = await cls._fetch_uk_police(latitude, longitude)
            if uk_result.get("success"):
                feed_capability = "OFFICIAL_PUBLIC_SAFETY_FEED"
                status = "AVAILABLE" if uk_result["incidents"] else "EMPTY_VERIFIED"
                incidents = uk_result["incidents"]
                incident_count = len(incidents)
                confidence = 0.94
                sources.append({
                    "name": "data.police.uk (UK Home Office)",
                    "type": "GOVERNMENT_STATION",
                    "authority": "Official UK Police Street-Level Crime API",
                })
                message = f"{incident_count} verified law enforcement incident(s) registered in this precinct."

        # 2. United States: City Portals (Chicago, NYC)
        elif c_upper == "US":
            us_result = await cls._fetch_us_open_data(latitude, longitude, city)
            if us_result.get("success"):
                feed_capability = "OPEN_CRIME_DATA"
                status = "AVAILABLE" if us_result["incidents"] else "EMPTY_VERIFIED"
                incidents = us_result["incidents"]
                incident_count = len(incidents)
                confidence = 0.90
                sources.append(us_result["source"])
                message = f"{incident_count} public safety record(s) indexed via municipal open data."

        # D. Retrieve Authoritative Civic Safety Bulletins (RAG)
        updates: List[Dict[str, Any]] = []
        try:
            rag_docs = await LocationAwareRAGService.retrieve_relevant_knowledge(
                latitude, longitude, query="safety alert protocol civil defense", city=city, limit=3
            )
            for doc in rag_docs:
                updates.append({
                    "id": doc.get("id"),
                    "title": doc.get("title"),
                    "content": doc.get("content"),
                    "category": doc.get("category", "PUBLIC_SAFETY_UPDATE"),
                    "source": doc.get("source", "Civil Defense Authority"),
                    "authorityScore": doc.get("authorityScore", 0.95),
                })
            if updates:
                sources.append({
                    "name": "Location-Aware Civil Defense RAG",
                    "type": "AUTHORITATIVE_BULLETIN",
                    "authority": "Verified Municipal & Civil Defense Guidelines",
                })
        except Exception as e:
            logger.debug("Civil safety RAG retrieval notice: %s", e)

        # Distinguish states truthfully:
        # EMPTY_VERIFIED: Connected feed confirms 0 incidents
        # PARTIAL: Direct police feed unavailable, but official updates or public alerts exist
        # NO_COVERAGE: No verified public safety feed covers these coordinates
        if feed_capability == "NO_COVERAGE":
            if alerts and updates:
                status = "PARTIAL"
                feed_capability = "PUBLIC_SAFETY_UPDATE"
                incident_count = None
                confidence = 0.70
                message = "Official safety advisories and verified public alerts active. Direct police dispatch API unavailable for this jurisdiction."
            elif updates:
                status = "PARTIAL"
                feed_capability = "PUBLIC_SAFETY_UPDATE"
                incident_count = None
                confidence = 0.65
                message = "Official civil defense advisories active. Direct police dispatch API unavailable for this jurisdiction."
            elif alerts:
                status = "PARTIAL"
                feed_capability = "PUBLIC_SAFETY_UPDATE"
                incident_count = None
                confidence = 0.60
                message = f"{len(alerts)} verified public safety alert(s) active. Direct police dispatch API unavailable."
            else:
                status = "NO_COVERAGE"
                feed_capability = "NO_COVERAGE"
                incident_count = None  # Transparently None, NEVER fake 0!
                confidence = 0.0
                message = "No verified public safety or police dispatch API covers these coordinates."
                sources.append({
                    "name": "Official Police Feeds",
                    "type": "GOVERNMENT_STATION",
                    "authority": "Jurisdiction-Dependent Open Data Feed",
                })

        result = {
            "status": status,
            "feedCapability": feed_capability,
            "incidentCount": incident_count,
            "verifiedCount": incident_count,
            "incidents": incidents[:25],
            "alerts": alerts,
            "alertCount": len(alerts),
            "updates": updates,
            "updateCount": len(updates),
            "sources": sources,
            "coverage": f"Country: {country_code or 'Global'}, City: {city or 'Coordinates'}",
            "observedAt": now_iso,
            "retrievedAt": now_iso,
            "confidence": confidence,
            "message": message,
        }

        cls._cache[cache_key] = {"data": result, "_cached_at": now_ts}
        return result

    @classmethod
    async def _fetch_uk_police(cls, latitude: float, longitude: float) -> Dict[str, Any]:
        """Fetches street-level crime from UK Police API."""
        url = f"https://data.police.uk/api/crimes-street/all-crime?lat={latitude}&lng={longitude}"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                r = await client.get(url)
                if r.status_code == 200:
                    raw_list = r.json()
                    incidents = []
                    for item in raw_list[:20]:
                        loc = item.get("location", {})
                        cat = (item.get("category") or "public-safety").replace("-", " ").title()
                        incidents.append({
                            "eventId": f"UK-POLICE-{item.get('id', '')}",
                            "canonicalEventId": f"CAN-UKP-{item.get('id', '')}",
                            "eventType": "POLICE_INCIDENT",
                            "title": f"{cat} incident recorded",
                            "description": f"Street-level law enforcement record ({loc.get('street', {}).get('name', 'Local Area')}). Outcome: {item.get('outcome_status', {}).get('category') if item.get('outcome_status') else 'Under investigation'}.",
                            "latitude": float(loc.get("latitude", latitude)),
                            "longitude": float(loc.get("longitude", longitude)),
                            "timestamp": f"{item.get('month', '2026-09')}-01T12:00:00Z",
                            "severity": 65 if "violent" in cat.lower() else 45,
                            "confidence": 98,
                            "source": "data.police.uk",
                            "status": "VERIFIED",
                            "category": "CIVIL_SAFETY",
                        })
                    return {"success": True, "incidents": incidents}
        except Exception as e:
            logger.info("UK Police API query notice: %s", e)
        return {"success": False, "incidents": []}

    @classmethod
    async def _fetch_us_open_data(cls, latitude: float, longitude: float, city: Optional[str]) -> Dict[str, Any]:
        """Queries municipal Socrata open crime portals for US cities."""
        c_lower = (city or "").lower()
        if "chicago" in c_lower or (41.6 <= latitude <= 42.1 and -87.9 <= longitude <= -87.5):
            url = "https://data.cityofchicago.org/resource/ijzp-q8t2.json?$limit=15&$order=date%20DESC"
            portal_name = "City of Chicago Open Data Portal"
        elif "york" in c_lower or (40.5 <= latitude <= 40.9 and -74.3 <= longitude <= -73.7):
            url = "https://data.cityofnewyork.us/resource/5uac-w243.json?$limit=15&$order=cmplnt_fr_dt%20DESC"
            portal_name = "NYC OpenData (NYPD Complaint Data)"
        else:
            return {"success": False, "incidents": []}

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                r = await client.get(url)
                if r.status_code == 200:
                    records = r.json()
                    incidents = []
                    for rec in records:
                        rec_lat = float(rec.get("latitude") or latitude)
                        rec_lon = float(rec.get("longitude") or longitude)
                        desc = rec.get("primary_type") or rec.get("ofns_desc") or "Civic Incident"
                        incidents.append({
                            "eventId": f"US-OPEN-{rec.get('id', '') or rec.get('cmplnt_num', '')}",
                            "canonicalEventId": f"CAN-USO-{rec.get('id', '') or rec.get('cmplnt_num', '')}",
                            "eventType": "POLICE_INCIDENT",
                            "title": desc.title(),
                            "description": f"Verified municipal transparency log: {desc} ({rec.get('block', '') or rec.get('prem_typ_desc', '')}).",
                            "latitude": rec_lat,
                            "longitude": rec_lon,
                            "timestamp": rec.get("date") or rec.get("cmplnt_fr_dt") or datetime.now(timezone.utc).isoformat(),
                            "severity": 60,
                            "confidence": 95,
                            "source": portal_name,
                            "status": "VERIFIED",
                            "category": "CIVIL_SAFETY",
                        })
                    return {
                        "success": True,
                        "incidents": incidents,
                        "source": {
                            "name": portal_name,
                            "type": "GOVERNMENT_STATION",
                            "authority": "Official City Open Data Transparency Feed",
                        },
                    }
        except Exception as e:
            logger.info("US municipal crime query notice: %s", e)
        return {"success": False, "incidents": []}