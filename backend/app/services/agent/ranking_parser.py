"""
UrbanPulse Ranking Query Parser
===============================
Parses natural language ranking and comparison questions into structured RankingRequest models.
Handles:
- Domain metrics: AQI, TRAFFIC, POPULATION, TEMPERATURE (hottest / coolest)
- Entity types: CITY, STATE, COUNTRY, DISTRICT
- Scopes: WORLD, INDIA, USA, specific States/Provinces (e.g. Karnataka, California)
- Natural language limits: "top 5", "top 10", "top 3", "top 20" (defaults to 10)
- Natural language sort orders: DESC (worst AQI, worst traffic, hottest, most populated) vs ASC (coolest, best AQI, least populated)
- Follow-up modifications: "Make it top 5", "Now show coolest", "Do it for the world", "Top 5 states", "Now show traffic"
- Entity why-ranked explanations: "Why is Bengaluru #3?", "Why is Delhi #1?"
- Map marker display requests: "Show them on the map", "Plot them on the map"
"""

import re
from typing import Optional, Tuple, Dict, Any
from app.schemas.ranking_schema import (
    RankingRequest,
    RankingResponse,
    RankingMetricType,
    RankingEntityType,
    RankingOrder,
)


class RankingQueryParser:
    """
    Zero-failure, heuristic natural-language parser for multi-domain ranking queries.
    """

    MAP_PLOT_PATTERNS = [
        r"\b(?:show|plot|display|pin|render|view|put|see)\s+(?:them|these|the\s+results|markers?|pins?|cities|states|countries)?\s*(?:on\s+(?:the\s+)?map)\b",
        r"\bshow\s+on\s+map\b",
        r"\bmap\s+(?:them|these|the\s+results|it)\b",
        r"\bplot\s+on\s+map\b",
    ]

    WHY_RANKED_PATTERNS = [
        # "why is Bengaluru #3", "why is Bengaluru ranked 3", "why is Bengaluru number 3"
        r"why\s+is\s+([a-zA-Z\s.-]+?)\s+(?:#|ranked|at\s+rank|rank|number|no\.?)\s*(\d+)",
        # "why is Bengaluru at #3"
        r"why\s+is\s+([a-zA-Z\s.-]+?)\s+at\s+#?\s*(\d+)",
        # "why is Bengaluru third / #3 / ranked so high"
        r"why\s+is\s+([a-zA-Z\s.-]+?)\s+(?:#(\d+)|ranked|in\s+top|at\s+the\s+top|so\s+high|so\s+low|worst|best)",
        # "why #3", "why rank 3", "explain #3", "explain rank 2"
        r"(?:why|explain)\s+(?:#|rank|number|no\.?)\s*(\d+)",
        # "why is #3 Bengaluru"
        r"why\s+is\s+#(\d+)\s+([a-zA-Z\s.-]+)",
    ]

    RANKING_TRIGGER_WORDS = [
        "top", "worst", "best", "hottest", "coolest", "coldest", "warmest",
        "most populated", "least populated", "highest population", "lowest population", "most populous",
        "highest aqi", "lowest aqi", "most polluted", "least polluted", "cleanest",
        "worst traffic", "most traffic", "highest traffic", "slowest traffic", "most congested",
        "rank", "ranking", "rankings", "highest", "lowest", "which are the", "which countries", "which cities", "which states"
    ]

    @classmethod
    def is_map_plot_request(cls, query: str) -> bool:
        q = query.strip().lower()
        for pat in cls.MAP_PLOT_PATTERNS:
            if re.search(pat, q):
                return True
        return False

    @classmethod
    def is_why_ranked_request(cls, query: str) -> Tuple[bool, Optional[str], Optional[int]]:
        """
        Detects if query is asking why a specific entity holds its rank.
        Returns: (is_why_query, entity_name_or_none, rank_number_or_none)
        """
        q = query.strip()
        for pat in cls.WHY_RANKED_PATTERNS:
            m = re.search(pat, q, re.IGNORECASE)
            if m:
                groups = m.groups()
                if len(groups) == 2:
                    val1, val2 = groups[0].strip(), groups[1].strip()
                    if val2.isdigit():
                        return True, val1, int(val2)
                    elif val1.isdigit():
                        return True, val2, int(val1)
                    else:
                        return True, val1, None
                elif len(groups) == 1:
                    val = groups[0].strip()
                    if val.isdigit():
                        return True, None, int(val)
                    else:
                        return True, val, None
        return False, None, None

    @classmethod
    def is_ranking_query(cls, query: str, has_active_ranking: bool = False) -> bool:
        """
        Checks if the natural language query is a ranking inquiry or follow-up.
        """
        q = query.strip().lower()

        if cls.is_map_plot_request(q):
            return has_active_ranking

        why_match, _, _ = cls.is_why_ranked_request(q)
        if why_match:
            return True

        # Explicit ranking triggers
        if any(trigger in q for trigger in cls.RANKING_TRIGGER_WORDS):
            # Check if domain signals or entity signals are present
            has_metric = any(m in q for m in ["aqi", "air", "pollution", "traffic", "congestion", "populated", "population", "temperature", "temp", "hottest", "coolest", "coldest", "warmest", "heat", "cold"])
            has_entity = any(e in q for e in ["city", "cities", "state", "states", "country", "countries", "province", "provinces", "district", "districts", "place", "places", "in the world", "in india", "in usa"])
            has_top_n = bool(re.search(r"\btop\s+\d+\b", q))

            if has_metric or has_entity or has_top_n:
                return True

        # Follow-up triggers when ranking context is active
        if has_active_ranking:
            # "make it top 5", "top 5", "now show coolest", "do it for the world", "top 5 states", "now show traffic"
            has_followup_signal = any(m in q for m in [
                "top", "bottom", "coolest", "coldest", "hottest", "warmest", "worst", "best",
                "highest", "lowest", "aqi", "traffic", "temperature", "temp", "population",
                "world", "india", "usa", "state", "states", "city", "cities", "country", "countries"
            ]) or bool(re.search(r"\b\d+\b", q))

            if re.search(r"^(?:make it|show|do it for|now show|now|what about|switch to|and)\s+", q) and has_followup_signal:
                return True
            if re.search(r"^top\s+\d+$", q):
                return True
            if q in ["coolest", "coldest", "hottest", "worst", "best", "traffic", "aqi", "temperature", "population", "world", "india", "usa"]:
                return True
            if any(w in q for w in ["for the world", "in the world", "in india", "in usa", "in karnataka", "show coolest", "show hottest", "top states", "top countries", "top cities"]):
                return True

        return False

    @classmethod
    def parse(cls, query: str, active_ranking: Optional[RankingResponse] = None) -> RankingRequest:
        """
        Parses query into typed RankingRequest, inheriting context from active_ranking if follow-up.
        """
        q = query.strip()
        q_lower = q.lower()

        # 1. Determine Metric
        metric: RankingMetricType = "AQI"
        metric_detected = False

        if any(w in q_lower for w in ["traffic", "congestion", "congested", "bottleneck", "delay", "delays", "slowest"]):
            metric = "TRAFFIC"
            metric_detected = True
        elif any(w in q_lower for w in ["population", "populated", "populous", "residents", "inhabitants", "people"]):
            metric = "POPULATION"
            metric_detected = True
        elif any(w in q_lower for w in ["temperature", "temp", "hottest", "coolest", "coldest", "warmest", "heat", "cold"]):
            metric = "TEMPERATURE"
            metric_detected = True
        elif any(w in q_lower for w in ["aqi", "air quality", "pollution", "polluted", "smog", "clean air", "cleanest"]):
            metric = "AQI"
            metric_detected = True
        elif active_ranking:
            metric = active_ranking.metric
            metric_detected = True

        # 2. Determine Entity Type
        entity_type: RankingEntityType = "CITY"
        entity_detected = False

        if any(w in q_lower for w in ["which countries", "what countries", "top countries", "countries", "nations"]):
            entity_type = "COUNTRY"
            entity_detected = True
        elif any(w in q_lower for w in ["state", "states", "province", "provinces"]):
            entity_type = "STATE"
            entity_detected = True
        elif any(w in q_lower for w in ["district", "districts"]):
            entity_type = "DISTRICT"
            entity_detected = True
        elif any(w in q_lower for w in ["city", "cities", "town", "towns", "places", "place", "metros"]):
            entity_type = "CITY"
            entity_detected = True
        elif active_ranking and not entity_detected:
            entity_type = active_ranking.entityType

        # Special query handling: "Which countries currently have the hottest cities?"
        # If user asks "Which countries currently have the hottest cities?", entity is COUNTRY (or CITY in WORLD).
        # Supporting COUNTRY directly yields top countries by heat.
        if "which countries" in q_lower or "countries currently have" in q_lower:
            entity_type = "COUNTRY"

        # 3. Determine Geographic Scope
        scope: str = "INDIA"
        scope_detected = False

        if any(w in q_lower for w in ["world", "globally", "global", "planet", "earth", "all countries", "international"]):
            scope = "WORLD"
            scope_detected = True
        elif any(w in q_lower for w in ["india", "indian", "bharat"]):
            scope = "INDIA"
            scope_detected = True
        elif any(w in q_lower for w in ["usa", "united states", "america", "us"]):
            scope = "USA"
            scope_detected = True
        else:
            # Check for known states
            states = [
                "karnataka", "maharashtra", "tamil nadu", "uttar pradesh", "gujarat",
                "kerala", "rajasthan", "delhi", "punjab", "haryana", "west bengal",
                "california", "texas", "florida", "new york", "illinois", "washington"
            ]
            for s in states:
                if re.search(rf"\b{s}\b", q_lower):
                    scope = s.title()
                    scope_detected = True
                    break

        if not scope_detected:
            if active_ranking:
                scope = active_ranking.scope
            elif entity_type == "COUNTRY":
                scope = "WORLD"
            else:
                scope = "INDIA"

        # 4. Determine Limit (Count)
        limit = 10
        limit_match = re.search(r"\b(?:top|first|limit\s+to|show|list|make\s+it\s+top)\s+(\d+)\b", q_lower)
        if not limit_match:
            limit_match = re.search(r"\b(\d+)\s+(?:worst|best|hottest|coolest|most|least|cities|states|countries)\b", q_lower)

        if limit_match:
            try:
                limit = int(limit_match.group(1))
                limit = max(1, min(50, limit))
            except ValueError:
                limit = 10
        elif active_ranking and any(w in q_lower for w in ["make it", "limit to"]):
            limit = active_ranking.limit
        elif active_ranking and not metric_detected and not scope_detected and not entity_detected:
            limit = active_ranking.limit

        # 5. Determine Sort Order
        # Default orders:
        # AQI: DESC (worst first)
        # Traffic: DESC (most congested first)
        # Population: DESC (most populated first)
        # Temperature: DESC (hottest first) unless "coolest" / "coldest" requested
        order: RankingOrder = "DESC"

        if any(w in q_lower for w in ["coolest", "coldest", "cool", "cold", "lowest temperature", "cleanest", "best aqi", "lowest aqi", "least congested", "fastest", "least populated", "lowest population", "smallest"]):
            order = "ASC"
        elif any(w in q_lower for w in ["hottest", "hot", "warmest", "highest temperature", "worst", "most polluted", "highest aqi", "most congested", "slowest", "most populated", "highest population", "biggest"]):
            order = "DESC"
        elif active_ranking and any(w in q_lower for w in ["coolest", "coldest"]):
            order = "ASC"
        elif active_ranking and any(w in q_lower for w in ["hottest", "warmest"]):
            order = "DESC"
        elif active_ranking and not metric_detected:
            order = active_ranking.order

        # 6. SubMetric Determination
        sub_metric: Optional[str] = None
        if metric == "TEMPERATURE":
            sub_metric = "MIN_TEMP" if order == "ASC" else "MAX_TEMP"
        elif metric == "TRAFFIC":
            sub_metric = "CONGESTION_RATIO"
        elif metric == "POPULATION":
            sub_metric = "COUNT"

        return RankingRequest(
            metric=metric,
            entityType=entity_type,
            scope=scope,
            limit=limit,
            order=order,
            timeWindow="CURRENT",
            subMetric=sub_metric,
        )
