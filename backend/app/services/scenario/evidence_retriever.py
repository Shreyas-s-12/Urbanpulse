"""
EvidenceRetriever for the Generalized UrbanPulse Scenario Intelligence Engine.
Selectively retrieves only the environmental, historical, geospatial, and infrastructure
evidence sources relevant to the active ScenarioCategory.
Tracks exact availability of every source so the engine never claims data exists when unavailable.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import math
import httpx

from app.services.providers.weather_provider import WeatherProvider
from app.services.providers.air_quality_provider import AirQualityProvider
from app.services.providers.road_provider import RoadProvider
from app.services.providers.earthquake_provider import EarthquakeProvider
from app.services.providers.worldpop_provider import WorldPopProvider
from app.services.scenario.models import ScenarioCategory, ScenarioDefinition
from app.services.scenario.registry import ScenarioRegistry


class EvidenceRetriever:
    """
    Retrieves scenario-relevant evidence across live observations, multi-year historical archives,
    DEM elevation/slope grids, road/waterway networks, and population exposure datasets.
    """

    _DEM_CACHE: Dict[str, Dict[str, Any]] = {}
    _ARCHIVE_CACHE: Dict[str, Dict[str, Any]] = {}
    _OSM_INFRA_CACHE: Dict[str, Dict[str, Any]] = {}

    @classmethod
    async def retrieve_evidence(cls, scenario: ScenarioDefinition) -> Dict[str, Any]:
        cat = scenario.scenarioType
        spec = ScenarioRegistry.get_spec(cat)
        lat = scenario.latitude
        lon = scenario.longitude
        radius_km = scenario.radius

        evidence: Dict[str, Any] = {
            "category": cat.value,
            "relevantSourcesRequested": spec.relevantEvidenceSources,
            "availability": {
                "locationResolved": bool(scenario.resolvedLocation and scenario.resolvedLocation.isResolved),
                "currentWeather": False,
                "historicalArchive": False,
                "demElevation": False,
                "slopeComputed": False,
                "drainageNetwork": False,
                "roadNetwork": False,
                "seismicCatalog": False,
                "airQuality": False,
                "populationExposure": False,
                "liveSensorTelemetry": False,
            },
            "currentObservations": {},
            "historicalArchive": {},
            "geospatial": {},
            "infrastructure": {},
            "population": {},
            "retrievedSources": [],
        }

        if lat is None or lon is None:
            return evidence

        # Determine which evidence domains are relevant to this ScenarioCategory
        needs_weather = cat in (
            ScenarioCategory.RAINFALL,
            ScenarioCategory.FLOOD,
            ScenarioCategory.STORM,
            ScenarioCategory.CYCLONE,
            ScenarioCategory.EXTREME_HEAT,
            ScenarioCategory.DROUGHT,
            ScenarioCategory.LANDSLIDE,
            ScenarioCategory.WILDFIRE,
            ScenarioCategory.WATER_LEVEL_RISE,
            ScenarioCategory.COASTAL_INUNDATION,
            ScenarioCategory.STORM_SURGE,
            ScenarioCategory.AIR_QUALITY_EVENT,
            ScenarioCategory.EXTREME_WIND,
            ScenarioCategory.OTHER,
        )
        needs_dem = cat in (
            ScenarioCategory.RAINFALL,
            ScenarioCategory.FLOOD,
            ScenarioCategory.LANDSLIDE,
            ScenarioCategory.CYCLONE,
            ScenarioCategory.WATER_LEVEL_RISE,
            ScenarioCategory.COASTAL_INUNDATION,
            ScenarioCategory.STORM_SURGE,
            ScenarioCategory.EARTHQUAKE,
            ScenarioCategory.WILDFIRE,
            ScenarioCategory.AIR_QUALITY_EVENT,
            ScenarioCategory.EXTREME_WIND,
            ScenarioCategory.OTHER,
        )
        needs_drainage = cat in (
            ScenarioCategory.RAINFALL,
            ScenarioCategory.FLOOD,
            ScenarioCategory.WATER_LEVEL_RISE,
            ScenarioCategory.STORM,
        )
        needs_roads = cat in (
            ScenarioCategory.RAINFALL,
            ScenarioCategory.FLOOD,
            ScenarioCategory.STORM,
            ScenarioCategory.CYCLONE,
            ScenarioCategory.LANDSLIDE,
            ScenarioCategory.EARTHQUAKE,
            ScenarioCategory.WILDFIRE,
            ScenarioCategory.WATER_LEVEL_RISE,
            ScenarioCategory.COASTAL_INUNDATION,
            ScenarioCategory.STORM_SURGE,
            ScenarioCategory.EXTREME_WIND,
            ScenarioCategory.ROAD_DISRUPTION,
            ScenarioCategory.OTHER,
        )
        needs_seismic = cat == ScenarioCategory.EARTHQUAKE
        needs_aqi = cat in (
            ScenarioCategory.AIR_QUALITY_EVENT,
            ScenarioCategory.WILDFIRE,
            ScenarioCategory.EXTREME_HEAT,
        )

        # 1. Current Meteorological Observations (if relevant)
        if needs_weather:
            try:
                w_data = WeatherProvider.get_weather(lat, lon)
                if w_data and w_data.get("status") == "AVAILABLE":
                    evidence["currentObservations"]["weather"] = w_data.get("current", {})
                    evidence["currentObservations"]["weatherSource"] = w_data.get("source", "Open-Meteo API")
                    evidence["currentObservations"]["lastUpdated"] = w_data.get("lastUpdated")
                    evidence["availability"]["currentWeather"] = True
                    evidence["retrievedSources"].append({
                        "name": "Open-Meteo Live Meteorological Observations",
                        "type": "CURRENT OBSERVATION",
                        "status": "AVAILABLE",
                    })
            except Exception:
                pass

        # 2. Current Air Quality Observations (if relevant)
        if needs_aqi:
            try:
                aq_call = AirQualityProvider.get_air_quality(lat, lon)
                aq_data = await aq_call if hasattr(aq_call, "__await__") else aq_call
                if aq_data and aq_data.get("status") == "AVAILABLE":
                    evidence["currentObservations"]["airQuality"] = aq_data
                    evidence["availability"]["airQuality"] = True
                    evidence["retrievedSources"].append({
                        "name": aq_data.get("source", "Open-Meteo / WAQI Air Quality Telemetry"),
                        "type": "CURRENT OBSERVATION",
                        "status": "AVAILABLE",
                    })
            except Exception:
                pass

        # 3. DEM Elevation & 9-Point Terrain Slope Profile (if relevant)
        if needs_dem:
            dem_res = await cls._fetch_dem_and_slope(lat, lon, radius_km)
            if dem_res and dem_res.get("status") == "AVAILABLE":
                evidence["geospatial"]["dem"] = dem_res
                evidence["availability"]["demElevation"] = True
                evidence["availability"]["slopeComputed"] = True
                evidence["retrievedSources"].append({
                    "name": "Copernicus / SRTM 90m Digital Elevation Model (Open-Meteo Elevation API)",
                    "type": "CURRENT OBSERVATION",
                    "status": "AVAILABLE",
                })

        # 4. Road Network & Waterway/Drainage Geometry via OpenStreetMap (if relevant)
        if needs_roads or needs_drainage:
            infra_res = await cls._fetch_osm_infrastructure(lat, lon, radius_km, needs_drainage=needs_drainage)
            if infra_res:
                evidence["infrastructure"] = infra_res
                if infra_res.get("roadsAvailable"):
                    evidence["availability"]["roadNetwork"] = True
                    evidence["retrievedSources"].append({
                        "name": "OpenStreetMap Road Network & Corridor Hierarchy",
                        "type": "CURRENT OBSERVATION",
                        "status": "AVAILABLE",
                    })
                if needs_drainage and infra_res.get("waterwaysAvailable"):
                    evidence["availability"]["drainageNetwork"] = True
                    evidence["retrievedSources"].append({
                        "name": "OpenStreetMap Hydrographic & Waterway Network",
                        "type": "CURRENT OBSERVATION",
                        "status": "AVAILABLE",
                    })

        # 5. Multi-Year Historical Meteorological Archive (if relevant)
        if needs_weather:
            hist_res = await cls._fetch_historical_weather_archive(
                lat=lat,
                lon=lon,
                window_years=scenario.historicalWindowYears,
                category=cat,
            )
            if hist_res and hist_res.get("status") == "AVAILABLE":
                evidence["historicalArchive"]["weather"] = hist_res
                evidence["availability"]["historicalArchive"] = True
                evidence["retrievedSources"].append({
                    "name": f"ERA5 / Open-Meteo Historical Reanalysis Archive ({hist_res.get('yearsCoveredStr')})",
                    "type": "HISTORICAL EVIDENCE",
                    "status": "AVAILABLE",
                })

        # 6. Historical Earthquake Catalog from USGS (if EARTHQUAKE scenario)
        if needs_seismic:
            try:
                eq_data = EarthquakeProvider.get_recent_earthquakes(lat, lon, radius_km=max(250.0, radius_km * 10))
                if eq_data and eq_data.get("status") in ("AVAILABLE", "NO_RECENT_EVENTS"):
                    evidence["historicalArchive"]["seismic"] = eq_data
                    evidence["availability"]["seismicCatalog"] = True
                    evidence["availability"]["historicalArchive"] = True
                    evidence["retrievedSources"].append({
                        "name": "USGS FDSN Earthquake Hazards Historical & Real-Time Catalog",
                        "type": "HISTORICAL EVIDENCE",
                        "status": "AVAILABLE",
                    })
            except Exception:
                pass

        # 7. Population Exposure Dataset
        try:
            pop_data = WorldPopProvider.get_population_context(lat, lon, radius_km=radius_km)
            if pop_data and pop_data.get("status") == "AVAILABLE":
                evidence["population"] = pop_data
                evidence["availability"]["populationExposure"] = True
                evidence["retrievedSources"].append({
                    "name": pop_data.get("source", "WorldPop / UN Gridded Population Dataset"),
                    "type": "CURRENT OBSERVATION",
                    "status": "AVAILABLE",
                })
        except Exception:
            pass

        return evidence

    @classmethod
    async def _fetch_dem_and_slope(cls, lat: float, lon: float, radius_km: float) -> Optional[Dict[str, Any]]:
        """
        Fetches 9-point Digital Elevation Model (DEM) sample grid (center + 8 compass points)
        from Open-Meteo Elevation API (Copernicus DEM GLO-90) to compute:
        - center elevation (m)
        - min / max / mean surrounding elevation (m)
        - topographic depression index (m below surrounding mean -> positive means basin/low-lying pocket)
        - terrain slope gradient (degrees)
        """
        cache_key = f"{round(lat, 3)}:{round(lon, 3)}:{round(radius_km, 1)}"
        if cache_key in cls._DEM_CACHE:
            return cls._DEM_CACHE[cache_key]

        # Sample step at ~1 km (or radius * 0.25, bounded between 0.5km and 2.5km)
        step_km = max(0.5, min(2.5, radius_km * 0.3))
        d_lat = step_km / 111.32
        d_lon = step_km / max(10.0, 111.32 * abs(math.cos(math.radians(lat))))

        sample_points = [
            ("Center", lat, lon),
            ("North", lat + d_lat, lon),
            ("South", lat - d_lat, lon),
            ("East", lat, lon + d_lon),
            ("West", lat, lon - d_lon),
            ("NorthEast", lat + d_lat * 0.707, lon + d_lon * 0.707),
            ("NorthWest", lat + d_lat * 0.707, lon - d_lon * 0.707),
            ("SouthEast", lat - d_lat * 0.707, lon + d_lon * 0.707),
            ("SouthWest", lat - d_lat * 0.707, lon - d_lon * 0.707),
        ]
        lats_str = ",".join(f"{p[1]:.5f}" for p in sample_points)
        lons_str = ",".join(f"{p[2]:.5f}" for p in sample_points)

        try:
            async with httpx.AsyncClient(timeout=4.5) as client:
                resp = await client.get(
                    "https://api.open-meteo.com/v1/elevation",
                    params={"latitude": lats_str, "longitude": lons_str},
                )
                if resp.status_code == 200:
                    elevs = resp.json().get("elevation", [])
                    if elevs and len(elevs) == len(sample_points):
                        center_elev = float(elevs[0])
                        surrounding_elevs = [float(e) for e in elevs[1:]]
                        min_elev = min(elevs)
                        max_elev = max(elevs)
                        mean_surrounding = sum(surrounding_elevs) / len(surrounding_elevs)
                        relief_m = round(max_elev - min_elev, 1)
                        # Depression depth: how much lower the center/lowest sector is relative to surrounding mean
                        depression_m = round(max(0.0, mean_surrounding - min_elev), 1)
                        # Compute maximum slope angle across sample step
                        max_diff_m = max(abs(center_elev - e) for e in surrounding_elevs)
                        slope_rad = math.atan2(max_diff_m, step_km * 1000.0)
                        slope_deg = round(math.degrees(slope_rad), 2)

                        # Identify lowest compass sector for accurate spatial localization
                        lowest_idx = int(min(range(len(elevs)), key=lambda idx: elevs[idx]))
                        lowest_sector = sample_points[lowest_idx]

                        result = {
                            "status": "AVAILABLE",
                            "source": "Copernicus GLO-90 Digital Elevation Model via Open-Meteo",
                            "centerElevationM": round(center_elev, 1),
                            "minElevationM": round(float(min_elev), 1),
                            "maxElevationM": round(float(max_elev), 1),
                            "meanSurroundingElevationM": round(mean_surrounding, 1),
                            "elevationReliefM": relief_m,
                            "depressionDepthM": depression_m,
                            "maxSlopeDegrees": slope_deg,
                            "isLowLyingCoastal": center_elev <= 12.0,
                            "lowestSector": {
                                "direction": lowest_sector[0],
                                "latitude": round(lowest_sector[1], 5),
                                "longitude": round(lowest_sector[2], 5),
                                "elevationM": round(float(elevs[lowest_idx]), 1),
                            },
                            "gridSamples": [
                                {
                                    "direction": sample_points[i][0],
                                    "latitude": round(sample_points[i][1], 5),
                                    "longitude": round(sample_points[i][2], 5),
                                    "elevationM": round(float(elevs[i]), 1),
                                }
                                for i in range(len(sample_points))
                            ],
                        }
                        cls._DEM_CACHE[cache_key] = result
                        return result
        except Exception:
            pass
        return None

    @classmethod
    async def _fetch_osm_infrastructure(
        cls,
        lat: float,
        lon: float,
        radius_km: float,
        needs_drainage: bool = False,
    ) -> Dict[str, Any]:
        """
        Retrieves real road network corridors and hydrographic waterways/drainage features
        around (lat, lon) via RoadProvider and Overpass API.
        """
        cache_key = f"{round(lat, 3)}:{round(lon, 3)}:{needs_drainage}"
        if cache_key in cls._OSM_INFRA_CACHE:
            return cls._OSM_INFRA_CACHE[cache_key]

        road_status = await RoadProvider.get_road_status_async(lat, lon, radius_km=min(radius_km, 10.0))
        net = road_status.get("network", {})
        sample_highway = net.get("sampleHighwayName")

        named_roads: List[Dict[str, Any]] = []
        waterways: List[Dict[str, Any]] = []
        waterways_available = False

        # Query Overpass briefly for named primary/secondary roads & waterways within 2.5km
        search_r_m = int(min(2500, max(1000, radius_km * 450)))
        overpass_query = f"""
        [out:json][timeout:4];
        (
          way["highway"~"^(trunk|primary|secondary|tertiary)$"]["name"](around:{search_r_m},{lat},{lon});
          way["waterway"~"^(river|canal|stream|drain)$"](around:{search_r_m},{lat},{lon});
        );
        out center tags 20;
        """
        try:
            async with httpx.AsyncClient(timeout=4.5) as client:
                resp = await client.post(
                    "https://overpass-api.de/api/interpreter",
                    data={"data": overpass_query},
                )
                if resp.status_code == 200:
                    elements = resp.json().get("elements", [])
                    seen_names = set()
                    for el in elements:
                        tags = el.get("tags", {})
                        center = el.get("center") or {"lat": lat, "lon": lon}
                        if "highway" in tags and tags.get("name"):
                            r_name = tags["name"]
                            if r_name not in seen_names:
                                seen_names.add(r_name)
                                named_roads.append({
                                    "roadId": f"osm-way-{el.get('id')}",
                                    "roadName": r_name,
                                    "roadClass": tags.get("highway", "arterial"),
                                    "surface": tags.get("surface", "asphalt"),
                                    "bridge": tags.get("bridge") == "yes",
                                    "tunnel": tags.get("tunnel") == "yes",
                                    "center": {
                                        "latitude": float(center.get("lat", lat)),
                                        "longitude": float(center.get("lon", lon)),
                                    },
                                })
                        elif "waterway" in tags:
                            waterways_available = True
                            waterways.append({
                                "waterwayId": f"osm-water-{el.get('id')}",
                                "name": tags.get("name") or f"Mapped {tags.get('waterway', 'channel').title()}",
                                "type": tags.get("waterway", "drain"),
                                "center": {
                                    "latitude": float(center.get("lat", lat)),
                                    "longitude": float(center.get("lon", lon)),
                                },
                            })
        except Exception:
            pass

        if not named_roads and sample_highway:
            named_roads.append({
                "roadId": "osm-primary-corridor",
                "roadName": sample_highway,
                "roadClass": "primary",
                "surface": "asphalt",
                "bridge": False,
                "tunnel": False,
                "center": {"latitude": lat, "longitude": lon},
            })

        res = {
            "roadsAvailable": bool(named_roads or net.get("status") == "AVAILABLE"),
            "namedRoads": named_roads[:8],
            "roadNetworkSummary": net,
            "waterwaysAvailable": waterways_available,
            "waterways": waterways[:6],
            "subsurfaceDrainageTelemetryAvailable": False,  # Sub-surface pipe capacity sensors require municipal SCADA
        }
        cls._OSM_INFRA_CACHE[cache_key] = res
        return res

    @classmethod
    async def _fetch_historical_weather_archive(
        cls,
        lat: float,
        lon: float,
        window_years: List[int],
        category: ScenarioCategory,
    ) -> Optional[Dict[str, Any]]:
        """
        Fetches multi-year daily historical observations from Open-Meteo Archive API
        across `window_years` (e.g., 2023..2027 when predicting for 2028) to enable
        evidence-based historical comparison without fabricating events.
        """
        now_utc = datetime.now(timezone.utc)
        valid_years = [y for y in window_years if 1950 <= y <= now_utc.year]
        if not valid_years:
            valid_years = list(range(now_utc.year - 5, now_utc.year))

        start_year = min(valid_years)
        end_year = max(valid_years)
        start_date = f"{start_year}-01-01"
        # End date capped at 5 days ago if end_year is current year
        if end_year >= now_utc.year:
            end_dt = now_utc - timedelta(days=5)
            end_date = end_dt.strftime("%Y-%m-%d")
        else:
            end_date = f"{end_year}-12-31"

        cache_key = f"{round(lat, 2)}:{round(lon, 2)}:{start_date}:{end_date}"
        if cache_key in cls._ARCHIVE_CACHE:
            return cls._ARCHIVE_CACHE[cache_key]

        params = {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "start_date": start_date,
            "end_date": end_date,
            "daily": "precipitation_sum,rain_sum,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max",
            "timezone": "UTC",
        }

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get("https://archive-api.open-meteo.com/v1/archive", params=params)
                if resp.status_code == 200:
                    daily = resp.json().get("daily", {})
                    dates = daily.get("time", [])
                    precip_list = daily.get("precipitation_sum", [])
                    temp_max_list = daily.get("temperature_2m_max", [])
                    wind_max_list = daily.get("wind_speed_10m_max", [])
                    gust_max_list = daily.get("wind_gusts_10m_max", [])

                    if dates:
                        records = []
                        for i, d_str in enumerate(dates):
                            p_val = precip_list[i] if i < len(precip_list) and precip_list[i] is not None else 0.0
                            t_max = temp_max_list[i] if i < len(temp_max_list) and temp_max_list[i] is not None else None
                            w_max = wind_max_list[i] if i < len(wind_max_list) and wind_max_list[i] is not None else 0.0
                            g_max = gust_max_list[i] if i < len(gust_max_list) and gust_max_list[i] is not None else w_max
                            records.append({
                                "date": d_str,
                                "year": int(d_str[:4]),
                                "precipitationMm": round(float(p_val), 1),
                                "tempMaxC": round(float(t_max), 1) if t_max is not None else None,
                                "windMaxKmh": round(float(w_max), 1),
                                "gustMaxKmh": round(float(g_max), 1),
                            })

                        years_covered = sorted(list({r["year"] for r in records}))
                        result = {
                            "status": "AVAILABLE",
                            "source": "Open-Meteo ERA5 Reanalysis Historical Archive",
                            "startDate": start_date,
                            "endDate": end_date,
                            "yearsCovered": years_covered,
                            "yearsCoveredStr": ", ".join(str(y) for y in years_covered),
                            "totalDaysSampled": len(records),
                            "records": records,
                        }
                        cls._ARCHIVE_CACHE[cache_key] = result
                        return result
        except Exception:
            pass
        return None
