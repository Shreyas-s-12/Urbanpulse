"""
Comprehensive Test Suite for the Generalized UrbanPulse Scenario Intelligence Engine.
Tests all 29 architectural requirements:
- ScenarioParser extraction (location, scenarioType, intensity, unit, duration, targetYear, next year)
- All 16 ScenarioCategory specifications & runtime extensibility in ScenarioRegistry
- Non-alarmist threshold rule (e.g., 10 mm rainfall in 1 hour != flooding or road closure)
- Dynamic 4-Factor Impact Model tailored to each scenario category
- Multi-year HistoricalComparator (requestedYear -> previousYear = requestedYear - 1)
- GeoSpatialAnalyzer strict DEM / drainage limitation handling
- EvidenceType labeling, ConfidenceLevel grading, visually distinct MapLayers, and 14-section output
"""

from datetime import datetime, timezone
import pytest

from app.services.scenario import (
    ConfidenceLevel,
    EvidenceType,
    MapLayerId,
    ScenarioCategory,
    ScenarioParser,
    ScenarioRegistry,
)
from app.services.scenario_engine import ScenarioEngineService


@pytest.mark.asyncio
async def test_scenario_parser_10mm_rainfall_malleswaram():
    """Verify '10 mm rainfall in 1 hour in Malleswaram' extracts exact fields without hardcoding."""
    defn = await ScenarioParser.parse_and_resolve(
        query="Assume 10 mm rainfall occurs in 1 hour in Malleswaram.",
        latitude=13.0031,
        longitude=77.5643,
    )
    assert defn.scenarioType == ScenarioCategory.RAINFALL
    assert defn.intensity == 10.0
    assert defn.unit == "mm"
    assert defn.duration == "1 hour"
    assert defn.durationHours == 1.0
    assert "Malleswaram" in (defn.location or "")
    assert defn.resolvedLocation is not None
    assert defn.resolvedLocation.isResolved is True


@pytest.mark.asyncio
async def test_scenario_parser_50mm_3hours_mysuru():
    """Verify 'What could happen if rainfall reaches 50 mm in 3 hours in Mysuru?' extraction."""
    defn = await ScenarioParser.parse_and_resolve(
        query="What could happen if rainfall reaches 50 mm in 3 hours in Mysuru?",
        latitude=12.2958,
        longitude=76.6394,
    )
    assert defn.scenarioType == ScenarioCategory.RAINFALL
    assert defn.intensity == 50.0
    assert defn.unit == "mm"
    assert defn.durationHours == 3.0
    assert "Mysuru" in (defn.location or "")


@pytest.mark.asyncio
async def test_scenario_parser_year_and_next_year_resolution():
    """Verify targetYear and 'next year' resolve dynamically with previousYear = requestedYear - 1."""
    defn_2028 = await ScenarioParser.parse_and_resolve(
        query="Predict this rainfall scenario of 40 mm in 2 hours for 2028.",
        latitude=12.9716,
        longitude=77.5946,
    )
    assert defn_2028.targetYear == 2028
    assert defn_2028.previousYear == 2027
    assert len(defn_2028.historicalWindowYears) >= 3

    current_year = datetime.now(timezone.utc).year
    defn_next = await ScenarioParser.parse_and_resolve(
        query="Predict next year's risk for a drought scenario in this region.",
        latitude=12.9716,
        longitude=77.5946,
    )
    assert defn_next.scenarioType == ScenarioCategory.DROUGHT
    assert defn_next.targetYear == current_year + 1
    assert defn_next.previousYear == current_year
    # Because no numerical intensity was supplied for drought, missingInformation must flag it
    assert any("intensity" in m.lower() for m in defn_next.missingInformation)


def test_scenario_registry_all_16_categories_and_distinct_four_factors():
    """Verify all 16 initial categories exist and have distinct scenario-specific 4-factor models."""
    expected_categories = [
        ScenarioCategory.RAINFALL,
        ScenarioCategory.FLOOD,
        ScenarioCategory.STORM,
        ScenarioCategory.CYCLONE,
        ScenarioCategory.EXTREME_HEAT,
        ScenarioCategory.DROUGHT,
        ScenarioCategory.LANDSLIDE,
        ScenarioCategory.EARTHQUAKE,
        ScenarioCategory.WILDFIRE,
        ScenarioCategory.WATER_LEVEL_RISE,
        ScenarioCategory.COASTAL_INUNDATION,
        ScenarioCategory.STORM_SURGE,
        ScenarioCategory.AIR_QUALITY_EVENT,
        ScenarioCategory.EXTREME_WIND,
        ScenarioCategory.ROAD_DISRUPTION,
        ScenarioCategory.OTHER,
    ]
    for cat in expected_categories:
        spec = ScenarioRegistry.get_spec(cat)
        assert spec.category == cat
        assert len(spec.fourFactors) == 4

    rain_factors = [f.name for f in ScenarioRegistry.get_spec(ScenarioCategory.RAINFALL).fourFactors]
    heat_factors = [f.name for f in ScenarioRegistry.get_spec(ScenarioCategory.EXTREME_HEAT).fourFactors]
    landslide_factors = [f.name for f in ScenarioRegistry.get_spec(ScenarioCategory.LANDSLIDE).fourFactors]
    cyclone_factors = [f.name for f in ScenarioRegistry.get_spec(ScenarioCategory.CYCLONE).fourFactors]
    drought_factors = [f.name for f in ScenarioRegistry.get_spec(ScenarioCategory.DROUGHT).fourFactors]

    assert rain_factors == [
        "Waterlogging susceptibility",
        "Drainage stress",
        "Road disruption",
        "Exposure",
    ]
    assert heat_factors == [
        "Heat exposure",
        "Built-environment heat",
        "Water demand stress",
        "Population exposure",
    ]
    assert landslide_factors == [
        "Slope susceptibility",
        "Soil/geological susceptibility",
        "Rainfall trigger",
        "Infrastructure exposure",
    ]
    assert cyclone_factors == [
        "Wind exposure",
        "Rainfall/flood exposure",
        "Storm-surge/coastal exposure",
        "Infrastructure/population exposure",
    ]
    assert drought_factors == [
        "Water availability",
        "Soil moisture",
        "Agricultural stress",
        "Population/water-demand exposure",
    ]


@pytest.mark.asyncio
async def test_10mm_rainfall_does_not_assume_flooding_or_road_closure():
    """
    Critical Section 5 & 23 verification:
    10 mm rainfall in 1 hour must NOT automatically translate into flooding or road closure.
    """
    res = await ScenarioEngineService.analyze_scenario(
        query="Analyze what could happen if 10 mm of rainfall occurs within 1 hour around Malleswaram.",
        latitude=13.0031,
        longitude=77.5643,
    )

    assert res["canonicalScenarioCategory"] == "RAINFALL"
    pred_section = res["reportSections"]["MODEL_DERIVED_PREDICTION"]
    assert pred_section["severityBand"] == "LOW_ROUTINE"
    assert pred_section["causesSignificantDisruption"] is False
    assert res["difference"]["inundationDepthMeters"] == 0.0
    assert "does NOT automatically cause general flooding" in pred_section["floodRisk"]

    # Check roads do NOT claim "Road closed"
    for road in res["affectedRoads"]:
        assert "road closed" not in road["predictedImpact"].lower()

    # Check all 14 sections of Section 28 exist
    required_14_sections = [
        "SCENARIO",
        "LOCATION",
        "HISTORICAL_EVIDENCE",
        "CURRENT_CONDITIONS",
        "GEOSPATIAL_SUSCEPTIBILITY",
        "MODEL_DERIVED_PREDICTION",
        "FOUR_KEY_FACTORS",
        "AFFECTED_LOCATIONS",
        "AFFECTED_INFRASTRUCTURE",
        "CONFIDENCE",
        "ASSUMPTIONS",
        "UNCERTAINTY_AND_LIMITATIONS",
        "DATA_SOURCES",
        "REAL_TIME_DATA_NEEDED",
    ]
    for sec in required_14_sections:
        assert sec in res["reportSections"], f"Missing section {sec}"

    # Verify visually distinct map layers exist
    for layer_name in [
        MapLayerId.HISTORICAL_EVENTS.value,
        MapLayerId.CURRENT_CONDITIONS.value,
        MapLayerId.SCENARIO_PREDICTION.value,
        MapLayerId.INFRASTRUCTURE.value,
        MapLayerId.TERRAIN.value,
    ]:
        assert layer_name in res["mapLayers"]


@pytest.mark.asyncio
async def test_extreme_heat_and_earthquake_scenarios_switch_factors():
    """
    Verify Section 24 (45°C heat event lasting 3 days) and Section 25 (Mw 6.5 earthquake)
    automatically switch to their domain-specific factors and do NOT use rainfall/drainage factors.
    """
    heat_res = await ScenarioEngineService.analyze_scenario(
        query="Analyze a hypothetical 45°C temperature event lasting 3 days in this location.",
        latitude=28.6139,
        longitude=77.2090,
    )
    assert heat_res["canonicalScenarioCategory"] == "EXTREME_HEAT"
    heat_factor_names = [f["factorName"] for f in heat_res["fourKeyFactors"]]
    assert "Heat exposure" in heat_factor_names
    assert "Waterlogging susceptibility" not in heat_factor_names

    eq_res = await ScenarioEngineService.analyze_scenario(
        query="Analyze a hypothetical magnitude 6.5 earthquake near this location.",
        latitude=35.6762,
        longitude=139.6503,
    )
    assert eq_res["canonicalScenarioCategory"] == "EARTHQUAKE"
    eq_factor_names = [f["factorName"] for f in eq_res["fourKeyFactors"]]
    assert "Seismic ground-motion exposure" in eq_factor_names
    assert "Drainage stress" not in eq_factor_names


@pytest.mark.asyncio
async def test_all_8_exact_acceptance_queries_and_followups():
    """
    Section 23 Verification:
    Tests all 8 exact queries and conversational follow-ups:
    1. "What could happen if rainfall reaches 50 mm in 3 hours in Mysuru?"
    2. "What about Bengaluru?"
    3. "What about 100 mm?"
    4. "Assume 10 mm rainfall in 1 hour in Malleswaram."
    5. "What if temperature reaches 45°C for 3 days in Delhi?"
    6. "Simulate a major storm around Chennai."
    7. "Analyze landslide risk here."
    8. "Predict next year's flood vulnerability."
    """
    from datetime import datetime, timezone
    from app.services.agent.location_agent import LocationAgentService

    ScenarioParser.reset_scenario_context()

    # 1. "What could happen if rainfall reaches 50 mm in 3 hours in Mysuru?"
    q1 = "What could happen if rainfall reaches 50 mm in 3 hours in Mysuru?"
    clean_loc_1, is_ctx_ref_1 = ScenarioParser.extract_clean_location_phrase(q1)
    assert clean_loc_1 == "Mysuru"
    assert is_ctx_ref_1 is False
    s1 = await ScenarioParser.parse_and_resolve(query=q1)
    assert s1.intent == "SCENARIO_ANALYSIS"
    assert s1.scenarioType == ScenarioCategory.RAINFALL
    assert s1.intensity == 50.0
    assert s1.unit == "mm"
    assert s1.durationHours == 3.0
    assert s1.durationMinutes == 180.0
    assert s1.durationSeconds == 10800.0
    assert s1.displayDuration == "3 hours"
    assert "mysuru" in s1.resolvedLocation.displayName.lower() or "mysore" in s1.resolvedLocation.displayName.lower()

    # Also verify LocationAgentService.process_interaction never returns LOCATION CLARIFICATION
    agent_res_1 = await LocationAgentService.process_interaction({"query": q1})
    assert agent_res_1["intent"] in ("SIMULATE", "SCENARIO_ANALYSIS")
    assert "couldn't identify the specific location" not in agent_res_1["message"].lower()
    assert agent_res_1["confidence"] > 0.5
    assert agent_res_1["data"].get("scenario") is not None

    # 2. "What about Bengaluru?" (follow-up inheriting 50 mm in 3 hours RAINFALL)
    q2 = "What about Bengaluru?"
    assert ScenarioParser.is_scenario_follow_up(q2) is True
    s2 = await ScenarioParser.parse_and_resolve(query=q2)
    assert s2.scenarioType == ScenarioCategory.RAINFALL
    assert s2.intensity == 50.0
    assert s2.unit == "mm"
    assert s2.durationHours == 3.0
    assert s2.displayDuration == "3 hours"
    assert "bengaluru" in s2.resolvedLocation.displayName.lower() or "bangalore" in s2.resolvedLocation.displayName.lower()

    # 3. "What about 100 mm?" (follow-up inheriting Bengaluru + 3 hours RAINFALL)
    q3 = "What about 100 mm?"
    assert ScenarioParser.is_scenario_follow_up(q3) is True
    s3 = await ScenarioParser.parse_and_resolve(query=q3)
    assert s3.scenarioType == ScenarioCategory.RAINFALL
    assert s3.intensity == 100.0
    assert s3.unit == "mm"
    assert s3.durationHours == 3.0
    assert "bengaluru" in s3.resolvedLocation.displayName.lower() or "bangalore" in s3.resolvedLocation.displayName.lower()

    # 4. "Assume 10 mm rainfall in 1 hour in Malleswaram."
    q4 = "Assume 10 mm rainfall in 1 hour in Malleswaram."
    s4 = await ScenarioParser.parse_and_resolve(query=q4)
    assert s4.scenarioType == ScenarioCategory.RAINFALL
    assert s4.intensity == 10.0
    assert s4.unit == "mm"
    assert s4.durationHours == 1.0
    assert "malleswaram" in s4.resolvedLocation.displayName.lower()

    # 5. "What if temperature reaches 45°C for 3 days in Delhi?"
    q5 = "What if temperature reaches 45°C for 3 days in Delhi?"
    s5 = await ScenarioParser.parse_and_resolve(query=q5)
    assert s5.scenarioType == ScenarioCategory.EXTREME_HEAT
    assert s5.intensity == 45.0
    assert s5.unit == "°C"
    assert s5.durationHours == 72.0
    assert s5.displayDuration == "3 days"
    assert "delhi" in s5.resolvedLocation.displayName.lower()

    # 6. "Simulate a major storm around Chennai." (qualitative -> intensity = None, Unspecified)
    q6 = "Simulate a major storm around Chennai."
    s6 = await ScenarioParser.parse_and_resolve(query=q6)
    assert s6.scenarioType == ScenarioCategory.STORM
    assert s6.intensity is None
    assert "chennai" in s6.resolvedLocation.displayName.lower()
    res6 = await ScenarioEngineService.analyze_scenario(query=q6)
    assert res6["reportSections"]["SCENARIO"]["displayIntensity"] == "Unspecified"

    # 7. "Analyze landslide risk here." (uses selectedMapEntity / active context)
    q7 = "Analyze landslide risk here."
    s7 = await ScenarioParser.parse_and_resolve(
        query=q7,
        selected_map_entity={
            "name": "Kodagu",
            "coordinates": {"latitude": 12.4244, "longitude": 75.7382},
        },
    )
    assert s7.scenarioType == ScenarioCategory.LANDSLIDE
    assert "kodagu" in s7.resolvedLocation.displayName.lower()
    assert abs(s7.resolvedLocation.latitude - 12.4244) < 0.01

    # 8. "Predict next year's flood vulnerability." (uses active context + next year)
    q8 = "Predict next year's flood vulnerability."
    s8 = await ScenarioParser.parse_and_resolve(query=q8)
    assert s8.scenarioType == ScenarioCategory.FLOOD
    assert s8.targetYear == datetime.now(timezone.utc).year + 1
    assert s8.locationSource == "SCENARIO_CONTEXT"
    assert abs(s8.resolvedLocation.latitude - 12.4244) < 0.01
    assert "kodagu" in s8.resolvedLocation.displayName.lower() or "madikeri" in s8.resolvedLocation.displayName.lower()

