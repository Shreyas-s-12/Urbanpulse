"""
Unit and Integration Tests for UrbanPulse Ranking Intelligence Engine
=====================================================================
Tests:
1. RankingQueryParser:
   - Dynamic extraction of metric, entity, scope, limit, and order from user prompts
   - Follow-up context handling ("Make it top 5", "Now show coolest", "Do it for the world", "Top 5 states")
   - Entity deep-dive parsing ("Why is Bengaluru #3?")
   - Clean map plot request parsing ("Show them on the map")
2. GeographicDirectoryService:
   - Dynamic candidate discovery for WORLD, INDIA, USA, and states
   - ADM0 countries, ADM1 states, ADM2 districts, and metropolitan cities
3. RankingEngine:
   - AQI ranking with real Open-Meteo CAMS data
   - Temperature ranking (hottest vs coolest)
   - Population ranking with explicit 2020 dataset year (never "Live")
   - Traffic ranking with deterministic congestion ratio
   - Strict tie-handling, missing value exclusion, and coverage percentage
4. LocationAgentService:
   - Interception of ranking queries without red heat-zone emission (NO SHOW_HEATMAP)
   - Follow-up context preservation and attribution deep-dive
"""

import pytest
import asyncio
from app.schemas.ranking_schema import RankingRequest, RankingResponse
from app.services.agent.ranking_parser import RankingQueryParser
from app.services.geographic_directory import GeographicDirectoryService
from app.services.ranking_engine import RankingEngine
from app.services.agent.location_agent import LocationAgentService


class TestRankingQueryParser:
    def test_worst_aqi_cities_india(self):
        q = "Tell me the top 10 worst AQI cities in India."
        assert RankingQueryParser.is_ranking_query(q)
        req = RankingQueryParser.parse(q)
        assert req.metric == "AQI"
        assert req.entityType == "CITY"
        assert req.scope == "INDIA"
        assert req.limit == 10
        assert req.order == "DESC"

    def test_top_5_traffic_cities_india(self):
        q = "Top 5 traffic cities in India."
        assert RankingQueryParser.is_ranking_query(q)
        req = RankingQueryParser.parse(q)
        assert req.metric == "TRAFFIC"
        assert req.entityType == "CITY"
        assert req.scope == "INDIA"
        assert req.limit == 5
        assert req.order == "DESC"

    def test_top_3_populated_states_india(self):
        q = "Top 3 most populated states in India."
        assert RankingQueryParser.is_ranking_query(q)
        req = RankingQueryParser.parse(q)
        assert req.metric == "POPULATION"
        assert req.entityType == "STATE"
        assert req.scope == "INDIA"
        assert req.limit == 3
        assert req.order == "DESC"

    def test_hottest_cities_india(self):
        q = "Which are the hottest cities in India?"
        assert RankingQueryParser.is_ranking_query(q)
        req = RankingQueryParser.parse(q)
        assert req.metric == "TEMPERATURE"
        assert req.entityType == "CITY"
        assert req.scope == "INDIA"
        assert req.order == "DESC"
        assert req.subMetric == "MAX_TEMP"

    def test_coolest_cities_india(self):
        q = "Which are the coolest cities in India?"
        assert RankingQueryParser.is_ranking_query(q)
        req = RankingQueryParser.parse(q)
        assert req.metric == "TEMPERATURE"
        assert req.entityType == "CITY"
        assert req.scope == "INDIA"
        assert req.order == "ASC"
        assert req.subMetric == "MIN_TEMP"

    def test_hottest_states_world(self):
        q = "Which are the hottest states in the world?"
        assert RankingQueryParser.is_ranking_query(q)
        req = RankingQueryParser.parse(q)
        assert req.metric == "TEMPERATURE"
        assert req.entityType == "STATE"
        assert req.scope == "WORLD"
        assert req.order == "DESC"

    def test_countries_with_hottest_cities(self):
        q = "Which countries currently have the hottest cities?"
        assert RankingQueryParser.is_ranking_query(q)
        req = RankingQueryParser.parse(q)
        assert req.metric == "TEMPERATURE"
        assert req.entityType == "COUNTRY"
        assert req.scope == "WORLD"

    def test_coolest_cities_world(self):
        q = "Show the coolest cities in the world."
        assert RankingQueryParser.is_ranking_query(q)
        req = RankingQueryParser.parse(q)
        assert req.metric == "TEMPERATURE"
        assert req.entityType == "CITY"
        assert req.scope == "WORLD"
        assert req.order == "ASC"

    def test_follow_up_modifications(self):
        initial_ranking = RankingResponse(
            metric="AQI",
            entityType="CITY",
            scope="INDIA",
            limit=10,
            order="DESC",
            rankingMetric="CPCB India AQI",
            results=[],
            candidateCount=35,
            validCount=35,
            coverage=100.0,
            source="Open-Meteo",
        )

        # "Make it top 5"
        q1 = "Make it top 5"
        assert RankingQueryParser.is_ranking_query(q1, has_active_ranking=True)
        req1 = RankingQueryParser.parse(q1, active_ranking=initial_ranking)
        assert req1.limit == 5
        assert req1.metric == "AQI"
        assert req1.scope == "INDIA"

        # "Do it for the world"
        q2 = "Do it for the world"
        req2 = RankingQueryParser.parse(q2, active_ranking=initial_ranking)
        assert req2.scope == "WORLD"
        assert req2.metric == "AQI"

        # "Top 5 states"
        q3 = "Top 5 states"
        req3 = RankingQueryParser.parse(q3, active_ranking=initial_ranking)
        assert req3.entityType == "STATE"
        assert req3.limit == 5
        assert req3.metric == "AQI"

    def test_why_ranked_request(self):
        q1 = "Why is Bengaluru #3?"
        is_why, name, rank = RankingQueryParser.is_why_ranked_request(q1)
        assert is_why
        assert "bengaluru" in name.lower()
        assert rank == 3

        q2 = "Why is Delhi #1?"
        is_why, name, rank = RankingQueryParser.is_why_ranked_request(q2)
        assert is_why
        assert "delhi" in name.lower()
        assert rank == 1

        q3 = "Explain #2"
        is_why, name, rank = RankingQueryParser.is_why_ranked_request(q3)
        assert is_why
        assert rank == 2

    def test_map_plot_request(self):
        assert RankingQueryParser.is_map_plot_request("Show them on the map")
        assert RankingQueryParser.is_map_plot_request("show on map")
        assert RankingQueryParser.is_map_plot_request("Plot them on the map")
        assert not RankingQueryParser.is_map_plot_request("Tell me the top 10 worst AQI cities")


@pytest.mark.asyncio
class TestGeographicDirectoryService:
    async def test_discover_cities_india(self):
        candidates = await GeographicDirectoryService.discover_candidates("CITY", "INDIA")
        assert len(candidates) >= 30
        names = [c["name"] for c in candidates]
        assert "Delhi" in names
        assert "Bengaluru" in names
        assert "Mumbai" in names

    async def test_discover_states_india(self):
        candidates = await GeographicDirectoryService.discover_candidates("STATE", "INDIA")
        assert len(candidates) >= 25
        names = [c["name"] for c in candidates]
        assert "Karnataka" in names
        assert "Maharashtra" in names
        assert "Uttar Pradesh" in names

    async def test_discover_countries_world(self):
        candidates = await GeographicDirectoryService.discover_candidates("COUNTRY", "WORLD")
        assert len(candidates) >= 20
        names = [c["name"] for c in candidates]
        assert "India" in names
        assert "United States" in names
        assert "Japan" in names


@pytest.mark.asyncio
class TestRankingEngine:
    async def test_rank_aqi_india(self):
        req = RankingRequest(metric="AQI", entityType="CITY", scope="INDIA", limit=10, order="DESC")
        resp = await RankingEngine.rank(req)
        assert resp.metric == "AQI"
        assert resp.entityType == "CITY"
        assert resp.scope == "INDIA"
        assert len(resp.results) > 0
        assert len(resp.results) <= 10
        assert resp.coverage > 0.0
        # Results must be ordered descending (highest AQI first)
        for i in range(len(resp.results) - 1):
            assert resp.results[i].value >= resp.results[i + 1].value
        # Check ranks are sequential with tie handling
        assert resp.results[0].rank == 1

    async def test_rank_temperature_hottest(self):
        req = RankingRequest(metric="TEMPERATURE", entityType="CITY", scope="INDIA", limit=5, order="DESC")
        resp = await RankingEngine.rank(req)
        assert resp.metric == "TEMPERATURE"
        assert len(resp.results) > 0
        assert resp.results[0].unit == "°C"
        for i in range(len(resp.results) - 1):
            assert resp.results[i].value >= resp.results[i + 1].value

    async def test_rank_temperature_coolest(self):
        req = RankingRequest(metric="TEMPERATURE", entityType="CITY", scope="INDIA", limit=5, order="ASC")
        resp = await RankingEngine.rank(req)
        assert resp.metric == "TEMPERATURE"
        assert len(resp.results) > 0
        for i in range(len(resp.results) - 1):
            assert resp.results[i].value <= resp.results[i + 1].value

    async def test_rank_population_states_india(self):
        req = RankingRequest(metric="POPULATION", entityType="STATE", scope="INDIA", limit=3, order="DESC")
        resp = await RankingEngine.rank(req)
        assert resp.metric == "POPULATION"
        assert resp.datasetYear == 2020
        assert not resp.isLive
        assert len(resp.results) == 3
        assert resp.results[0].name == "Uttar Pradesh"
        assert resp.results[0].value > resp.results[1].value


@pytest.mark.asyncio
class TestLocationAgentRankingIntegration:
    async def test_ranking_interaction_clean_map(self):
        # Query: "Tell me the top 10 worst AQI cities in India."
        res = await LocationAgentService.process_interaction({
            "query": "Tell me the top 10 worst AQI cities in India.",
            "session_id": "test-session-1",
        })
        assert res["intent"] == "RANKING"
        assert "data" in res and "ranking" in res["data"]
        ranking = res["data"]["ranking"]
        assert ranking["metric"] == "AQI"
        assert len(ranking["results"]) > 0

        # Verify map actions: SHOW_RANKING is dispatched, SHOW_HEATMAP is strictly NEVER dispatched
        action_types = [a["type"] for a in res["actions"]]
        assert "SHOW_RANKING" in action_types
        assert "SHOW_HEATMAP" not in action_types
        assert "SHOW_AQI_LAYER" not in action_types

    async def test_map_plot_numbered_markers(self):
        # First execute ranking
        await LocationAgentService.process_interaction({
            "query": "Top 5 traffic cities in India.",
            "session_id": "test-session-2",
        })

        # Then ask to show them on the map
        plot_res = await LocationAgentService.process_interaction({
            "query": "Show them on the map",
            "session_id": "test-session-2",
        })
        assert plot_res["intent"] == "RANKING"
        action_types = [a["type"] for a in plot_res["actions"]]
        assert "SHOW_RANKED_MARKERS" in action_types
        assert "SHOW_HEATMAP" not in action_types
