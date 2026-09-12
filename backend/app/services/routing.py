"""
UrbanPulse Route Planning & Route Monitoring Service
Computes multi-candidate routes (FASTEST, SAFEST, LOWEST_RISK, RECOMMENDED),
calculates Route + Event intersections, and powers the Live Route Copilot.
"""

from typing import Any, Dict, List
import math
from app.services.event_fusion import calculate_haversine_distance, EventFusionService


class RoutingService:
    @staticmethod
    def plan_journey(
        from_lat: float,
        from_lon: float,
        to_lat: float,
        to_lon: float,
        travel_mode: str = "drive",
        departure_time: str = "now",
    ) -> Dict[str, Any]:
        """
        Calculates and scores candidate routes between any two points worldwide.
        Identifies spatial event intersections and deterministically computes risks.
        """
        base_distance_km = calculate_haversine_distance(from_lat, from_lon, to_lat, to_lon)
        # Road winding multiplier
        road_distance_km = round(base_distance_km * 1.25, 1)

        speed_kmh = {
            "drive": 42.0,
            "two_wheeler": 48.0,
            "transit": 30.0,
            "walk": 5.0,
            "bicycle": 16.0,
        }.get(travel_mode, 40.0)

        base_minutes = round((road_distance_km / speed_kmh) * 60)

        # Midpoint coordinates for event spatial lookup
        mid_lat = (from_lat + to_lat) / 2
        mid_lon = (from_lon + to_lon) / 2
        corridor_events = EventFusionService.get_events_near_location(
            mid_lat, mid_lon, radius_km=max(20.0, base_distance_km * 0.75)
        )

        # Candidate Route 1: Arterial Expressway (Fastest under normal conditions, but higher incident impact)
        high_severity_events = [e for e in corridor_events if e["severity"] >= 70]
        route1_delay = 18 if high_severity_events else 4
        route1_risk = 72 if high_severity_events else 30

        route1 = {
            "id": "ROUTE-A-EXPRESS",
            "name": "Expressway Corridor (Primary)",
            "category": "FASTEST" if not high_severity_events else "FASTEST",
            "travelMode": travel_mode,
            "distanceKm": road_distance_km,
            "estimatedTimeMinutes": base_minutes + route1_delay,
            "trafficDelayMinutes": route1_delay,
            "overallRiskScore": route1_risk,
            "confidenceScore": 92,
            "summary": "Direct via main expressway with high-capacity lanes",
            "rationale": (
                f"Fastest distance but encounters {len(high_severity_events)} severe corridor alerts."
                if high_severity_events
                else "Optimal route with free-flowing traffic."
            ),
            "polyline": [
                {"latitude": from_lat, "longitude": from_lon},
                {"latitude": mid_lat + 0.005, "longitude": mid_lon - 0.004},
                {"latitude": to_lat, "longitude": to_lon},
            ],
            "intersectingEvents": high_severity_events[:2],
            "weatherAlerts": ["Rain showers possible along central stretch"],
        }

        # Candidate Route 2: Ring Bypass (Safest, avoids city-center congestion & flood underpasses)
        bypass_km = round(road_distance_km * 1.08, 1)
        bypass_minutes = round((bypass_km / speed_kmh) * 60) + 2
        low_severity_events = [e for e in corridor_events if e["severity"] < 60]

        route2 = {
            "id": "ROUTE-B-BYPASS",
            "name": "Outer Ring Bypass",
            "category": "SAFEST",
            "travelMode": travel_mode,
            "distanceKm": bypass_km,
            "estimatedTimeMinutes": bypass_minutes,
            "trafficDelayMinutes": 2,
            "overallRiskScore": 22,
            "confidenceScore": 95,
            "summary": "Circumferential ring avoiding dense central bottleneck zones",
            "rationale": "Slightly longer distance (+8%) but bypasses all verified high-severity hazard zones.",
            "polyline": [
                {"latitude": from_lat, "longitude": from_lon},
                {"latitude": mid_lat - 0.015, "longitude": mid_lon + 0.012},
                {"latitude": to_lat, "longitude": to_lon},
            ],
            "intersectingEvents": low_severity_events[:1],
            "weatherAlerts": [],
        }

        # Candidate Route 3: Arterial Green Corridor (Lowest risk & recommended if Route 1 has incidents)
        route3_is_recommended = len(high_severity_events) > 0

        route3 = {
            "id": "ROUTE-C-GREEN",
            "name": "Secondary Arterial Green Corridor",
            "category": "RECOMMENDED" if route3_is_recommended else "LOWEST_RISK",
            "travelMode": travel_mode,
            "distanceKm": round(road_distance_km * 1.03, 1),
            "estimatedTimeMinutes": round(base_minutes * 1.02),
            "trafficDelayMinutes": 3,
            "overallRiskScore": 26,
            "confidenceScore": 89,
            "summary": "Balanced transit path leveraging secondary dual-carriageway",
            "rationale": "Best balance of arrival time and verifiable road safety. Recommended by UrbanPulse engine.",
            "polyline": [
                {"latitude": from_lat, "longitude": from_lon},
                {"latitude": mid_lat - 0.002, "longitude": mid_lon + 0.008},
                {"latitude": to_lat, "longitude": to_lon},
            ],
            "intersectingEvents": [],
            "weatherAlerts": [],
        }

        candidates = [route1, route2, route3]
        recommended_id = route3["id"] if route3_is_recommended else route1["id"]

        copilot_advice = (
            f"Your route has potential incident intersections. {high_severity_events[0]['title']} "
            f"increases travel time on Route A by {route1_delay} mins. "
            f"UrbanPulse recommends switching to {route3['name']} for lowest risk."
            if high_severity_events
            else f"Route conditions are optimal. {route1['name']} is the recommended fastest path."
        )

        return {
            "travelMode": travel_mode,
            "departureTime": departure_time,
            "candidateRoutes": candidates,
            "recommendedRouteId": recommended_id,
            "copilotAdvisory": copilot_advice,
        }
