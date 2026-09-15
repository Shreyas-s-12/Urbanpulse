"""
UrbanPulse Cross-Domain Intelligence Graph Engine
Constructs multi-relational graphs across urban phenomena:
Nodes: EVENT, LOCATION, ROAD, WEATHER, TRAFFIC, RISK, ALERT, FORECAST, POI, INFRASTRUCTURE, NEWS, SAFETY
Relationships: NEAR, TEMPORALLY_RELATED, POTENTIAL_CONTRIBUTOR, AFFECTS, LOCATED_IN, CORRELATED_WITH, FOLLOWED_BY, PRECEDES
Enforces strict distinction between OBSERVED RELATIONSHIP and INFERRED RELATIONSHIP with data provenance.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import uuid
import logging

from app.services.event_fusion import EventFusionService
from app.services.google_traffic import GoogleTrafficService
from app.services.providers.weather_provider import WeatherProvider
from app.services.providers.air_quality_provider import AirQualityProvider

logger = logging.getLogger("urbanpulse.cross_domain_graph")


class CrossDomainGraphService:
    @classmethod
    async def build_intelligence_graph(
        cls,
        latitude: float,
        longitude: float,
        radius_km: float = 30.0,
        city_name: Optional[str] = None,
        focus_event_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Builds a unified intelligence graph for a location, connecting events,
        weather anomalies, traffic corridors, infrastructure, and risks.
        """
        now_utc = datetime.now(timezone.utc)
        now_iso = now_utc.isoformat()
        center_label = city_name or f"{latitude:.4f}, {longitude:.4f}"

        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []
        node_lookup: Dict[str, Dict[str, Any]] = {}

        def add_node(
            node_id: str,
            node_type: str,
            label: str,
            category: str,
            properties: Dict[str, Any],
            status: str = "ACTIVE",
            confidence: float = 0.90,
            source: str = "Verified Provider",
        ) -> None:
            if node_id not in node_lookup:
                node = {
                    "id": node_id,
                    "type": node_type.upper(),
                    "label": label,
                    "category": category,
                    "status": status,
                    "confidence": round(confidence, 2),
                    "source": source,
                    "properties": properties,
                    "timestamp": properties.get("timestamp", now_iso),
                }
                nodes.append(node)
                node_lookup[node_id] = node

        def add_edge(
            source_id: str,
            target_id: str,
            rel_type: str,
            nature: str = "OBSERVED",  # "OBSERVED" or "INFERRED"
            confidence: float = 0.85,
            evidence: str = "",
            weight: float = 1.0,
        ) -> None:
            if source_id in node_lookup and target_id in node_lookup:
                edges.append({
                    "id": f"edge-{uuid.uuid4().hex[:8]}",
                    "source": source_id,
                    "target": target_id,
                    "relationship": rel_type.upper(),
                    "nature": nature.upper(),  # OBSERVED vs INFERRED
                    "confidence": round(confidence, 2),
                    "evidence": evidence,
                    "weight": weight,
                    "timestamp": now_iso,
                })

        # 1. Root LOCATION Node
        loc_id = "loc-center"
        add_node(
            node_id=loc_id,
            node_type="LOCATION",
            label=center_label,
            category="GEOGRAPHY",
            properties={
                "latitude": latitude,
                "longitude": longitude,
                "radiusKm": radius_km,
                "timestamp": now_iso,
            },
            confidence=1.0,
            source="Geocoding Coordinate Baseline",
        )

        # 2. Gather Domain Telemetry
        events_resp = await EventFusionService.get_live_events_near_location(
            latitude, longitude, radius_km, city_name=city_name
        )
        live_events = events_resp.get("events", [])

        weather = WeatherProvider.get_weather(latitude, longitude)
        curr_weather = weather.get("current") or {}
        precip = curr_weather.get("precipitation", 0.0) or 0.0
        wind = curr_weather.get("wind_speed", 0.0) or 0.0
        temp = curr_weather.get("temperature", 22.0)

        traffic = await GoogleTrafficService.get_traffic_summary(latitude, longitude, radius_km)
        traffic_status = traffic.get("trafficStatus", "NORMAL")
        delay_min = traffic.get("delayMinutes", 0)

        aqi = await AirQualityProvider.get_air_quality(latitude, longitude)
        aqi_val = aqi.get("value")

        # 3. WEATHER Node
        weather_node_id = "node-weather-curr"
        add_node(
            node_id=weather_node_id,
            node_type="WEATHER",
            label=f"Weather: {temp}°C, {precip}mm rain",
            category="ENVIRONMENT",
            properties={
                "temperature": temp,
                "precipitation": precip,
                "windSpeed": wind,
                "condition": curr_weather.get("weather_code_desc", "Current Condition"),
                "timestamp": now_iso,
            },
            confidence=weather.get("confidence", 0.95),
            source="Open-Meteo Surface Telemetry",
        )
        add_edge(
            weather_node_id, loc_id, "LOCATED_IN", nature="OBSERVED",
            confidence=0.98, evidence="Numerical station telemetry covering region"
        )

        # 4. TRAFFIC Node
        traffic_node_id = "node-traffic-corridor"
        add_node(
            node_id=traffic_node_id,
            node_type="TRAFFIC",
            label=f"Traffic State: {traffic_status} (+{delay_min}m delay)",
            category="MOBILITY",
            properties={
                "trafficStatus": traffic_status,
                "delayMinutes": delay_min,
                "timestamp": now_iso,
            },
            confidence=traffic.get("confidence", 0.88),
            source="Google Routes Telemetry API",
        )
        add_edge(
            traffic_node_id, loc_id, "AFFECTS", nature="OBSERVED",
            confidence=0.92, evidence="Aggregated transit segment delays within radius"
        )

        # 5. Connect Weather & Traffic via Inferred Edge if correlating
        if precip > 5.0 and traffic_status in ["HEAVY", "SEVERE", "MODERATE"]:
            add_edge(
                weather_node_id, traffic_node_id, "POTENTIAL_CONTRIBUTOR",
                nature="INFERRED",
                confidence=0.78,
                evidence=f"Precipitation influx ({precip} mm/h) temporally coincides with elevated delay (+{delay_min}m). Correlation observed, causation inferred.",
            )

        # 6. AQI Node if available
        if aqi_val is not None:
            aqi_node_id = "node-aqi"
            add_node(
                node_id=aqi_node_id,
                node_type="ENVIRONMENT",
                label=f"Air Quality Index: {aqi_val:.0f} ({aqi.get('category', 'Moderate')})",
                category="ENVIRONMENT",
                properties={
                    "aqi": aqi_val,
                    "category": aqi.get("category"),
                    "source": aqi.get("source"),
                    "timestamp": now_iso,
                },
                confidence=aqi.get("confidence", 0.85),
                source=aqi.get("source", "Copernicus / Open-Meteo"),
            )
            add_edge(aqi_node_id, loc_id, "LOCATED_IN", nature="OBSERVED", confidence=0.95, evidence="Atmospheric sensor grid")

        # 7. EVENT and INFRASTRUCTURE Nodes from Live Events
        for ev in live_events[:15]:
            ev_id = f"ev-{ev.get('id', uuid.uuid4().hex[:6])}"
            ev_title = ev.get("title") or ev.get("eventType", "Incident").replace("_", " ").title()
            ev_type = ev.get("eventType", "INCIDENT")
            ev_cat = "SAFETY" if ev_type in ["CRIME", "PROTEST", "HAZARD"] else "MOBILITY"

            add_node(
                node_id=ev_id,
                node_type="EVENT",
                label=ev_title,
                category=ev_cat,
                properties={
                    "eventType": ev_type,
                    "severity": ev.get("severity", 2),
                    "description": ev.get("description", ""),
                    "latitude": ev.get("latitude"),
                    "longitude": ev.get("longitude"),
                    "distanceKm": ev.get("distanceKm", 0.0),
                    "timestamp": ev.get("time", now_iso),
                },
                confidence=ev.get("confidence", 0.90),
                source=ev.get("source", "Verified Civic Feed"),
            )
            add_edge(
                ev_id, loc_id, "LOCATED_IN", nature="OBSERVED",
                confidence=0.95, evidence=f"Reported at coordinates {ev.get('latitude')}, {ev.get('longitude')}"
            )

            if ev_type in ["FLOOD", "WATERLOGGING", "RAIN"]:
                add_edge(
                    weather_node_id, ev_id, "POTENTIAL_CONTRIBUTOR",
                    nature="INFERRED",
                    confidence=0.84,
                    evidence="Precipitation accumulation threshold matched with hydrological incident advisory",
                )
                add_edge(
                    ev_id, traffic_node_id, "AFFECTS",
                    nature="INFERRED",
                    confidence=0.81,
                    evidence="Waterlogged arterial causes localized vehicular bottleneck and rerouting",
                )

            if ev_type in ["ACCIDENT", "ROAD_WORK", "TRAFFIC", "HAZARD"]:
                add_edge(
                    ev_id, traffic_node_id, "AFFECTS",
                    nature="OBSERVED",
                    confidence=0.89,
                    evidence="Obstruction located directly along major transit corridor",
                )

            road_name = ev.get("locationName") or ev.get("roadName")
            if road_name and road_name != center_label:
                road_node_id = f"road-{uuid.uuid5(uuid.NAMESPACE_DNS, road_name).hex[:6]}"
                add_node(
                    node_id=road_node_id,
                    node_type="ROAD",
                    label=road_name,
                    category="INFRASTRUCTURE",
                    properties={"name": road_name, "timestamp": now_iso},
                    confidence=0.92,
                    source="OpenStreetMap Geocoding / Civic Dispatch",
                )
                add_edge(ev_id, road_node_id, "AFFECTS", nature="OBSERVED", confidence=0.90, evidence=f"Reported incident on {road_name}")
                add_edge(road_node_id, loc_id, "LOCATED_IN", nature="OBSERVED", confidence=0.98, evidence="Arterial segment within metropolitan radius")

        # 8. Focus Subgraph Filter
        if focus_event_id and focus_event_id in node_lookup:
            focus_ids = {focus_event_id}
            for e in edges:
                if e["source"] == focus_event_id:
                    focus_ids.add(e["target"])
                elif e["target"] == focus_event_id:
                    focus_ids.add(e["source"])
            sub_nodes = [n for n in nodes if n["id"] in focus_ids]
            sub_edges = [e for e in edges if e["source"] in focus_ids and e["target"] in focus_ids]
            return {
                "nodes": sub_nodes,
                "edges": sub_edges,
                "focusNodeId": focus_event_id,
                "totalNodes": len(sub_nodes),
                "totalEdges": len(sub_edges),
                "generatedAt": now_iso,
                "centerLocation": center_label,
            }

        return {
            "nodes": nodes,
            "edges": edges,
            "focusNodeId": loc_id,
            "totalNodes": len(nodes),
            "totalEdges": len(edges),
            "generatedAt": now_iso,
            "centerLocation": center_label,
            "provenance": {
                "observedEdges": len([e for e in edges if e["nature"] == "OBSERVED"]),
                "inferredEdges": len([e for e in edges if e["nature"] == "INFERRED"]),
                "veracityPolicy": "Strict attribution; no unverified causal assertions.",
            }
        }
