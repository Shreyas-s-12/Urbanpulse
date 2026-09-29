"""
Test Suite: Redesigned UrbanPulse Nexus Scenario Understanding
Verifies the 8 separated architectural concepts:
1. USER INTENT (SCENARIO_ANALYSIS, SAFETY_GUIDANCE, CURRENT_EVENT_QUERY, CURRENT_EVENT_EMERGENCY)
2. LOCATION (Resolved, preserved, never confused with scenario parameters)
3. SITUATION / HAZARD (Earthquake, Cyclone, Flood, Heat, Landslide, etc.)
4. HYPOTHETICAL SCENARIO (Explicitly flagged, never claimed as forecast/fact)
5. CURRENT OBSERVATION (Live telemetry verification via USGS, Open-Meteo, etc.)
6. FORECAST (Differentiated from hypothetical)
7. HISTORICAL EVENT (Grounded in past records)
8. OFFICIAL ALERT (Civil defense protocols and warnings)

Also verifies:
- Unspecified parameters (magnitude, epicenter, depth, time) are recorded as UNKNOWN without triggering clarification
- Never asks for location clarification when location is present
- Prominent hypothetical disclaimer
- Dynamic factor evaluation and role-aware decision support (Citizen, Emergency Responder, Municipal Official, Urban Planner)
"""

import pytest
from app.services.scenario.models import ScenarioCategory, UserRole
from app.services.scenario.parser import ScenarioParser
from app.services.scenario_engine import ScenarioEngineService
from app.services.agent.location_agent import LocationAgentService


@pytest.mark.asyncio
async def test_earthquake_scenario_analysis_bangalore():
    """
    Query: 'What could happen if there is an earthquake in Bangalore?'
    Must parse as:
    - intent = SCENARIO_ANALYSIS
    - location = Bangalore / Bengaluru
    - situation = EARTHQUAKE
    - scenario = HYPOTHETICAL_EARTHQUAKE
    - parameters with magnitude, epicenter, depth, time as UNKNOWN
    - prominent hypothetical disclaimer
    - no location clarification
    """
    query = "What could happen if there is an earthquake in Bangalore?"

    # 1. Clean location extraction
    clean_loc, is_ctx = ScenarioParser.extract_clean_location_phrase(query)
    assert clean_loc == "Bangalore"
    assert is_ctx is False

    # 2. Query intent parsing
    intent_data = ScenarioParser.parse_query_intent(query)
    assert intent_data["intent"] == "SCENARIO_ANALYSIS"
    assert intent_data["situation"] == "EARTHQUAKE"
    assert intent_data["scenario"] == "HYPOTHETICAL_EARTHQUAKE"

    # 3. Parameter extraction with UNKNOWN values
    definition = await ScenarioParser.parse_and_resolve(query=query)
    assert definition.intent == "SCENARIO_ANALYSIS"
    assert definition.scenarioType == ScenarioCategory.EARTHQUAKE
    assert definition.isHypothetical is True
    assert "bangalore" in definition.resolvedLocation.displayName.lower() or "bengaluru" in definition.resolvedLocation.displayName.lower()

    # Parameters must be populated with UNKNOWN for missing values without failing
    assert definition.parameters.get("magnitude") == "UNKNOWN"
    assert definition.parameters.get("epicenter") == "UNKNOWN"
    assert definition.parameters.get("depth") == "UNKNOWN"
    assert definition.parameters.get("time") == "UNKNOWN"

    # 4. Engine Analysis
    result = await ScenarioEngineService.analyze_scenario(query=query)
    assert result["isHypothetical"] is True
    assert "hypothetical earthquake scenario" in result["hypotheticalDisclaimer"].lower()
    assert definition.scenario == "HYPOTHETICAL_EARTHQUAKE"
    assert result["situation"] == "EARTHQUAKE"
    assert result["hypotheticalScenario"] == "HYPOTHETICAL_EARTHQUAKE"

    # Verify reasoning trace covers 7 stages: UNDERSTAND, PLAN, SELECT TOOLS, EXECUTE, ANALYZE, VERIFY, ACT
    stages = [step["stage"] for step in result.get("reasoningTrace", [])]
    assert "UNDERSTAND" in stages
    assert "PLAN" in stages
    assert "SELECT TOOLS" in stages
    assert "EXECUTE" in stages
    assert "ANALYZE" in stages
    assert "VERIFY" in stages
    assert "ACT" in stages

    # Verify four factors tailored for earthquake
    factor_names = [f["factorName"].lower() for f in result.get("fourKeyFactors", [])]
    assert any("seismic" in f or "ground" in f or "infrastructure" in f or "shaking" in f for f in factor_names)

    # Verify dynamic factors and tools
    dynamic_names = [df["name"].lower() for df in result.get("dynamicFactors", [])]
    assert any("seismic" in df or "ground shaking" in df or "buildings" in df for df in dynamic_names)
    assert "seismic_hazard" in result.get("requiredTools", [])

    # Verify role recommendations
    role_recs = result.get("roleRecommendations", {})
    assert "citizen" in role_recs
    assert "emergencyResponder" in role_recs
    assert "municipalOfficial" in role_recs
    assert "urbanPlanner" in role_recs
    assert len(role_recs["citizen"]["recommendedActions"]) > 0

    # 5. Full Agent Pipeline - must never ask for location clarification
    agent_res = await LocationAgentService.process_interaction({"query": query})
    assert agent_res["intent"] in ("SIMULATE", "SCENARIO_ANALYSIS")
    assert "couldn't identify the specific location" not in agent_res["message"].lower()
    assert "location clarification" not in agent_res["message"].lower()
    assert "hypothetical earthquake scenario" in agent_res["message"].lower()
    assert agent_res["data"].get("scenario") is not None


@pytest.mark.asyncio
async def test_earthquake_safety_guidance():
    """
    Query: 'What should I do if there is an earthquake in Bangalore?'
    Must parse as:
    - intent = SAFETY_GUIDANCE
    - returns authoritative life-safety protocol (Drop, Cover, Hold On)
    - local emergency numbers
    """
    query = "What should I do if there is an earthquake in Bangalore?"

    intent_data = ScenarioParser.parse_query_intent(query)
    assert intent_data["intent"] == "SAFETY_GUIDANCE"
    assert intent_data["situation"] == "EARTHQUAKE"

    agent_res = await LocationAgentService.process_interaction({"query": query})
    assert agent_res["intent"] == "SAFETY_GUIDANCE"
    assert "couldn't identify the specific location" not in agent_res["message"].lower()

    msg = agent_res["message"].lower()
    assert "drop" in msg and "cover" in msg and "hold" in msg
    assert "112" in msg or "108" in msg or "helpline" in msg
    assert agent_res["structured_response"] is not None
    assert agent_res["structured_response"]["type"] == "GUIDANCE"


@pytest.mark.asyncio
async def test_earthquake_current_event_query():
    """
    Query: 'Is there an earthquake happening in Bangalore right now?'
    Must parse as:
    - intent = CURRENT_EVENT_QUERY
    - queries live telemetry (USGS Seismic catalog)
    - reports verified current observation without hallucination
    """
    query = "Is there an earthquake happening in Bangalore right now?"

    intent_data = ScenarioParser.parse_query_intent(query)
    assert intent_data["intent"] == "CURRENT_EVENT_QUERY"
    assert intent_data["situation"] == "EARTHQUAKE"

    agent_res = await LocationAgentService.process_interaction({"query": query})
    assert agent_res["intent"] == "CURRENT_EVENT_QUERY"
    assert "couldn't identify the specific location" not in agent_res["message"].lower()

    msg = agent_res["message"].lower()
    assert "usgs" in msg or "live" in msg or "telemetry" in msg or "observation" in msg
    assert agent_res["structured_response"] is not None
    assert agent_res["structured_response"]["type"] == "CURRENT_STATUS"


@pytest.mark.asyncio
async def test_earthquake_current_emergency():
    """
    Query: 'An earthquake just happened in Bangalore. What should we do?'
    Must parse as:
    - intent = CURRENT_EVENT_EMERGENCY
    - dispatches immediate post-earthquake critical emergency actions
    - aftershocks precautions, gas shutoff, evacuation assembly
    """
    query = "An earthquake just happened in Bangalore. What should we do?"

    intent_data = ScenarioParser.parse_query_intent(query)
    assert intent_data["intent"] == "CURRENT_EVENT_EMERGENCY"
    assert intent_data["situation"] == "EARTHQUAKE"

    agent_res = await LocationAgentService.process_interaction({"query": query})
    assert agent_res["intent"] == "CURRENT_EVENT_EMERGENCY"
    assert "couldn't identify the specific location" not in agent_res["message"].lower()

    msg = agent_res["message"].lower()
    assert "aftershock" in msg or "evacuat" in msg or "emergency" in msg
    assert agent_res["structured_response"] is not None
    assert agent_res["structured_response"]["type"] == "EMERGENCY"


@pytest.mark.asyncio
async def test_global_location_agnosticism():
    """
    Verifies system works for any global city and hazard without hardcoding:
    1. Cyclone in Chennai
    2. Landslide around Mangalore
    3. Extreme heat in Delhi
    4. River levels in Rotterdam
    """
    queries = [
        ("What if a cyclone hits Chennai?", ScenarioCategory.CYCLONE, "chennai"),
        ("Simulate a landslide scenario around Mangalore.", ScenarioCategory.LANDSLIDE, "mangalore"),
        ("How could extreme heat affect Delhi?", ScenarioCategory.EXTREME_HEAT, "delhi"),
        ("What happens if river levels rise significantly in Rotterdam?", ScenarioCategory.WATER_LEVEL_RISE, "rotterdam"),
    ]

    for q, expected_cat, expected_city in queries:
        clean_loc, is_ctx = ScenarioParser.extract_clean_location_phrase(q)
        assert expected_city in clean_loc.lower()

        definition = await ScenarioParser.parse_and_resolve(query=q)
        assert definition.scenarioType in (expected_cat, ScenarioCategory.FLOOD)
        assert expected_city in definition.resolvedLocation.displayName.lower()

        agent_res = await LocationAgentService.process_interaction({"query": q})
        assert agent_res["intent"] in ("SIMULATE", "SCENARIO_ANALYSIS")
        assert "couldn't identify the specific location" not in agent_res["message"].lower()
        assert agent_res["data"].get("scenario") is not None
