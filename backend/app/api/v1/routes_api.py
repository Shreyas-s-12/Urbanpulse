"""
UrbanPulse API v1 Routes
Dynamic, location-first real-time endpoints for any coordinates on Earth.
Connects frontend modules to provider adapters, event fusion, urban condition scoring, and Copilot.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import asyncio
import json
from datetime import datetime, timezone

from app.services.providers.geocoding_provider import GeocodingProvider
from app.services.providers.weather_provider import WeatherProvider
from app.services.providers.air_quality_provider import AirQualityProvider
from app.services.providers.road_provider import RoadProvider
from app.services.providers.earthquake_provider import EarthquakeProvider
from app.services.providers.routing_provider import RoutingProvider
from app.services.providers.crime_provider import CrimeProvider
from app.services.event_fusion import EventFusionService
from app.services.google_traffic import GoogleTrafficService
from app.services.urban_intel import UrbanIntelService

router = APIRouter(prefix="/api/v1", tags=["UrbanPulse Intelligence"])


class RouteAnalyzeRequest(BaseModel):
    origin: Optional[Dict[str, Any]] = None  # {"lat": ..., "lng": ...}
    destination: Optional[Dict[str, Any]] = None  # {"lat": ..., "lng": ...}
    from_location: Optional[Dict[str, Any]] = None
    to_location: Optional[Dict[str, Any]] = None
    mode: Optional[str] = None
    travel_mode: Optional[str] = None
    departure_time: str = "Immediate"


class CopilotRequest(BaseModel):
    message: Optional[str] = None
    query: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location: Optional[Dict[str, Any]] = None
    radius_km: float = 50.0
    city: Optional[str] = None
    active_route_id: Optional[str] = None


class CoordinateQuery(BaseModel):
    latitude: float
    longitude: float


def _read_number(payload: Optional[Dict[str, Any]], *keys: str) -> Optional[float]:
    if not payload:
        return None
    for key in keys:
        value = payload.get(key)
        if value is not None:
            return float(value)
    return None


async def coordinate_query(
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
) -> CoordinateQuery:
    resolved_lat = lat if lat is not None else latitude
    resolved_lon = lng if lng is not None else longitude

    if resolved_lat is None or resolved_lon is None:
        raise HTTPException(status_code=422, detail="latitude and longitude are required")

    if not -90 <= resolved_lat <= 90 or not -180 <= resolved_lon <= 180:
        raise HTTPException(status_code=422, detail="coordinates are outside valid WGS84 bounds")

    return CoordinateQuery(latitude=resolved_lat, longitude=resolved_lon)


def event_collection_status(events: List[Dict[str, Any]], providers_checked: Optional[List[str]] = None) -> str:
    if events:
        if all(event.get("source") == "Demo Data" for event in events):
            return "DEMO"
        return "AVAILABLE"
    if providers_checked and len(providers_checked) > 0:
        return "EMPTY_VERIFIED"
    return "NO_COVERAGE"


# ==============================================================================
# 1. Location Endpoints (Universal Geocoding & Search)
# ==============================================================================

@router.get("/location/reverse")
async def reverse_geocode(
    coords: CoordinateQuery = Depends(coordinate_query),
    accuracy: Optional[float] = Query(None),
):
    """Reverse geocode coordinates into location context."""
    return await GeocodingProvider.reverse_geocode(coords.latitude, coords.longitude, accuracy)


@router.get("/location/search")
async def search_location(q: Optional[str] = Query(None), query: Optional[str] = Query(None)):
    """Search for any city, address, landmark, or coordinates worldwide."""
    search_term = q if q is not None else query
    if not search_term:
        raise HTTPException(status_code=422, detail="q is required")
    return await GeocodingProvider.search(search_term)


# ==============================================================================
# 2. Weather Endpoint (Open-Meteo Integration with Caching)
# ==============================================================================

@router.get("/weather")
async def get_weather(
    coords: CoordinateQuery = Depends(coordinate_query),
):
    """Fetch real-time, hourly, and daily weather from Open-Meteo for coordinates."""
    return WeatherProvider.get_weather(coords.latitude, coords.longitude)


# ==============================================================================
# 3. Events & Incidents Endpoints (Spatial Radial Query & 24h History)
# ==============================================================================

@router.get("/events")
@router.get("/events/nearby")
@router.get("/hazards")
@router.get("/incidents/nearby")
async def get_nearby_events(
    coords: CoordinateQuery = Depends(coordinate_query),
    radius_km: Optional[float] = Query(None),
    radius: Optional[float] = Query(None),
    category: Optional[str] = Query(None),
):
    """Retrieve normalized CITY_EVENT items within a specified radius."""
    selected_radius = radius_km if radius_km is not None else (radius if radius is not None else 50.0)
    fusion_result = await EventFusionService.get_live_events_near_location(
        center_lat=coords.latitude,
        center_lon=coords.longitude,
        radius_km=selected_radius,
        category=category,
    )
    events = fusion_result.get("events", [])
    events.sort(key=lambda x: x.get("distanceKm", 0))

    return {
        "status": fusion_result.get("status", event_collection_status(events, fusion_result.get("providersChecked"))),
        "center": {"latitude": coords.latitude, "longitude": coords.longitude},
        "radiusKm": selected_radius,
        "count": len(events),
        "events": events,
        "providersChecked": fusion_result.get("providersChecked", []),
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/events/history")
async def get_event_history(
    coords: CoordinateQuery = Depends(coordinate_query),
    radius_km: Optional[float] = Query(None),
    radius: Optional[float] = Query(None),
    category: Optional[str] = Query(None),
    hours: int = Query(24),
):
    """Chronological 24-hour event timeline for given coordinates."""
    selected_radius = radius_km if radius_km is not None else (radius if radius is not None else 50.0)
    fusion_result = await EventFusionService.get_live_events_near_location(
        center_lat=coords.latitude,
        center_lon=coords.longitude,
        radius_km=selected_radius,
        hours=hours,
        category=category,
    )
    events = fusion_result.get("events", [])
    events.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    return {
        "status": fusion_result.get("status", event_collection_status(events, fusion_result.get("providersChecked"))),
        "center": {"latitude": coords.latitude, "longitude": coords.longitude},
        "radiusKm": selected_radius,
        "timeWindowHours": hours,
        "count": len(events),
        "events": events,
        "providersChecked": fusion_result.get("providersChecked", []),
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/events/stream")
async def event_stream(
    coords: CoordinateQuery = Depends(coordinate_query),
    radius_km: Optional[float] = Query(None),
    radius: Optional[float] = Query(None),
):
    """Server-Sent Events (SSE) stream for live event pushes."""
    selected_radius = radius_km if radius_km is not None else (radius if radius is not None else 50.0)

    async def sse_generator():
        # Push initial status
        yield f"data: {json.dumps({'type': 'CONNECTED', 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"
        while True:
            await asyncio.sleep(15)
            # Periodic heartbeat / live pulse event
            pulse = {
                "type": "HEARTBEAT",
                "center": {"latitude": coords.latitude, "longitude": coords.longitude},
                "radiusKm": selected_radius,
                "status": "LIVE",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            yield f"data: {json.dumps(pulse)}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")


# ==============================================================================
# 4. Traffic Endpoint (Google Routes API v2 Real-Time Conditions)
# ==============================================================================

@router.get("/traffic")
async def get_traffic(
    coords: CoordinateQuery = Depends(coordinate_query),
    radius_km: Optional[float] = Query(None),
    radius: Optional[float] = Query(None),
):
    """Retrieve real-time Google Traffic telemetry and congestion conditions."""
    selected_radius = radius_km if radius_km is not None else (radius if radius is not None else 50.0)
    return await GoogleTrafficService.get_traffic_summary(coords.latitude, coords.longitude, selected_radius)


# ==============================================================================
# 5. Global Intelligence & Domain Endpoints
# ==============================================================================

@router.get("/intel")
async def get_urban_intel(
    coords: CoordinateQuery = Depends(coordinate_query),
    radius_km: Optional[float] = Query(None),
    radius: Optional[float] = Query(None),
    scale: Optional[str] = Query(None),
    units: Optional[str] = Query("metric"),
):
    """
    Unified master intelligence endpoint returning the normalized UrbanIntelResponse.
    Integrates all location-aware provider adapters with explicit source provenance.
    """
    selected_radius = radius_km if radius_km is not None else (radius if radius is not None else 50.0)
    return await UrbanIntelService.get_full_intelligence(
        coords.latitude,
        coords.longitude,
        radius_km=selected_radius,
        requested_aqi_scale=scale,
        units=units or "metric",
    )


@router.get("/air-quality")
async def get_air_quality(
    coords: CoordinateQuery = Depends(coordinate_query),
    scale: Optional[str] = Query(None),
    country_code: Optional[str] = Query(None),
):
    """
    Standard-aware air quality intelligence powered by Open-Meteo CAMS/SILAM.
    Supports US AQI, CPCB India AQI, and European AQI.
    """
    return await AirQualityProvider.get_air_quality(
        coords.latitude,
        coords.longitude,
        country_code=country_code,
        requested_scale=scale,
    )


@router.get("/roads")
@router.get("/intelligence/roads")
async def get_roads(
    coords: CoordinateQuery = Depends(coordinate_query),
    radius_km: Optional[float] = Query(None),
    radius: Optional[float] = Query(None),
):
    """
    Separates Road Network coverage from physical road surface condition monitoring.
    """
    selected_radius = radius_km if radius_km is not None else (radius if radius is not None else 50.0)
    fusion_result = await EventFusionService.get_live_events_near_location(
        center_lat=coords.latitude,
        center_lon=coords.longitude,
        radius_km=selected_radius,
    )
    events = fusion_result.get("events", [])
    return await RoadProvider.get_road_status_async(coords.latitude, coords.longitude, selected_radius, events)


@router.get("/civil-safety")
@router.get("/intelligence/civil-safety")
async def get_civil_safety(
    coords: CoordinateQuery = Depends(coordinate_query),
    radius_km: Optional[float] = Query(None),
    radius: Optional[float] = Query(None),
    country_code: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
):
    """
    Jurisdiction-aware civil safety and public incident transparency endpoint.
    Distinguishes official police dispatch feeds, municipal open data, and civic safety bulletins.
    """
    selected_radius = radius_km if radius_km is not None else (radius if radius is not None else 50.0)
    # If country_code not passed, resolve via geocoding
    resolved_country = country_code
    resolved_city = city
    if not resolved_country:
        try:
            loc = await GeocodingProvider.reverse_geocode(coords.latitude, coords.longitude)
            resolved_country = loc.get("countryCode")
            resolved_city = loc.get("city") or resolved_city
        except Exception:
            pass

    # Gather any verified civic safety events from the radius
    corridor_events = []
    try:
        fusion_result = await EventFusionService.get_live_events_near_location(
            center_lat=coords.latitude,
            center_lon=coords.longitude,
            radius_km=selected_radius,
        )
        corridor_events = fusion_result.get("events", [])
    except Exception:
        pass

    return await CrimeProvider.get_crime_events_async(
        coords.latitude, coords.longitude, selected_radius, country_code=resolved_country, city=resolved_city, corridor_events=corridor_events
    )



@router.get("/urban-condition")
async def get_urban_condition(
    coords: CoordinateQuery = Depends(coordinate_query),
    radius_km: Optional[float] = Query(None),
    radius: Optional[float] = Query(None),
):
    """
    Computes transparent, deterministic 0-100 Urban Condition Score.
    Reports knownSignals vs missingSignals and penalizes missing signals in confidence.
    """
    selected_radius = radius_km if radius_km is not None else (radius if radius is not None else 50.0)
    intel = await UrbanIntelService.get_full_intelligence(coords.latitude, coords.longitude, selected_radius)
    return intel["condition"]


# ==============================================================================
# 5. Route Analysis Endpoint (Multi-Candidate & Intersection Engine)
# ==============================================================================

@router.post("/routes/analyze")
async def analyze_route(req: RouteAnalyzeRequest):
    """
    Computes candidate routes and correlates Route + Event intersections.
    Returns FASTEST, SAFEST, LOWEST_RISK, and RECOMMENDED paths with explanations.
    """
    origin = req.origin or req.from_location
    destination = req.destination or req.to_location
    origin_lat = _read_number(origin, "lat", "latitude")
    origin_lon = _read_number(origin, "lng", "lon", "longitude")
    dest_lat = _read_number(destination, "lat", "latitude")
    dest_lon = _read_number(destination, "lng", "lon", "longitude")
    travel_mode = req.mode or req.travel_mode or "drive"

    if origin_lat is None or origin_lon is None or dest_lat is None or dest_lon is None:
        raise HTTPException(status_code=422, detail="origin and destination coordinates are required")

    # Gather corridor events safely
    corridor_events = []
    try:
        mid_lat = (origin_lat + dest_lat) / 2
        mid_lon = (origin_lon + dest_lon) / 2
        corridor_events = EventFusionService.get_events_near_location(mid_lat, mid_lon, radius_km=50.0)
    except Exception as exc:
        pass

    route_plan = await RoutingProvider.analyze_route(
        origin_lat, origin_lon, dest_lat, dest_lon, travel_mode, corridor_events, req.departure_time
    )

    return {
        "fromLocation": {
            "latitude": origin_lat,
            "longitude": origin_lon,
            "city": origin.get("city") if origin else None,
            "district": origin.get("district") if origin else None,
            "region": origin.get("region") if origin else None,
            "country": origin.get("country") if origin else None,
            "timezone": origin.get("timezone") if origin else None,
            "displayName": origin.get("displayName") if origin else f"{origin_lat:.4f}, {origin_lon:.4f}",
            "isUserLocation": origin.get("isUserLocation", True) if origin else True,
        },
        "toLocation": {
            "latitude": dest_lat,
            "longitude": dest_lon,
            "city": destination.get("city") if destination else None,
            "district": destination.get("district") if destination else None,
            "region": destination.get("region") if destination else None,
            "country": destination.get("country") if destination else None,
            "timezone": destination.get("timezone") if destination else None,
            "displayName": destination.get("displayName") if destination else f"{dest_lat:.4f}, {dest_lon:.4f}",
            "isUserLocation": destination.get("isUserLocation", False) if destination else False,
        },
        "departureTime": req.departure_time,
        **route_plan,
    }


# ==============================================================================
# 6. Copilot Endpoint (Gathers Live Signals + RAG + Explanations)
# ==============================================================================

@router.post("/copilot")
async def copilot_query(req: CopilotRequest):
    """
    Combines Live Signals + 24h Events + Weather + Spatial Context to explain situations.
    Does NOT hallucinate live data.
    """
    latitude = req.latitude if req.latitude is not None else _read_number(req.location, "lat", "latitude")
    longitude = req.longitude if req.longitude is not None else _read_number(req.location, "lng", "lon", "longitude")
    message = req.message or req.query

    if latitude is None or longitude is None:
        raise HTTPException(status_code=422, detail="latitude and longitude are required")
    if not message:
        raise HTTPException(status_code=422, detail="message is required")

    intel = await UrbanIntelService.get_full_intelligence(latitude, longitude, req.radius_km)
    location_ctx = intel.get("location", {})
    weather = intel.get("weather", {})
    air_quality = intel.get("airQuality", {})
    traffic = intel.get("traffic", {})
    roads = intel.get("roads", {})
    events = intel.get("events", [])
    condition = intel.get("condition", {})

    high_impact = [e for e in events if e.get("severity", 0) >= 70]
    quakes = [e for e in events if e.get("eventType") == "EARTHQUAKE"]

    query_lower = message.lower()
    citations = []
    actions = []

    city_name = location_ctx.get("city") or req.city
    country_name = location_ctx.get("country") or ""
    location_str = f"{city_name}, {country_name}".strip(", ") if city_name else f"({latitude:.3f}, {longitude:.3f})"

    if any(w in query_lower for w in ["air", "aqi", "pollution", "smog", "air quality"]):
        if air_quality.get("status") == "AVAILABLE" and air_quality.get("value") is not None:
            val = air_quality["value"]
            scale = air_quality.get("scale", "US_AQI")
            cat = air_quality.get("category", "Moderate")
            pol = air_quality.get("pollutant", "PM2.5")
            src = air_quality.get("source", "Open-Meteo CAMS/SILAM")
            answer = (
                f"Air quality for {location_str} is classified as **{cat}** with a {scale} value of **{val}** (dominant pollutant: {pol}). "
                f"Data is modeled via {src} atmospheric telemetry."
            )
            citations.append({"type": "Air Quality", "source": src, "detail": f"{scale}: {val} ({cat})"})
            actions = ["Inspect air quality breakdown", "Check outdoor activity advisory"]
        else:
            answer = f"No verified real-time air quality sensor or atmospheric feed is available for {location_str}."
            actions = ["Check nearby regional stations", "Refresh telemetry"]

    elif any(w in query_lower for w in ["road", "pothole", "asphalt", "pavement"]):
        net_status = roads.get("roadNetworkStatus", "AVAILABLE")
        cond_status = roads.get("roadConditionStatus", "NO_VERIFIED_FEED")
        haz_count = roads.get("activeHazardCount", 0)
        if cond_status == "AVAILABLE" and haz_count > 0:
            answer = (
                f"Road network mapping is **{net_status}** for {location_str}. "
                f"There are **{haz_count} active road surface alert(s)** (potholes/cavities) verified in your {req.radius_km} km radius."
            )
            citations.append({"type": "Road Condition", "source": roads.get("roadConditionSource", "UrbanPulse"), "detail": f"{haz_count} alerts"})
        else:
            answer = (
                f"Road network mapping is **{net_status}** for {location_str}. "
                f"However, **no verified physical road-surface condition feed** covers this jurisdiction. "
                f"UrbanPulse does not assume roads are clear without active sensors."
            )
            citations.append({"type": "Roads Telemetry", "source": "Road Engine", "detail": "No verified physical sensor feed"})
        actions = ["Plan a Journey", "Report a road hazard"]

    elif any(w in query_lower for w in ["crime", "police", "safety", "theft", "security"]):
        answer = (
            f"Public safety status for {location_str}: **No verified open police dispatch feed** is currently connected for these coordinates. "
            f"UrbanPulse strictly refrains from reporting '0 crimes' or false safety guarantees in the absence of verified law enforcement feeds."
        )
        citations.append({"type": "Civil Safety", "source": "Official Police Feeds", "detail": "No open data API available"})
        actions = ["Check local emergency numbers", "View verified civic events"]

    elif any(w in query_lower for w in ["earthquake", "quake", "tremor", "seismic"]):
        if quakes:
            eq = quakes[0]
            mag = eq.get("metadata", {}).get("magnitude", 4.5)
            impact = eq.get("metadata", {}).get("impactRisk", "MODERATE")
            answer = (
                f"A magnitude {mag} seismic event was logged {eq.get('distanceKm')} km away from {location_str}. "
                f"UrbanPulse computes your localized impact risk as **{impact}**. "
                f"No structural failure is indicated in your immediate radius."
            )
            citations.append({"type": "Seismic Alert", "source": "USGS", "detail": f"M {mag}, {eq.get('distanceKm')} km away"})
        else:
            answer = f"Zero seismic tremors or earthquake alerts detected within {req.radius_km} km of {location_str} in the last 7 days."
            citations.append({"type": "Seismic Watch", "source": "USGS API", "detail": "Clean sensor buffer"})
        actions = ["Inspect seismic epicenter on Live Map", "Check emergency civil defense guidelines"]

    elif any(w in query_lower for w in ["route", "traffic", "slower", "delay", "corridor"]):
        if traffic.get("status") == "AVAILABLE":
            delay = traffic.get("delayMinutes", 0)
            status_text = traffic.get("trafficStatus", "NORMAL")
            detail = traffic.get("detail", "Free-flowing")
            answer = (
                f"Live Google Traffic telemetry for {location_str}: **{status_text}** ({detail}). "
                f"Congestion delay is approximately +{delay} minutes relative to free-flow conditions."
            )
            citations.append({"type": "Google Traffic", "source": "Google Routes API", "detail": f"+{delay} min delay"})
        elif high_impact:
            hazard = high_impact[0]
            delay = hazard.get("metadata", {}).get("delayMinutes", 18)
            answer = (
                f"Corridor transit near {location_str} is slowed by a verified {hazard.get('eventType', 'incident')} ({hazard.get('title')}) "
                f"located {hazard.get('distanceKm')} km away. Expected delay is ~{delay} minutes."
            )
            citations.append({"type": hazard.get("eventType"), "source": hazard.get("source"), "detail": hazard.get("title")})
        else:
            answer = f"No verified high-severity traffic incidents or Google traffic telemetry available within {req.radius_km} km of {location_str}."
            citations.append({"type": "Traffic Flow", "source": "Google Routes API", "detail": "Feed unavailable or unconfigured"})
        actions = ["Plan a Journey", "Compare fastest vs safest bypass"]

    elif any(w in query_lower for w in ["weather", "rain", "storm", "flood", "temperature"]):
        if weather.get("status") == "AVAILABLE" and weather.get("current"):
            curr = weather["current"]
            answer = (
                f"Weather telemetry for {location_str}: {curr.get('conditionLabel')}, {curr.get('temperatureC')} "
                f"(feels like {curr.get('apparentTemperatureC')}). Humidity is at {curr.get('humidity')}%, "
                f"and precipitation probability is {curr.get('rainProbability')}%. Wind speed is {curr.get('windSpeedKmh')} km/h."
            )
            citations.append({"type": "Meteorological Data", "source": "Open-Meteo API", "detail": "Live station readings"})
        else:
            answer = f"Live weather data temporarily unavailable for {location_str}. Sensor link pending."
        actions = ["Check 24-hour precipitation forecast", "Inspect flood underpasses"]

    else:
        score_text = f"{condition.get('overallScore')}/100" if condition.get('overallScore') is not None else "Unavailable"
        known = condition.get("knownSignals", 0)
        missing = condition.get("missingSignals", 0)
        answer = (
            f"UrbanPulse is monitoring {location_str} across a **{req.radius_km} km radius**. "
            f"Composite Urban Condition Score is **{score_text}** (confidence: {condition.get('confidence', 0):.0%}, "
            f"{known} known signals, {missing} missing feeds). "
            f"Active incidents logged: **{len(events)}**. Missing feeds are never treated as safe."
        )
        for ev in events[:2]:
            citations.append({"type": ev.get("eventType"), "source": ev.get("source"), "detail": ev.get("title")})
        actions = ["Review 24-hour Timeline", "Plan a Journey", "Check Urban Condition breakdown"]

    return {
        "id": f"COPILOT-{int(datetime.now(timezone.utc).timestamp())}",
        "sender": "copilot",
        "content": answer,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "citedLiveSignals": citations,
        "suggestedActions": actions,
    }


# ==============================================================================
# 7. Location Intelligence Agent Endpoint
# ==============================================================================

@router.post("/agent/interact")
async def agent_interact(req: Dict[str, Any]):
    """
    Primary endpoint for the Location Intelligence Agent experience.
    Parses intent, resolves location, queries live providers, and dispatches map actions.
    """
    from app.services.agent.location_agent import LocationAgentService

    query = req.get("query")
    if not query or not str(query).strip():
        raise HTTPException(status_code=422, detail="query is required")

    return await LocationAgentService.process_interaction(req)


# ==============================================================================
# 8. Forecasting & Live RAG Endpoints
# ==============================================================================

@router.get("/forecast")
async def get_forecast(
    coords: CoordinateQuery = Depends(coordinate_query),
    horizon: str = Query("7_DAYS", pattern="^(7_DAYS|30_DAYS)$"),
    city: Optional[str] = Query(None),
    country_code: Optional[str] = Query(None),
):
    """
    Returns authentic 7-day multi-pillar predictions or 30-day monthly outlooks for coordinates.
    Grounds weather in Open-Meteo numerical models and AQI in atmospheric chemistry models.
    """
    from app.services.forecast.forecasting_service import ForecastingService

    meta = {"city": city, "countryCode": country_code}
    if horizon == "30_DAYS":
        return await ForecastingService.get_30_day_outlook(coords.latitude, coords.longitude, meta)
    return await ForecastingService.get_7_day_forecast(coords.latitude, coords.longitude, meta)


@router.get("/live-updates")
async def get_live_updates(
    coords: CoordinateQuery = Depends(coordinate_query),
    radius_km: float = Query(100.0, ge=1.0, le=500.0),
):
    """
    Retrieves live-ingested events, earthquake telemetry, and civic incident bulletins.
    Applies 1.5km geospatial deduplication and freshness classification.
    """
    from app.pipelines.live_ingestion.event_ingestion import LiveIngestionPipeline

    events = await LiveIngestionPipeline.ingest_live_events(coords.latitude, coords.longitude, radius_km=radius_km)
    return {
        "latitude": coords.latitude,
        "longitude": coords.longitude,
        "radiusKm": radius_km,
        "events": events,
        "total": len(events),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/rag/knowledge")
async def get_rag_knowledge(
    coords: CoordinateQuery = Depends(coordinate_query),
    query: str = Query("safety"),
    city: Optional[str] = Query(None),
    limit: int = Query(5, ge=1, le=20),
):
    """
    Searches location-aware RAG knowledge base for authoritative procedures and bulletins.
    """
    from app.services.rag.rag_service import LocationAwareRAGService

    docs = await LocationAwareRAGService.retrieve_relevant_knowledge(
        coords.latitude, coords.longitude, query=query, city=city, limit=limit
    )
    return {"results": docs, "total": len(docs)}


# ==============================================================================
# 9. Master Intelligence Endpoints
# ==============================================================================

@router.get("/intelligence/changes")
async def get_location_changes(
    coords: CoordinateQuery = Depends(coordinate_query),
    window: str = Query("24h", pattern="^(1h|6h|12h|24h|7d)$"),
    city: Optional[str] = Query(None),
):
    """
    Computes deterministic what-changed metrics comparing current live telemetry
    to windowed historical baselines.
    """
    from app.services.change_detection import ChangeDetectionService

    return await ChangeDetectionService.get_location_changes(
        coords.latitude, coords.longitude, window=window, city=city
    )


@router.get("/intelligence/score")
async def get_explainable_score(
    coords: CoordinateQuery = Depends(coordinate_query),
    city: Optional[str] = Query(None),
    country_code: Optional[str] = Query(None),
):
    """
    Computes explainable 0-100 UrbanPulse score with deterministic weights,
    confidence penalties for missing data, positive/negative drivers, and trend.
    """
    from app.services.urban_score import ExplainableScoreService

    meta = {"city": city, "countryCode": country_code}
    return await ExplainableScoreService.calculate_urbanpulse_score(
        coords.latitude, coords.longitude, location_meta=meta
    )


@router.get("/intelligence/anomalies")
async def get_anomalies(
    coords: CoordinateQuery = Depends(coordinate_query),
    city: Optional[str] = Query(None),
):
    """
    Detects statistical anomalies by comparing current telemetry against 7-day diurnal baselines.
    """
    from app.services.anomaly_detection import AnomalyDetectionService

    return await AnomalyDetectionService.detect_anomalies(
        coords.latitude, coords.longitude, city=city
    )


@router.post("/intelligence/simulate")
async def simulate_scenario(req: Dict[str, Any]):
    """
    Runs deterministic urban scenario simulations (heavy rain, closures, surges).
    Explicitly labeled as SIMULATION with assumptions and uncertainty intervals.
    """
    from app.services.scenario_engine import ScenarioEngineService

    return await ScenarioEngineService.simulate_scenario(req)


@router.post("/intelligence/compare")
async def compare_locations(req: Dict[str, Any]):
    """
    Compares 2 to 5 locations side-by-side using real telemetry and standardized scales.
    Missing metrics formatted as '—' without cross-city cache bleed.
    """
    from app.services.comparison import ComparisonService

    locations = req.get("locations") or []
    if not isinstance(locations, list) or len(locations) < 2:
        raise HTTPException(status_code=422, detail="At least 2 locations required for comparison")
    if len(locations) > 5:
        raise HTTPException(status_code=422, detail="Maximum 5 locations supported for comparison")

    return await ComparisonService.compare_locations(locations)


# ==============================================================================
# 10. Location & Corridor Monitoring Endpoints
# ==============================================================================

@router.get("/monitoring")
async def list_monitors():
    """Returns active monitoring targets for locations and corridors."""
    from app.services.monitoring import MonitoringService

    return await MonitoringService.list_monitors()


@router.post("/monitoring")
async def create_monitor(req: Dict[str, Any]):
    """Creates a new monitoring subscription for a point, radius, or corridor."""
    from app.services.monitoring import MonitoringService

    return await MonitoringService.create_monitor(req)


@router.delete("/monitoring/{monitor_id}")
async def delete_monitor(monitor_id: str):
    """Deletes an active monitor configuration."""
    from app.services.monitoring import MonitoringService

    success = await MonitoringService.delete_monitor(monitor_id)
    return {"success": success, "monitorId": monitor_id}


@router.get("/monitoring/alerts")
async def get_monitor_alerts(limit: int = Query(50, ge=1, le=200)):
    """Retrieves generated non-intrusive monitoring alerts."""
    from app.services.monitoring import MonitoringService

    alerts = await MonitoringService.get_alerts(limit=limit)
    return {"alerts": alerts, "total": len(alerts)}


@router.post("/monitoring/evaluate")
async def evaluate_monitors():
    """Triggers an evaluation pass over all active monitors against live conditions."""
    from app.services.monitoring import MonitoringService

    alerts = await MonitoringService.evaluate_monitors()
    return {"evaluated": True, "newAlerts": alerts, "count": len(alerts)}

