"""
Structured Query Interpreter, Follow-Up ScenarioContext Manager, and Dynamic Location Resolver
for the UrbanPulse Scenario Intelligence Engine (Sections 1–13, 21–24).

Guarantees:
1. NEVER sends a raw natural-language sentence (e.g. "What could happen if rainfall reaches 50 mm in 3 hours in Mysuru?")
   to GeocodingProvider.
2. Separates scenario parameters (intensity, unit, duration, relative date/year, hazard category)
   from geographic location phrases BEFORE resolving coordinates.
3. Maintains ScenarioContext across turns to support conversational follow-ups:
   - "What about Bengaluru?" -> inherits scenarioType, intensity, unit, duration; updates location = Bengaluru
   - "What about 100 mm?" -> inherits location, scenarioType, duration; updates intensity = 100 mm
4. Implements 4-tier location priority:
   (1) Explicit location in current query
   (2) Selected map/POI location (selectedMapEntity, e.g. Mysore Palace)
   (3) Active location context (current_loc or ScenarioContext)
   (4) Ask for clarification only when none exists
"""

from datetime import datetime, timedelta, timezone
import math
import re
from typing import Any, Dict, List, Optional, Tuple

from app.services.providers.geocoding_provider import GeocodingProvider
from app.services.scenario.models import (
    ResolvedLocation,
    ScenarioCategory,
    ScenarioContext,
    ScenarioDefinition,
)
from app.services.scenario.registry import ScenarioRegistry


class ScenarioParser:
    """
    Parses natural-language scenario queries and follow-ups into validated ScenarioDefinition objects,
    maintaining session-level ScenarioContext and resolving canonical coordinates AFTER parsing.
    """

    _SESSION_CONTEXTS: Dict[str, ScenarioContext] = {}
    _LAST_CONTEXT: Optional[ScenarioContext] = None

    # Units & Intensity regex patterns (preserves user unit while normalizing internally)
    _INTENSITY_PATTERNS: List[Tuple[re.Pattern, str]] = [
        # Magnitude e.g. "magnitude 6.5", "Mw 6.5", "6.5 magnitude"
        (re.compile(r"(?:magnitude|mw|richter)\s*[:=]?\s*(\d+(?:\.\d+)?)", re.IGNORECASE), "Mw"),
        (re.compile(r"(\d+(?:\.\d+)?)\s*(?:magnitude|mw|richter)\b", re.IGNORECASE), "Mw"),
        # Temperature °C or °F
        (re.compile(r"([+-]?\d+(?:\.\d+)?)\s*°?\s*(?:f|fahrenheit|degrees\s*fahrenheit|degrees\s*f)\b", re.IGNORECASE), "°F"),
        (re.compile(r"([+-]?\d+(?:\.\d+)?)\s*°?\s*(?:c|celsius|degrees\s*celsius|degrees\s*c)\b", re.IGNORECASE), "°C"),
        (re.compile(r"([+-]?\d+(?:\.\d+)?)\s*°\b", re.IGNORECASE), "°C"),
        # Rainfall rate & depth: mm/hr, mm/h, mm, cm, litres, liters
        (re.compile(r"(\d+(?:\.\d+)?)\s*(mm/hr|mm/h)\b", re.IGNORECASE), "mm/hr"),
        (re.compile(r"(\d+(?:\.\d+)?)\s*(mm)\b", re.IGNORECASE), "mm"),
        (re.compile(r"(\d+(?:\.\d+)?)\s*(cm)\b", re.IGNORECASE), "cm"),
        (re.compile(r"(\d+(?:\.\d+)?)\s*(litres|liters|l/m2)\b", re.IGNORECASE), "litres"),
        # Wind speeds: km/h, m/s, mph, knots
        (re.compile(r"(\d+(?:\.\d+)?)\s*(km/h|kmph|kph)\b", re.IGNORECASE), "km/h"),
        (re.compile(r"(\d+(?:\.\d+)?)\s*(m/s)\b", re.IGNORECASE), "m/s"),
        (re.compile(r"(\d+(?:\.\d+)?)\s*(mph)\b", re.IGNORECASE), "mph"),
        (re.compile(r"(\d+(?:\.\d+)?)\s*(knots|kt)\b", re.IGNORECASE), "knots"),
        # Water level / surge rate or height: meters/hour, meters, metres, m
        (re.compile(r"(\d+(?:\.\d+)?)\s*(meters/hour|metres/hour|m/hr|m/h)\b", re.IGNORECASE), "meters/hour"),
        (re.compile(r"(\d+(?:\.\d+)?)\s*(?:meters|metres|meter|metre|m)\b(?!\s*(?:m|s|/s))", re.IGNORECASE), "m"),
        # Air quality index: AQI
        (re.compile(r"(?:aqi|index)\s*(?:of|at|reaches)?\s*(\d+(?:\.\d+)?)", re.IGNORECASE), "AQI"),
        (re.compile(r"(\d+(?:\.\d+)?)\s*aqi\b", re.IGNORECASE), "AQI"),
        # Percentage: %
        (re.compile(r"([+-]?\d+(?:\.\d+)?)\s*%", re.IGNORECASE), "%"),
    ]

    _DURATION_PATTERN = re.compile(
        r"(?:\b(?:in|within|over|for|lasting|during|across)\s+)?(\d+(?:\.\d+)?)\s*[- ]?"
        r"(minute|minutes|min|mins|hour|hours|hr|hrs|h|day|days|week|weeks|month|months)\b",
        re.IGNORECASE,
    )

    _RADIUS_PATTERN = re.compile(
        r"(?:within|radius|around)\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*(km|kilometers|kilometres)\b",
        re.IGNORECASE,
    )

    _COORDS_PATTERN = re.compile(r"(-?\d{1,2}\.\d{2,})\s*[,/]\s*(-?\d{1,3}\.\d{2,})")

    # Expressions that mean "use active/selected location context" rather than a city name
    _CONTEXT_LOCATION_EXPRESSIONS = {
        "here",
        "this location",
        "this city",
        "this region",
        "this area",
        "this coastline",
        "this neighborhood",
        "selected location",
        "the selected location",
        "the selected point",
        "near the selected point",
        "around this location",
        "near this location",
        "in this region",
        "around this region",
        "in this area",
        "in this city",
        "current location",
        "my location",
        "near me",
        "around me",
    }

    @classmethod
    def get_scenario_context(cls, session_id: str = "default") -> Optional[ScenarioContext]:
        return cls._SESSION_CONTEXTS.get(session_id) or cls._LAST_CONTEXT

    @classmethod
    def update_scenario_context(cls, defn: ScenarioDefinition, session_id: str = "default") -> ScenarioContext:
        ctx = ScenarioContext(
            intent="SCENARIO_ANALYSIS",
            scenarioType=defn.scenarioType,
            location=defn.location,
            latitude=defn.latitude,
            longitude=defn.longitude,
            intensity=defn.intensity,
            unit=defn.unit,
            displayIntensity=defn.displayIntensity,
            duration=defn.durationValue,
            durationUnit=defn.durationUnit,
            durationHours=defn.durationHours,
            durationMinutes=defn.durationMinutes,
            durationSeconds=defn.durationSeconds,
            displayDuration=defn.displayDuration,
            targetDate=defn.targetDate,
            targetYear=defn.targetYear,
            radius=defn.radius,
        )
        cls._SESSION_CONTEXTS[session_id] = ctx
        cls._LAST_CONTEXT = ctx
        return ctx

    @classmethod
    def reset_scenario_context(cls, session_id: Optional[str] = None) -> None:
        if session_id:
            cls._SESSION_CONTEXTS.pop(session_id, None)
        else:
            cls._SESSION_CONTEXTS.clear()
            cls._LAST_CONTEXT = None

    @classmethod
    def is_scenario_follow_up(cls, query: str, session_id: str = "default") -> bool:
        """
        Detects if a short follow-up query like 'What about Bengaluru?' or 'What about 100 mm?'
        or 'And for 6 hours?' should inherit from the active ScenarioContext.
        """
        ctx = cls.get_scenario_context(session_id)
        if not ctx:
            return False
        q = (query or "").strip().lower()
        if re.match(r"^(?:what\s+about|how\s+about|and\s+what\s+about|and\s+in|and\s+for|what\s+if\s+it\s+is|what\s+if\s+it\s+reaches|try\s+with)\b", q):
            return True
        return False

    @classmethod
    def extract_clean_location_phrase(cls, query: str) -> Tuple[Optional[str], bool]:
        """
        Separates location phrases from scenario, intensity, duration, temporal, and hazard action phrases.
        Returns (extracted_location_name, is_context_reference).
        Supports:
        - Spatial prepositions: "in Bengaluru", "around Mangalore", "across Tokyo", "for Rotterdam"
        - Hazard action verbs: "if a cyclone hits Chennai", "earthquake strikes Delhi", "extreme heat affects Delhi"
        - Location subject syntax: "if Bangalore experiences a major earthquake"
        - Clean stripping of questions, durations, and temporal clauses ("right now", "today", "what should we do").
        """
        if not query or not query.strip():
            return None, False

        q = query.strip().rstrip("?.!,;")

        # 1. Follow-up patterns: "What about <PlaceOrValue>?" / "How about <PlaceOrValue>?"
        m_follow = re.match(
            r"^(?:and\s+)?(?:what\s+about|how\s+about)\s+(?:in|at|around|near|for)?\s*(.+)$",
            q,
            flags=re.IGNORECASE,
        )
        if m_follow:
            remainder = m_follow.group(1).strip(" ?.!,;")
            if any(p.search(remainder) for p, _ in cls._INTENSITY_PATTERNS) or cls._DURATION_PATTERN.fullmatch(remainder):
                return None, False
            if remainder.lower() in cls._CONTEXT_LOCATION_EXPRESSIONS:
                return None, True
            return remainder, False

        # 2. Explicit context reference check
        q_lower = q.lower()
        for ctx_expr in sorted(cls._CONTEXT_LOCATION_EXPRESSIONS, key=len, reverse=True):
            if re.search(rf"\b{re.escape(ctx_expr)}\b", q_lower):
                return None, True

        # 3. Strip leading condition and inquiry clauses
        q_cleaned = re.sub(
            r"^(?:what\s+(?:could|would|might|can)?\s*happen\s+if|what\s+if|what\s+happens\s+if|"
            r"what\s+should\s+(?:i|we)\s+do\s+if|how\s+(?:could|would|can|do)\s+|"
            r"is\s+there\s+an?|did\s+an?|are\s+there|suppose|assume|simulate|analyze|predict)\s+",
            "",
            q,
            flags=re.IGNORECASE,
        )

        # 4. Strip duration, intensity, year, and temporal clauses
        q_cleaned = re.sub(
            r"\b(?:in|within|over|for|lasting|during|across)\s+\d+(?:\.\d+)?\s*[- ]?(?:minute|minutes|min|mins|hour|hours|hr|hrs|h|day|days|week|weeks|month|months)\b",
            " ",
            q_cleaned,
            flags=re.IGNORECASE,
        )
        q_cleaned = re.sub(
            r"\b\d+(?:\.\d+)?\s*[- ]?(?:minute|minutes|min|mins|hour|hours|hr|hrs|day|days|week|weeks|month|months)\b",
            " ",
            q_cleaned,
            flags=re.IGNORECASE,
        )
        q_cleaned = re.sub(
            r"\b(?:in|for|by|during)?\s*(?:20\d{2}|next\s+year|this\s+year|next\s+month|next\s+week|tomorrow|today)\b",
            " ",
            q_cleaned,
            flags=re.IGNORECASE,
        )
        q_cleaned = re.sub(
            r"\b(?:by|of|to|reaches|reaching|at)?\s*[+-]?\d+(?:\.\d+)?\s*°?\s*(?:mm/hr|mm/h|mm|cm|°c|°f|celsius|fahrenheit|km/h|kmph|kph|m/s|mph|knots|meters/hour|meters|metres|meter|metre|m|litres|liters|aqi|%|magnitude|mw)\b",
            " ",
            q_cleaned,
            flags=re.IGNORECASE,
        )
        # Strip trailing temporal words and question fragments
        q_cleaned = re.sub(
            r"\b(?:right\s+now|just\s+now|currently|at\s+present|today|yesterday|this\s+morning)\b",
            " ",
            q_cleaned,
            flags=re.IGNORECASE,
        )
        q_cleaned = re.sub(
            r"\b(?:what\s+should\s+(?:we|i)\s+do|what\s+to\s+do|what\s+can\s+(?:we|i)\s+do|please\s+advise|emergency\s+steps)\b",
            " ",
            q_cleaned,
            flags=re.IGNORECASE,
        )
        q_cleaned = re.sub(r"\s+", " ", q_cleaned).strip(" ,.?!;")

        # Non-location words that should never be returned as a city/place
        non_location_terms = {
            "rainfall", "heavy rainfall", "rain", "flood", "flooding", "storm", "major storm",
            "cyclone", "heat", "extreme heat", "drought", "landslide", "earthquake", "wildfire",
            "wind", "extreme wind", "water level", "river levels", "scenario", "this scenario",
            "risk", "vulnerability", "impact", "the impact", "areas", "roads", "there", "it", "here",
            "a major earthquake", "a cyclone", "a storm", "an earthquake", "heavy rain", "significantly",
            "major damage", "damage", "disruption", "an event", "events", "place", "city", "region",
        }

        # Pattern 1: Location as subject before action verb (e.g. "Bangalore experiences a major earthquake")
        m_subj = re.search(
            r"\b([A-Za-z][A-Za-z0-9\s,\-]{1,35}?)\s+(?:experiences|faces|suffers|witnesses|receives|encounters|is\s+hit\s+by|is\s+struck\s+by)\b",
            q_cleaned,
            re.IGNORECASE,
        )
        if m_subj:
            cand = m_subj.group(1).strip(" ,.?!;")
            cand_clean = re.sub(r"^(?:if|when|assume|that)\s+", "", cand, flags=re.IGNORECASE).strip()
            if cand_clean.lower() not in non_location_terms and len(cand_clean) >= 2:
                return cand_clean, False

        # Pattern 2: Action verbs followed by location (e.g. "hits Chennai", "strikes Delhi", "affects Delhi", "passes near Chennai coastline")
        verb_matches = list(
            re.finditer(
                r"\b(?:hits|strikes|affects|affect|impacts|impact|passes\s+near|submerges|inundates)\s+([A-Za-z][A-Za-z0-9\s,\-]{1,35}?)(?=\s+(?:if|when|where|during|under|with|and|or)\b|$)",
                q_cleaned,
                re.IGNORECASE,
            )
        )
        if verb_matches:
            for m in reversed(verb_matches):
                cand = m.group(1).strip(" ,.?!;")
                cand_low = cand.lower()
                if cand_low in cls._CONTEXT_LOCATION_EXPRESSIONS:
                    return None, True
                if cand_low not in non_location_terms and len(cand) >= 2:
                    return cand, False

        # Pattern 3: Spatial prepositions (in/around/near/at/across/for <Location>)
        spatial_matches = list(
            re.finditer(
                r"\b(?:in|around|near|at|across|for)\s+([A-Za-z][A-Za-z0-9\s,\-]{1,35}?)(?=\s+(?:if|when|where|during|under|with|and|or)\b|$)",
                q_cleaned,
                re.IGNORECASE,
            )
        )
        if spatial_matches:
            for m in reversed(spatial_matches):
                cand = m.group(1).strip(" ,.?!;")
                cand_low = cand.lower()
                if cand_low in cls._CONTEXT_LOCATION_EXPRESSIONS:
                    return None, True
                if cand_low not in non_location_terms and not any(
                    cand_low.startswith(prefix)
                    for prefix in ("what ", "how ", "simulate ", "analyze ", "predict ", "assume ", "is ", "did ")
                ) and len(cand) >= 2:
                    return cand, False

        return None, False

    @classmethod
    def parse_query_intent(cls, query: str, current_loc: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Classifies user query into one of 4 canonical hazard intents:
        1. SCENARIO_ANALYSIS: Hypothetical what-if and consequence modeling
        2. SAFETY_GUIDANCE: Authoritative safety actions and preparedness protocol
        3. CURRENT_EVENT_QUERY: Checking whether an actual event is active/recorded right now
        4. CURRENT_EVENT_EMERGENCY: Immediate emergency protocol for an active/just-occurred disaster
        or returns intent='OTHER' if not a scenario/safety/hazard query.
        """
        q = (query or "").strip().lower()
        clean_loc, is_ctx = cls.extract_clean_location_phrase(query)
        cat = ScenarioRegistry.resolve_category(query)

        # 1. CURRENT_EVENT_EMERGENCY
        is_emergency = False
        emergency_indicators = ["just happened", "just hit", "just struck", "just occurred", "emergency right now", "disaster hitting"]
        action_asks = ["what should we do", "what to do", "what do we do", "emergency steps", "immediate action", "help us", "please advise"]
        if any(ind in q for ind in emergency_indicators) and any(ask in q for ask in action_asks):
            is_emergency = True
        elif ("emergency steps" in q or "emergency protocol" in q) and any(ind in q for ind in ["just", "now", "hitting", "striking", "happening"]):
            is_emergency = True

        if is_emergency:
            return {
                "intent": "CURRENT_EVENT_EMERGENCY",
                "location": clean_loc,
                "is_context_ref": is_ctx,
                "category": cat,
                "situation": cat.value,
                "scenario": f"EMERGENCY_{cat.value}",
                "isHypothetical": False,
            }

        # 2. SAFETY_GUIDANCE
        safety_indicators = [
            "what should i do", "what should we do", "how do i protect", "how can i protect",
            "how to prepare", "safety tips", "safety measures", "what to do during",
            "how to stay safe", "safety protocol", "safety guidelines", "safety guidance",
            "precautionary measures", "protective actions"
        ]
        if any(ind in q for ind in safety_indicators):
            return {
                "intent": "SAFETY_GUIDANCE",
                "location": clean_loc,
                "is_context_ref": is_ctx,
                "category": cat,
                "situation": cat.value,
                "scenario": f"GUIDANCE_{cat.value}",
                "isHypothetical": False,
            }

        # 3. CURRENT_EVENT_QUERY
        current_query_patterns = [
            r"\b(?:is there|did an?|are there|is it)\b.*\b(?:happen|happened|happening|hit|occurred|occur|strike|striking|active|right now|just now|today)\b",
            r"\b(?:happening|flooding|shaking|tremor|struck)\s+in\b.*\b(?:right now|today|currently)\b",
            r"\b(?:earthquake|tremor|quake|flood|cyclone)\s+(?:right now|today|just now|past 24 hours|recently)\b",
            r"\b(?:is.*flooding right now|is there an earthquake right now|did an earthquake just happen)\b",
        ]
        if any(re.search(pat, q) for pat in current_query_patterns):
            return {
                "intent": "CURRENT_EVENT_QUERY",
                "location": clean_loc,
                "is_context_ref": is_ctx,
                "category": cat,
                "situation": cat.value,
                "scenario": f"OBSERVED_{cat.value}",
                "isHypothetical": False,
            }

        # 4. SCENARIO_ANALYSIS
        scenario_indicators = [
            "what could happen", "what would happen", "what happens if", "what if", "simulate", "scenario",
            "hypothetical", "assume ", "what areas could be affected", "what roads could be disrupted",
            "how could", "predict the impact", "experiences a", "experiences an", "if river levels rise",
            "if rainfall reaches", "if heavy rainfall occurs", "if a cyclone passes", "if an earthquake strikes",
            "if an earthquake hits"
        ]
        if any(ind in q for ind in scenario_indicators) or re.search(r"\b(?:analyze|simulate|predict)\b", q):
            return {
                "intent": "SCENARIO_ANALYSIS",
                "location": clean_loc,
                "is_context_ref": is_ctx,
                "category": cat,
                "situation": cat.value,
                "scenario": f"HYPOTHETICAL_{cat.value}",
                "isHypothetical": True,
            }

        if cls.is_scenario_follow_up(query):
            return {
                "intent": "SCENARIO_ANALYSIS",
                "location": clean_loc,
                "is_context_ref": is_ctx,
                "category": cat,
                "situation": cat.value,
                "scenario": f"HYPOTHETICAL_{cat.value}",
                "isHypothetical": True,
            }

        return {
            "intent": "OTHER",
            "location": clean_loc,
            "is_context_ref": is_ctx,
            "category": cat,
            "situation": cat.value,
            "scenario": cat.value,
            "isHypothetical": False,
        }


    @classmethod
    async def parse_and_resolve(
        cls,
        query: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        scenario_type: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
        radius_km: Optional[float] = None,
        location_name: Optional[str] = None,
        location_meta: Optional[Dict[str, Any]] = None,
        selected_map_entity: Optional[Dict[str, Any]] = None,
        session_id: str = "default",
    ) -> ScenarioDefinition:
        """
        1. Parses natural-language query or structured parameters into ScenarioDefinition.
        2. Applies conversational follow-up inheritance from ScenarioContext when applicable.
        3. Resolves location according to 4-tier priority AFTER parsing.
        4. Updates session ScenarioContext.
        """
        if selected_map_entity is not None:
            location_meta = dict(location_meta or {})
            location_meta["selectedMapEntity"] = selected_map_entity
        params = dict(parameters or {})
        raw_q = (query or params.get("query") or "").strip()
        prev_ctx = cls.get_scenario_context(session_id)
        is_follow_up = cls.is_scenario_follow_up(raw_q, session_id) if raw_q else False

        # 1. Determine ScenarioCategory
        combined_type_hint = f"{scenario_type or ''} {raw_q}".strip()
        category = ScenarioRegistry.resolve_category(combined_type_hint)
        if scenario_type:
            explicit_cat = ScenarioRegistry.resolve_category(scenario_type)
            if explicit_cat != ScenarioCategory.OTHER or category == ScenarioCategory.OTHER:
                category = explicit_cat

        # If follow-up ("What about Bengaluru?" or "What about 100 mm?") didn't name a new category, inherit from prev_ctx
        if category == ScenarioCategory.OTHER and prev_ctx and is_follow_up:
            category = prev_ctx.scenarioType

        spec = ScenarioRegistry.get_spec(category)
        legacy_type = (scenario_type or category.value.lower()).strip()

        # 2. Extract Intensity & Unit (supporting all units in Section 7, never inventing values)
        intensity: Optional[float] = None
        unit: Optional[str] = None
        display_intensity: Optional[str] = None

        for key, u in [
            ("intensity", None),
            ("intensity_mm", "mm"),
            ("intensity_mm_hr", "mm"),
            ("rainfall_mm", "mm"),
            ("temperature_c", "°C"),
            ("temperature_delta_c", "°C delta"),
            ("degrees_c", "°C"),
            ("magnitude", "Mw"),
            ("wind_speed_kmh", "km/h"),
            ("water_level_m", "m"),
            ("surge_m", "m"),
            ("aqi", "AQI"),
            ("percent_increase", "%"),
            ("intensity_percent", "%"),
            ("surge_percent", "%"),
        ]:
            if key in params and params[key] is not None:
                try:
                    intensity = float(params[key])
                    unit = params.get("unit") or u or spec.defaultUnit
                    display_intensity = f"{intensity:g} {unit}"
                    break
                except (ValueError, TypeError):
                    pass

        if intensity is None and raw_q:
            for pat, detected_unit in cls._INTENSITY_PATTERNS:
                m = pat.search(raw_q)
                if m:
                    try:
                        val = float(m.group(1))
                        if 1990 <= val <= 2100 and detected_unit not in ("AQI", "mm"):
                            continue
                        display_intensity = f"{val:g} {detected_unit}"
                        # Normalize °F to °C internally while preserving displayIntensity
                        if detected_unit == "°F":
                            intensity = round((val - 32.0) * 5.0 / 9.0, 1)
                            unit = "°C"
                        elif detected_unit == "m/s":
                            intensity = round(val * 3.6, 1)
                            unit = "km/h"
                        elif detected_unit == "cm" and category == ScenarioCategory.RAINFALL:
                            intensity = round(val * 10.0, 2)
                            unit = "mm"
                        elif detected_unit == "litres" and category == ScenarioCategory.RAINFALL:
                            intensity = val  # 1 litre/m² == 1 mm rainfall
                            unit = "mm"
                        else:
                            intensity = val
                            unit = detected_unit
                        break
                    except (ValueError, TypeError):
                        pass

        # Inherit intensity/unit on follow-up ("What about Bengaluru?") if not overridden
        if intensity is None and is_follow_up and prev_ctx and prev_ctx.intensity is not None:
            intensity = prev_ctx.intensity
            unit = prev_ctx.unit
            display_intensity = prev_ctx.displayIntensity or f"{intensity:g} {unit or spec.defaultUnit}"

        # 3. Extract Duration (Section 8: normalize to hours/minutes/seconds + preserve displayDuration)
        duration_val: Optional[float] = None
        duration_unit: Optional[str] = None
        duration_hours: Optional[float] = None
        duration_minutes: Optional[float] = None
        duration_seconds: Optional[int] = None
        display_duration: Optional[str] = params.get("duration")

        for d_key in ("duration_hours", "duration_hrs", "durationHours"):
            if d_key in params and params[d_key] is not None:
                try:
                    duration_hours = float(params[d_key])
                    duration_val = duration_hours
                    duration_unit = "hours" if duration_hours != 1 else "hour"
                    duration_minutes = round(duration_hours * 60.0, 1)
                    duration_seconds = int(round(duration_hours * 3600))
                    if not display_duration:
                        display_duration = f"{duration_hours:g} {duration_unit}"
                    break
                except (ValueError, TypeError):
                    pass

        if duration_hours is None and raw_q:
            dm = cls._DURATION_PATTERN.search(raw_q)
            if dm:
                num_val = float(dm.group(1))
                u_raw = dm.group(2).lower()
                duration_val = num_val
                if u_raw.startswith("min"):
                    duration_unit = "minutes" if num_val != 1 else "minute"
                    duration_minutes = num_val
                    duration_hours = round(num_val / 60.0, 3)
                    duration_seconds = int(round(num_val * 60))
                elif u_raw.startswith(("hour", "hr", "h")):
                    duration_unit = "hours" if num_val != 1 else "hour"
                    duration_hours = num_val
                    duration_minutes = round(num_val * 60.0, 1)
                    duration_seconds = int(round(num_val * 3600))
                elif u_raw.startswith("day"):
                    duration_unit = "days" if num_val != 1 else "day"
                    duration_hours = num_val * 24.0
                    duration_minutes = round(duration_hours * 60.0, 1)
                    duration_seconds = int(round(duration_hours * 3600))
                elif u_raw.startswith("week"):
                    duration_unit = "weeks" if num_val != 1 else "week"
                    duration_hours = num_val * 24.0 * 7.0
                    duration_minutes = round(duration_hours * 60.0, 1)
                    duration_seconds = int(round(duration_hours * 3600))
                elif u_raw.startswith("month"):
                    duration_unit = "months" if num_val != 1 else "month"
                    duration_hours = num_val * 24.0 * 30.0
                    duration_minutes = round(duration_hours * 60.0, 1)
                    duration_seconds = int(round(duration_hours * 3600))
                display_duration = f"{num_val:g} {duration_unit}"

        # Inherit duration on follow-up ("What about Bengaluru?" or "What about 100 mm?")
        if duration_hours is None and is_follow_up and prev_ctx and prev_ctx.durationHours is not None:
            duration_val = prev_ctx.duration
            duration_unit = prev_ctx.durationUnit
            duration_hours = prev_ctx.durationHours
            duration_minutes = prev_ctx.durationMinutes
            duration_seconds = prev_ctx.durationSeconds
            display_duration = prev_ctx.displayDuration

        # 4. Extract Relative Time / Target Date / Target Year (Sections 9, 18, 19)
        now_utc = datetime.now(timezone.utc)
        now_year = now_utc.year
        target_year: Optional[int] = None
        target_date: Optional[str] = None

        if params.get("targetYear") or params.get("requestedYear") or params.get("year"):
            try:
                target_year = int(params.get("targetYear") or params.get("requestedYear") or params.get("year"))
            except (ValueError, TypeError):
                pass

        if target_year is None and raw_q:
            q_low = raw_q.lower()
            if "next year" in q_low:
                target_year = now_year + 1
                target_date = f"{target_year}"
            elif "this year" in q_low:
                target_year = now_year
                target_date = f"{target_year}"
            elif "tomorrow" in q_low:
                tmrw = (now_utc + timedelta(days=1)).strftime("%Y-%m-%d")
                target_date = tmrw
                target_year = int(tmrw[:4])
            elif "next week" in q_low:
                nw = (now_utc + timedelta(days=7)).strftime("%Y-%m-%d")
                target_date = nw
                target_year = int(nw[:4])
            elif "next month" in q_low:
                nm = (now_utc + timedelta(days=30)).strftime("%Y-%m-%d")
                target_date = nm
                target_year = int(nm[:4])
            else:
                ym = re.search(r"\b(20\d{2})\b", raw_q)
                if ym:
                    target_year = int(ym.group(1))
                    target_date = str(target_year)

        if target_year is None and is_follow_up and prev_ctx and prev_ctx.targetYear is not None:
            target_year = prev_ctx.targetYear
            target_date = prev_ctx.targetDate

        previous_year: Optional[int] = (target_year - 1) if target_year is not None else None
        if target_year is not None:
            end_hist_year = min(previous_year or now_year, now_year)
            historical_window_years = list(range(end_hist_year - 4, end_hist_year + 1))
        else:
            historical_window_years = list(range(now_year - 5, now_year))

        # 5. Extract Radius
        resolved_radius = float(
            radius_km
            or params.get("radius_km")
            or params.get("radius")
            or (prev_ctx.radius if (is_follow_up and prev_ctx) else 5.0)
        )
        if raw_q and radius_km is None and "radius" not in params:
            rm = cls._RADIUS_PATTERN.search(raw_q)
            if rm:
                resolved_radius = float(rm.group(1))

        # 6. Extract Clean Location Phrase from Query (Section 4, 5, 12, 13)
        explicit_query_loc, is_context_ref = cls.extract_clean_location_phrase(raw_q)
        if location_name and not explicit_query_loc:
            explicit_query_loc = location_name

        if (latitude is None or longitude is None) and raw_q:
            cm = cls._COORDS_PATTERN.search(raw_q)
            if cm:
                try:
                    latitude = float(cm.group(1))
                    longitude = float(cm.group(2))
                except ValueError:
                    pass

        # 7. Resolve Location with Strict 4-Tier Priority (Sections 4, 12, 13):
        #    Priority 1: Explicit location in current query (e.g. "Mysuru", "Bengaluru", "Delhi", "Chennai")
        #    Priority 2: Selected map/POI location (selectedMapEntity on Google Maps, e.g. "Mysore Palace")
        #    Priority 3: Active location context (location_meta / current_loc or previous ScenarioContext)
        #    Priority 4: Clarification only when none exists
        resolved_loc, loc_source = await cls._resolve_priority_location(
            explicit_query_loc=explicit_query_loc,
            is_context_ref=is_context_ref,
            latitude=latitude,
            longitude=longitude,
            location_meta=location_meta,
            prev_ctx=prev_ctx,
            radius_km=resolved_radius,
        )

        # Parameters dictionary with explicit UNKNOWN values for missing parameters (prompt requirement)
        scenario_params = dict(params or {})
        if category == ScenarioCategory.EARTHQUAKE:
            scenario_params.setdefault("magnitude", f"{intensity:g} Mw" if intensity is not None else "UNKNOWN")
            scenario_params.setdefault("epicenter", "UNKNOWN")
            scenario_params.setdefault("depth", "UNKNOWN")
            scenario_params.setdefault("time", "UNKNOWN")
        else:
            scenario_params.setdefault("intensity", f"{intensity:g} {unit or spec.defaultUnit}" if intensity is not None else "UNKNOWN")
            scenario_params.setdefault("duration", display_duration or ("UNKNOWN" if duration_hours is None else f"{duration_hours:g} hours"))

        # 8. Identify Missing Information (Never silently invent values; UNKNOWN parameters do NOT make scenario invalid)
        missing_info: List[str] = []
        if not resolved_loc.isResolved:
            missing_info.append(
                "Target geographic location could not be resolved; please specify a city, landmark, or select a location on the map."
            )
        if intensity is None:
            if category == ScenarioCategory.EARTHQUAKE:
                missing_info.append(
                    "Earthquake magnitude, epicenter, focal depth, and origin time are UNKNOWN / Unspecified in prompt. Analysis evaluates baseline seismic susceptibility and structural consequence modeling."
                )
            else:
                missing_info.append(
                    f"Scenario intensity ({spec.defaultUnit}) was not specified in the query; analysis reflects baseline susceptibility without a user-supplied intensity."
                )
        if duration_hours is None and category in (
            ScenarioCategory.RAINFALL,
            ScenarioCategory.STORM,
            ScenarioCategory.EXTREME_HEAT,
            ScenarioCategory.DROUGHT,
            ScenarioCategory.FLOOD,
        ):
            missing_info.append(
                f"Scenario duration was not specified for {spec.displayName}."
            )

        situation_val = category.value
        scenario_val = f"HYPOTHETICAL_{category.value}"
        user_role_val = params.get("userRole") or "GENERAL_USER"
        requested_outputs_val = params.get("requestedOutputs") or ["IMPACTS", "LIFELINES", "FACTORS", "RECOMMENDATIONS"]
        evidence_reqs = ["HISTORICAL", "GEOSPATIAL", "INFRASTRUCTURE", "OBSERVED"]

        defn = ScenarioDefinition(
            intent="SCENARIO_ANALYSIS",
            rawQuery=raw_q or None,
            scenarioType=category,
            legacyScenarioType=legacy_type,
            situation=situation_val,
            scenario=scenario_val,
            location=resolved_loc.city or resolved_loc.displayName if resolved_loc.isResolved else explicit_query_loc,
            resolvedLocation=resolved_loc,
            latitude=resolved_loc.latitude,
            longitude=resolved_loc.longitude,
            parameters=scenario_params,
            intensity=intensity,
            unit=unit or (spec.defaultUnit if intensity is not None else None),
            displayIntensity=display_intensity or (f"{intensity:g} {unit or spec.defaultUnit}" if intensity is not None else "Unspecified"),
            duration=display_duration,
            durationValue=duration_val,
            durationUnit=duration_unit,
            durationHours=duration_hours,
            durationMinutes=duration_minutes,
            durationSeconds=duration_seconds,
            displayDuration=display_duration or ("Unspecified" if duration_hours is None else f"{duration_hours:g} hours"),
            timePeriod=params.get("timePeriod") or params.get("season"),
            startTime=params.get("startTime") or params.get("date"),
            targetDate=target_date,
            targetYear=target_year,
            requestedTime=params.get("requestedTime") or params.get("time") or target_date,
            requestedYear=target_year,
            previousYear=previous_year,
            historicalWindowYears=historical_window_years,
            radius=resolved_radius,
            requestedOutputs=requested_outputs_val,
            userRole=user_role_val,
            evidenceRequirements=evidence_reqs,
            isHypothetical=True,
            isFollowUp=is_follow_up,
            locationSource=loc_source,
            additionalParameters=scenario_params,
            missingInformation=missing_info,
            isSufficient=resolved_loc.isResolved,
        )

        # Save to session ScenarioContext if location was resolved
        if resolved_loc.isResolved:
            cls.update_scenario_context(defn, session_id=session_id)

        return defn

    @classmethod
    async def _resolve_priority_location(
        cls,
        explicit_query_loc: Optional[str],
        is_context_ref: bool,
        latitude: Optional[float],
        longitude: Optional[float],
        location_meta: Optional[Dict[str, Any]],
        prev_ctx: Optional[ScenarioContext],
        radius_km: float,
    ) -> Tuple[ResolvedLocation, str]:
        """
        Implements the 4-tier location resolution priority:
        1. Explicit location in current query (e.g. "in Mysuru", "in Bengaluru", "in Delhi", "around Chennai")
        2. Selected map/POI location (selectedMapEntity on Google Maps, e.g. "Mysore Palace")
        3. Active location context (location_meta / current_loc or previous ScenarioContext)
        4. Unresolved -> ask for clarification
        """
        # PRIORITY 1: Explicit location name extracted from current query
        if explicit_query_loc and not is_context_ref:
            try:
                geocoded = await GeocodingProvider.geocode(explicit_query_loc)
                if geocoded and geocoded.get("latitude") is not None and geocoded.get("longitude") is not None:
                    lat_v = float(geocoded["latitude"])
                    lon_v = float(geocoded["longitude"])
                    loc_obj = await cls._build_resolved_location(
                        lat_v,
                        lon_v,
                        base_meta=geocoded,
                        query_label=explicit_query_loc,
                        radius_km=radius_km,
                    )
                    return loc_obj, "EXPLICIT_QUERY"
            except Exception:
                pass

        # PRIORITY 2: Selected map/POI location (e.g. Mysore Palace selected on Google Maps)
        selected_poi = (location_meta or {}).get("selectedMapEntity") if isinstance(location_meta, dict) else None
        if isinstance(selected_poi, dict):
            poi_coords = selected_poi.get("coordinates") or {}
            p_lat = poi_coords.get("latitude") or selected_poi.get("latitude")
            p_lon = poi_coords.get("longitude") or selected_poi.get("longitude")
            if p_lat is not None and p_lon is not None:
                poi_name = selected_poi.get("name") or selected_poi.get("title") or "Selected Map Location"
                merged_meta = {
                    **(location_meta or {}),
                    "neighborhood": poi_name,
                    "displayName": f"{poi_name}, {(location_meta or {}).get('city') or ''}".strip(", "),
                }
                loc_obj = await cls._build_resolved_location(
                    float(p_lat),
                    float(p_lon),
                    base_meta=merged_meta,
                    query_label=poi_name,
                    radius_km=radius_km,
                )
                return loc_obj, "SELECTED_MAP_POI"

        # PRIORITY 3A: Active location context passed from frontend / caller (e.g. activeLocation = Mysuru)
        if isinstance(location_meta, dict):
            m_lat = location_meta.get("latitude")
            m_lon = location_meta.get("longitude")
            if m_lat is not None and m_lon is not None and not (float(m_lat) == 0.0 and float(m_lon) == 0.0):
                loc_obj = await cls._build_resolved_location(
                    float(m_lat),
                    float(m_lon),
                    base_meta=location_meta,
                    query_label=location_meta.get("city") or location_meta.get("displayName"),
                    radius_km=radius_km,
                )
                return loc_obj, "ACTIVE_CONTEXT"

        # PRIORITY 3B: Explicit latitude/longitude parameters passed directly
        if latitude is not None and longitude is not None and not (float(latitude) == 0.0 and float(longitude) == 0.0):
            loc_obj = await cls._build_resolved_location(
                float(latitude),
                float(longitude),
                base_meta=location_meta or {},
                query_label=explicit_query_loc,
                radius_km=radius_km,
            )
            return loc_obj, "ACTIVE_CONTEXT"

        # PRIORITY 3C: Previous ScenarioContext location (for follow-ups like "What about 100 mm?")
        if prev_ctx and prev_ctx.latitude is not None and prev_ctx.longitude is not None:
            loc_obj = await cls._build_resolved_location(
                float(prev_ctx.latitude),
                float(prev_ctx.longitude),
                base_meta={"city": prev_ctx.location, "displayName": prev_ctx.location},
                query_label=prev_ctx.location,
                radius_km=radius_km,
            )
            return loc_obj, "SCENARIO_CONTEXT"

        # PRIORITY 4: None available -> Unresolved
        return (
            ResolvedLocation(
                query=explicit_query_loc,
                latitude=None,
                longitude=None,
                displayName=explicit_query_loc or "Unspecified Location",
                selectedRadiusKm=radius_km,
                isResolved=False,
            ),
            "UNRESOLVED",
        )

    @classmethod
    async def _build_resolved_location(
        cls,
        lat_val: float,
        lon_val: float,
        base_meta: Dict[str, Any],
        query_label: Optional[str],
        radius_km: float,
    ) -> ResolvedLocation:
        geo_data = dict(base_meta or {})
        if not geo_data.get("city") or not geo_data.get("country"):
            try:
                rev = await GeocodingProvider.reverse_geocode(lat_val, lon_val)
                if rev:
                    geo_data = {**rev, **{k: v for k, v in geo_data.items() if v is not None}}
            except Exception:
                pass

        city = (
            query_label
            if (query_label and not geo_data.get("neighborhood") and len(query_label) < 30)
            else (geo_data.get("city") or geo_data.get("town") or geo_data.get("municipality") or query_label)
        )
        neighborhood = geo_data.get("neighborhood") or geo_data.get("suburb")
        state = geo_data.get("state") or geo_data.get("region")
        country = geo_data.get("country")
        tz = geo_data.get("timezone") or "UTC"
        display_name = (
            geo_data.get("displayName")
            or ", ".join([p for p in [neighborhood, city, state, country] if p])
            or f"({lat_val:.4f}, {lon_val:.4f})"
        )

        lat_delta = round(radius_km / 111.32, 4)
        lon_delta = round(radius_km / max(10.0, 111.32 * abs(math.cos(math.radians(lat_val)))), 4)
        boundaries = {
            "center": {"latitude": lat_val, "longitude": lon_val},
            "radiusKm": radius_km,
            "boundingBox": {
                "south": round(lat_val - lat_delta, 5),
                "north": round(lat_val + lat_delta, 5),
                "west": round(lon_val - lon_delta, 5),
                "east": round(lon_val + lon_delta, 5),
            },
            "adminLevel": {
                "neighborhood": neighborhood,
                "city": city,
                "district": geo_data.get("district"),
                "state": state,
                "country": country,
            },
        }

        return ResolvedLocation(
            query=query_label,
            latitude=lat_val,
            longitude=lon_val,
            city=city,
            neighborhood=neighborhood,
            district=geo_data.get("district"),
            region=state,
            state=state,
            country=country,
            countryCode=geo_data.get("countryCode"),
            timezone=tz,
            displayName=display_name,
            administrativeBoundaries=boundaries,
            selectedRadiusKm=radius_km,
            isResolved=True,
        )
