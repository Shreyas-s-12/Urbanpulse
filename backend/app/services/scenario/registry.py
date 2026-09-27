"""
ScenarioRegistry for the Generalized UrbanPulse Scenario Intelligence Engine.
Configures scenario-specific environmental/geospatial factors, historical comparison
dimensions, evidence sources, 4-factor impact models, non-alarmist thresholds, and
recommended real-time telemetry inputs for each scenario category.
Additional scenario categories can be registered dynamically without rewriting the engine.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.services.scenario.models import ScenarioCategory


class FactorSpec(BaseModel):
    factorId: str
    name: str
    description: str
    primaryVariables: List[str]


class ScenarioCategorySpec(BaseModel):
    category: ScenarioCategory
    displayName: str
    defaultUnit: str
    aliases: List[str] = Field(default_factory=list)
    relevantEvidenceSources: List[str]
    comparisonDimensions: List[str]
    geospatialLayers: List[str]
    fourFactors: List[FactorSpec]
    recommendedRealtimeInputs: List[str]
    affectedDomains: List[str]
    # Thresholds for non-alarmist evaluation:
    # below `notableThreshold`, the scenario is routine/minor and does NOT cause damage or disruption
    routineMaxIntensity: float
    moderateThresholdIntensity: float
    severeThresholdIntensity: float


class ScenarioRegistry:
    """
    Central extensible registry mapping ScenarioCategory to its domain specification.
    """

    _REGISTRY: Dict[ScenarioCategory, ScenarioCategorySpec] = {}
    _CUSTOM_REGISTRY: Dict[str, ScenarioCategorySpec] = {}

    @classmethod
    def register(cls, spec: ScenarioCategorySpec) -> None:
        cls._REGISTRY[spec.category] = spec
        cls._CUSTOM_REGISTRY[spec.category.value.upper()] = spec
        for alias in spec.aliases:
            cls._CUSTOM_REGISTRY[alias.lower().strip()] = spec

    @classmethod
    def register_custom_type(cls, type_name: str, spec: ScenarioCategorySpec) -> None:
        """Allows registering new scenario types at runtime without modifying engine code."""
        cls._CUSTOM_REGISTRY[type_name.upper().strip()] = spec
        cls._CUSTOM_REGISTRY[type_name.lower().strip()] = spec

    @classmethod
    def get_spec(cls, category_or_name: Any) -> ScenarioCategorySpec:
        if not cls._REGISTRY:
            cls._initialize_defaults()
        if isinstance(category_or_name, ScenarioCategory):
            return cls._REGISTRY.get(category_or_name, cls._REGISTRY[ScenarioCategory.OTHER])
        key = str(category_or_name or "").strip()
        if key.upper() in cls._CUSTOM_REGISTRY:
            return cls._CUSTOM_REGISTRY[key.upper()]
        if key.lower() in cls._CUSTOM_REGISTRY:
            return cls._CUSTOM_REGISTRY[key.lower()]
        try:
            cat = ScenarioCategory(key.upper())
            return cls._REGISTRY[cat]
        except Exception:
            return cls._REGISTRY[ScenarioCategory.OTHER]

    @classmethod
    def resolve_category(cls, raw_type_or_query: str) -> ScenarioCategory:
        if not cls._REGISTRY:
            cls._initialize_defaults()
        s = (raw_type_or_query or "").strip().lower()
        if s.upper() in ScenarioCategory.__members__:
            return ScenarioCategory[s.upper()]
        if s in cls._CUSTOM_REGISTRY:
            return cls._CUSTOM_REGISTRY[s].category
        # Check substring matches against registered aliases in priority order
        priority_order = [
            ScenarioCategory.EARTHQUAKE,
            ScenarioCategory.LANDSLIDE,
            ScenarioCategory.CYCLONE,
            ScenarioCategory.STORM_SURGE,
            ScenarioCategory.COASTAL_INUNDATION,
            ScenarioCategory.WATER_LEVEL_RISE,
            ScenarioCategory.WILDFIRE,
            ScenarioCategory.DROUGHT,
            ScenarioCategory.EXTREME_HEAT,
            ScenarioCategory.EXTREME_WIND,
            ScenarioCategory.AIR_QUALITY_EVENT,
            ScenarioCategory.ROAD_DISRUPTION,
            ScenarioCategory.FLOOD,
            ScenarioCategory.STORM,
            ScenarioCategory.RAINFALL,
        ]
        for cat in priority_order:
            spec = cls._REGISTRY[cat]
            for alias in spec.aliases:
                if alias in s:
                    return cat
        return ScenarioCategory.OTHER

    @classmethod
    def list_categories(cls) -> List[Dict[str, Any]]:
        if not cls._REGISTRY:
            cls._initialize_defaults()
        return [
            {
                "category": spec.category.value,
                "displayName": spec.displayName,
                "defaultUnit": spec.defaultUnit,
                "fourFactors": [f.name for f in spec.fourFactors],
                "comparisonDimensions": spec.comparisonDimensions,
                "relevantEvidenceSources": spec.relevantEvidenceSources,
                "recommendedRealtimeInputs": spec.recommendedRealtimeInputs,
            }
            for spec in cls._REGISTRY.values()
        ]

    @classmethod
    def _initialize_defaults(cls) -> None:
        specs = [
            ScenarioCategorySpec(
                category=ScenarioCategory.RAINFALL,
                displayName="Rainfall Scenario",
                defaultUnit="mm",
                aliases=[
                    "rainfall",
                    "heavy_rainfall",
                    "heavy_rain",
                    "rain",
                    "precipitation",
                    "precipitation_surge",
                    "rainfall_increase",
                    "downpour",
                    "cloudburst",
                    "mm rainfall",
                    "mm of rainfall",
                    "mm rain",
                ],
                relevantEvidenceSources=[
                    "Historical rainfall records (Open-Meteo Archive)",
                    "Current meteorological observations (Open-Meteo Live)",
                    "DEM / Elevation & local terrain depression analysis",
                    "Road network hierarchy & geometry (OpenStreetMap)",
                    "Drainage & waterway proximity",
                    "Land cover / impervious surface proxy",
                    "Historical waterlogging & urban incident memory",
                ],
                comparisonDimensions=[
                    "rainfall intensity (mm/hr)",
                    "rainfall duration (hours)",
                    "antecedent / previous 72h rainfall",
                    "elevation & micro-topographic gradient",
                    "drainage network presence",
                    "land use / built-up surface fraction",
                    "historical waterlogging incidents",
                ],
                geospatialLayers=[
                    "DEM / Elevation",
                    "Slope",
                    "Drainage & Waterways",
                    "Road Network",
                    "Land Use / Built-Up Areas",
                    "Historical Incident Locations",
                ],
                fourFactors=[
                    FactorSpec(
                        factorId="waterlogging_susceptibility",
                        name="Waterlogging susceptibility",
                        description="Topographic depression index, elevation gradient, and surface runoff accumulation potential.",
                        primaryVariables=["elevation_m", "depression_index", "rainfall_intensity_mm_hr"],
                    ),
                    FactorSpec(
                        factorId="drainage_stress",
                        name="Drainage stress",
                        description="Ratio of scenario runoff rate to local storm drainage capacity and antecedent soil moisture.",
                        primaryVariables=["rainfall_intensity_mm_hr", "duration_hours", "waterway_density"],
                    ),
                    FactorSpec(
                        factorId="road_disruption",
                        name="Road disruption",
                        description="Potential travel speed reduction or localized pooling on low-lying arterial and collector corridors.",
                        primaryVariables=["road_network_density", "low_lying_road_segments", "rainfall_intensity_mm_hr"],
                    ),
                    FactorSpec(
                        factorId="exposure",
                        name="Exposure",
                        description="Built-up urban density and resident/commuter population within the scenario footprint.",
                        primaryVariables=["population_density", "built_up_fraction", "radius_km"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "Live tipping-bucket rain gauge telemetry",
                    "Doppler weather radar reflectivity (dBZ)",
                    "Local weather station observations",
                    "Stormwater drainage channel level & pump station status",
                ],
                affectedDomains=["WEATHER", "ROADS", "TRAFFIC", "DRAINAGE"],
                # 0-15 mm/hr is light-to-moderate rain (routine drainage handling, NO automatic flood!)
                routineMaxIntensity=15.0,
                moderateThresholdIntensity=35.0,
                severeThresholdIntensity=65.0,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.FLOOD,
                displayName="Flood / Inundation Scenario",
                defaultUnit="m",
                aliases=["flood", "flooding", "flood_scenario", "flash flood", "urban flood", "inundation"],
                relevantEvidenceSources=[
                    "River / water-level records",
                    "Historical rainfall & flood disaster records",
                    "DEM / Elevation & floodplain topography",
                    "Drainage & river network geometry",
                    "Road network & underpass inventory",
                    "Land cover & impervious surface distribution",
                    "Population exposure dataset",
                ],
                comparisonDimensions=[
                    "water depth / rainfall volume",
                    "duration",
                    "elevation & floodplain proximity",
                    "drainage & river network capacity",
                    "historical flood events",
                ],
                geospatialLayers=[
                    "DEM / Elevation",
                    "River & Drainage Network",
                    "Water Bodies",
                    "Road Network",
                    "Built-Up Areas",
                    "Historical Incident Locations",
                ],
                fourFactors=[
                    FactorSpec(
                        factorId="waterlogging_susceptibility",
                        name="Waterlogging & Floodplain Susceptibility",
                        description="Terrain elevation relative to nearby water bodies and topographic basins.",
                        primaryVariables=["elevation_m", "depression_index", "water_proximity"],
                    ),
                    FactorSpec(
                        factorId="drainage_stress",
                        name="Hydrological & Drainage Stress",
                        description="Channel conveyance load and upstream runoff accumulation.",
                        primaryVariables=["intensity", "waterway_density"],
                    ),
                    FactorSpec(
                        factorId="road_disruption",
                        name="Road & Corridor Disruption",
                        description="Vulnerability of low-elevation road segments and bridge/underpass crossings.",
                        primaryVariables=["road_network_density", "elevation_m"],
                    ),
                    FactorSpec(
                        factorId="exposure",
                        name="Population & Infrastructure Exposure",
                        description="Concentration of residents and critical assets in low-lying sectors.",
                        primaryVariables=["population_density", "built_up_fraction"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "River level gauge telemetry",
                    "Urban water-level sensors in underpasses",
                    "Quantitative precipitation radar",
                    "Drainage channel flow sensors",
                    "Verified municipal road closure feeds",
                ],
                affectedDomains=["FLOOD", "ROADS", "TRAFFIC", "INFRASTRUCTURE"],
                routineMaxIntensity=0.1,
                moderateThresholdIntensity=0.4,
                severeThresholdIntensity=1.0,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.EXTREME_HEAT,
                displayName="Extreme Heat Scenario",
                defaultUnit="°C",
                aliases=[
                    "extreme_heat",
                    "heat",
                    "heatwave",
                    "heat_wave",
                    "heat wave",
                    "temperature",
                    "temperature_increase",
                    "high temperature",
                    "°c",
                    "degrees celsius",
                    "thermal stress",
                ],
                relevantEvidenceSources=[
                    "Historical temperature & humidity records (Open-Meteo Archive)",
                    "Current ambient temperature & apparent heat index (Open-Meteo Live)",
                    "Land cover & impervious built-up density (Urban Heat Island proxy)",
                    "Historical heat wave events",
                    "Population density & vulnerable demographic exposure",
                    "Water & energy demand baseline proxies",
                ],
                comparisonDimensions=[
                    "peak ambient temperature (°C)",
                    "event duration (days/hours)",
                    "relative humidity (%)",
                    "historical heat events & seasonal 95th percentile",
                    "land cover / tree canopy vs impervious surface",
                    "built-up urban density",
                ],
                geospatialLayers=[
                    "Land Cover",
                    "Built-Up Areas & Urban Density",
                    "Water Bodies (Cooling Buffers)",
                    "Population Exposure",
                ],
                fourFactors=[
                    FactorSpec(
                        factorId="heat_exposure",
                        name="Heat exposure",
                        description="Magnitude of scenario temperature relative to local climatological maxima and apparent heat index.",
                        primaryVariables=["scenario_temp_c", "historical_p95_temp_c", "humidity"],
                    ),
                    FactorSpec(
                        factorId="built_environment_heat",
                        name="Built-environment heat",
                        description="Urban Heat Island (UHI) amplification from impervious surfaces and nocturnal heat retention.",
                        primaryVariables=["built_up_fraction", "elevation_m"],
                    ),
                    FactorSpec(
                        factorId="water_demand_stress",
                        name="Water demand stress",
                        description="Projected surge in municipal water consumption and evaporative loss during sustained heat.",
                        primaryVariables=["scenario_temp_c", "duration_hours", "population_density"],
                    ),
                    FactorSpec(
                        factorId="population_exposure",
                        name="Population exposure",
                        description="Density of outdoor workers, commuters, and residents exposed to elevated thermal stress.",
                        primaryVariables=["population_density", "radius_km"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "Current weather station temperature & wet-bulb globe temperature (WBGT)",
                    "Live relative humidity telemetry",
                    "Satellite land-surface temperature (LST) thermal imagery",
                    "Real-time municipal power grid load & water utility demand",
                ],
                affectedDomains=["WEATHER", "HEALTH", "ENERGY", "WATER_SUPPLY"],
                routineMaxIntensity=32.0,
                moderateThresholdIntensity=38.0,
                severeThresholdIntensity=43.0,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.LANDSLIDE,
                displayName="Landslide / Slope Instability Scenario",
                defaultUnit="mm",
                aliases=["landslide", "mudslide", "slope failure", "rockfall", "debris flow", "mass wasting"],
                relevantEvidenceSources=[
                    "DEM / Elevation & terrain slope gradients",
                    "Historical rainfall & antecedent soil moisture records",
                    "Soil & geological characteristics",
                    "Land cover / vegetation root cohesion proxy",
                    "Historical landslide incident records",
                    "Hillside road network & settlement exposure",
                ],
                comparisonDimensions=[
                    "triggering rainfall intensity & cumulative volume",
                    "terrain slope angle (degrees)",
                    "elevation relief",
                    "soil moisture & lithological susceptibility",
                    "land cover / deforestation",
                    "historical landslides in region",
                ],
                geospatialLayers=[
                    "DEM / Elevation",
                    "Slope",
                    "Soil Characteristics",
                    "Land Cover",
                    "Road Network",
                    "Historical Incident Locations",
                ],
                fourFactors=[
                    FactorSpec(
                        factorId="slope_susceptibility",
                        name="Slope susceptibility",
                        description="Terrain gradient and topographic relief derived from Digital Elevation Model (DEM) profiles.",
                        primaryVariables=["slope_deg", "elevation_relief_m"],
                    ),
                    FactorSpec(
                        factorId="soil_geological_susceptibility",
                        name="Soil/geological susceptibility",
                        description="Subsurface saturation potential and regolith shear strength reduction.",
                        primaryVariables=["antecedent_moisture", "slope_deg"],
                    ),
                    FactorSpec(
                        factorId="rainfall_trigger",
                        name="Rainfall trigger",
                        description="Intensity-duration exceedance relative to empirical slope failure initiation thresholds.",
                        primaryVariables=["rainfall_intensity", "duration_hours"],
                    ),
                    FactorSpec(
                        factorId="infrastructure_exposure",
                        name="Infrastructure exposure",
                        description="Hillside road corridors, retaining cuts, and settlements intersecting steep slope segments.",
                        primaryVariables=["road_network_density", "population_density"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "Live hillside rain gauge telemetry",
                    "In-situ volumetric soil moisture & pore-water pressure piezometers",
                    "Inclinometer / extensometer slope movement sensors",
                    "InSAR satellite surface deformation observations",
                ],
                affectedDomains=["TERRAIN", "ROADS", "INFRASTRUCTURE", "SAFETY"],
                routineMaxIntensity=20.0,
                moderateThresholdIntensity=60.0,
                severeThresholdIntensity=120.0,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.CYCLONE,
                displayName="Cyclone / Tropical Storm Scenario",
                defaultUnit="km/h",
                aliases=["cyclone", "hurricane", "typhoon", "tropical cyclone", "cyclonic storm"],
                relevantEvidenceSources=[
                    "Historical wind speed & atmospheric pressure records",
                    "Historical rainfall & cyclone track archives",
                    "Coastal DEM / elevation & coastline proximity",
                    "Road & power/communication infrastructure network",
                    "Population exposure in coastal and wind-corridor zones",
                ],
                comparisonDimensions=[
                    "sustained wind speed & peak gusts (km/h)",
                    "central atmospheric pressure (hPa)",
                    "associated cyclonic rainfall (mm)",
                    "storm surge potential & coastal elevation",
                    "historical cyclone tracks near location",
                ],
                geospatialLayers=[
                    "Coastline",
                    "DEM / Coastal Elevation",
                    "Road & Utility Network",
                    "Built-Up Areas",
                    "Historical Cyclone / Storm Tracks",
                ],
                fourFactors=[
                    FactorSpec(
                        factorId="wind_exposure",
                        name="Wind exposure",
                        description="Aerodynamic load from sustained cyclonic winds and gusts on structures, trees, and overhead lines.",
                        primaryVariables=["wind_speed_kmh", "historical_max_wind_kmh"],
                    ),
                    FactorSpec(
                        factorId="rainfall_flood_exposure",
                        name="Rainfall/flood exposure",
                        description="Intense spiral rainband precipitation and compound surface runoff.",
                        primaryVariables=["associated_rain_mm", "depression_index"],
                    ),
                    FactorSpec(
                        factorId="storm_surge_coastal_exposure",
                        name="Storm-surge/coastal exposure",
                        description="Low-elevation coastal inundation susceptibility driven by onshore wind setup and low pressure.",
                        primaryVariables=["elevation_m", "is_coastal"],
                    ),
                    FactorSpec(
                        factorId="infrastructure_population_exposure",
                        name="Infrastructure/population exposure",
                        description="Density of transport corridors, power distribution assets, and resident population.",
                        primaryVariables=["population_density", "road_network_density"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "Official meteorological cyclone track & cone of uncertainty",
                    "Live anemometer sustained wind & gust observations",
                    "Barometric sea-level pressure telemetry",
                    "Coastal tide gauge & storm surge buoys",
                    "Doppler weather radar rainfall rate",
                ],
                affectedDomains=["WEATHER", "WIND", "FLOOD", "ROADS", "INFRASTRUCTURE"],
                routineMaxIntensity=50.0,
                moderateThresholdIntensity=88.0,
                severeThresholdIntensity=118.0,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.DROUGHT,
                displayName="Drought / Water Deficit Scenario",
                defaultUnit="% deficit",
                aliases=["drought", "water scarcity", "rainfall deficit", "dry spell", "arid stress"],
                relevantEvidenceSources=[
                    "Multi-year historical precipitation & evapotranspiration records",
                    "Soil moisture & temperature archives",
                    "Water bodies & surface reservoir proximity",
                    "Land use / agricultural vs urban land cover",
                    "Population density & municipal water demand",
                ],
                comparisonDimensions=[
                    "precipitation deficit (% or mm below seasonal norm)",
                    "duration (months / weeks / days)",
                    "ambient temperature & evaporative demand",
                    "historical dry spells & drought years",
                    "land cover & water body reliance",
                ],
                geospatialLayers=[
                    "Land Use / Agricultural & Urban Cover",
                    "Water Bodies & River Network",
                    "Soil Characteristics",
                    "Population Exposure",
                ],
                fourFactors=[
                    FactorSpec(
                        factorId="water_availability",
                        name="Water availability",
                        description="Cumulative precipitation anomaly relative to long-term seasonal climatology and surface water buffers.",
                        primaryVariables=["precip_deficit_pct", "historical_mean_precip"],
                    ),
                    FactorSpec(
                        factorId="soil_moisture",
                        name="Soil moisture",
                        description="Root-zone moisture depletion driven by rainfall deficit and elevated potential evapotranspiration.",
                        primaryVariables=["precip_deficit_pct", "mean_temp_c"],
                    ),
                    FactorSpec(
                        factorId="agricultural_stress",
                        name="Agricultural stress",
                        description="Vegetative and crop water stress across peri-urban and regional agricultural land cover.",
                        primaryVariables=["precip_deficit_pct", "duration_hours"],
                    ),
                    FactorSpec(
                        factorId="population_water_demand_exposure",
                        name="Population/water-demand exposure",
                        description="Municipal domestic and industrial water supply pressure for the resident population.",
                        primaryVariables=["population_density", "built_up_fraction"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "Live reservoir storage volume & groundwater piezometer levels",
                    "Satellite root-zone soil moisture (SMAP / Sentinel)",
                    "NDVI / EVI vegetation drought stress indices",
                    "Municipal water utility supply-demand telemetry",
                ],
                affectedDomains=["WATER_SUPPLY", "ENVIRONMENT", "AGRICULTURE"],
                routineMaxIntensity=15.0,
                moderateThresholdIntensity=35.0,
                severeThresholdIntensity=60.0,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.EARTHQUAKE,
                displayName="Earthquake / Seismic Scenario",
                defaultUnit="Mw",
                aliases=["earthquake", "seismic", "tremor", "magnitude", "quake", "richter", "mw "],
                relevantEvidenceSources=[
                    "Historical earthquake catalog (USGS FDSN Event API)",
                    "Epicentral distance, magnitude (Mw), and focal depth",
                    "Geological / fault proximity & terrain slope amplification",
                    "Built-up urban density & building exposure proxy",
                    "Population exposure & critical transport corridors",
                ],
                comparisonDimensions=[
                    "moment magnitude (Mw)",
                    "focal depth (km) & epicentral distance (km)",
                    "historical seismicity within 250 km radius",
                    "terrain slope & topographic amplification",
                    "built-up structure density & population exposure",
                ],
                geospatialLayers=[
                    "Historical Seismic Events (USGS)",
                    "Slope & Topographic Amplification",
                    "Built-Up Areas & Building Exposure",
                    "Road & Bridge Network",
                    "Population Exposure",
                ],
                fourFactors=[
                    FactorSpec(
                        factorId="ground_shaking_intensity",
                        name="Seismic ground-motion exposure",
                        description="Estimated peak ground acceleration / Modified Mercalli intensity attenuation from magnitude and distance.",
                        primaryVariables=["magnitude_mw", "depth_km", "radius_km"],
                    ),
                    FactorSpec(
                        factorId="geological_terrain_amplification",
                        name="Geological & topographic susceptibility",
                        description="Slope instability and site amplification potential derived from terrain gradients.",
                        primaryVariables=["slope_deg", "elevation_relief_m"],
                    ),
                    FactorSpec(
                        factorId="building_infrastructure_exposure",
                        name="Building & infrastructure exposure",
                        description="Concentration of urban structures, bridges, and arterial corridors subject to seismic loading.",
                        primaryVariables=["built_up_fraction", "road_network_density"],
                    ),
                    FactorSpec(
                        factorId="population_exposure",
                        name="Population exposure",
                        description="Total population within the felt and strong-motion radius.",
                        primaryVariables=["population_density", "radius_km"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "Strong-motion seismograph network (PGA / PGV ShakeMap)",
                    "USGS / National Seismological real-time event parameters",
                    "Structural health monitoring telemetry on bridges and overpasses",
                    "Post-event utility & road inspection feeds",
                ],
                affectedDomains=["SEISMIC", "INFRASTRUCTURE", "ROADS", "SAFETY"],
                routineMaxIntensity=3.9,
                moderateThresholdIntensity=5.0,
                severeThresholdIntensity=6.2,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.STORM,
                displayName="Severe Storm / Thunderstorm Scenario",
                defaultUnit="mm/h",
                aliases=["storm", "thunderstorm", "squall", "hailstorm", "convective storm"],
                relevantEvidenceSources=[
                    "Historical wind & precipitation records (Open-Meteo Archive)",
                    "Current meteorological conditions",
                    "DEM / Elevation & drainage topography",
                    "Road network & tree/overhead utility exposure",
                    "Historical storm incident records",
                ],
                comparisonDimensions=[
                    "rainfall intensity (mm/h)",
                    "peak wind gusts (km/h)",
                    "storm duration (hours)",
                    "historical severe storm frequency",
                    "drainage & road network susceptibility",
                ],
                geospatialLayers=["DEM / Elevation", "Road Network", "Built-Up Areas", "Historical Incident Locations"],
                fourFactors=[
                    FactorSpec(
                        factorId="convective_wind_stress",
                        name="Wind & gust exposure",
                        description="Localized wind gust loading on trees, signage, and overhead utilities.",
                        primaryVariables=["wind_speed_kmh", "intensity"],
                    ),
                    FactorSpec(
                        factorId="short_duration_runoff",
                        name="Flash runoff & drainage stress",
                        description="Intense convective precipitation rate vs surface drainage intake.",
                        primaryVariables=["intensity", "depression_index"],
                    ),
                    FactorSpec(
                        factorId="road_disruption",
                        name="Road corridor disruption",
                        description="Visibility drop, surface ponding, and potential treefall blockage on arterials.",
                        primaryVariables=["road_network_density", "intensity"],
                    ),
                    FactorSpec(
                        factorId="exposure",
                        name="Population & commuter exposure",
                        description="Density of exposed population and active transit corridors.",
                        primaryVariables=["population_density", "built_up_fraction"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "Weather radar reflectivity & lightning detection network",
                    "Automated surface observing system (ASOS) wind & rain sensors",
                    "Live traffic & fallen-tree dispatch feeds",
                ],
                affectedDomains=["WEATHER", "WIND", "ROADS", "TRAFFIC"],
                routineMaxIntensity=15.0,
                moderateThresholdIntensity=35.0,
                severeThresholdIntensity=60.0,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.WILDFIRE,
                displayName="Wildfire / Brushfire Scenario",
                defaultUnit="FWI",
                aliases=["wildfire", "forest fire", "brushfire", "bushfire", "fire weather", "wildland fire"],
                relevantEvidenceSources=[
                    "Historical temperature, low-humidity, and wind records",
                    "Terrain slope (uphill flame spread acceleration)",
                    "Land cover / vegetative fuel proximity & urban-wildland interface",
                    "Air quality baseline & smoke dispersion conditions",
                    "Road evacuation network & population exposure",
                ],
                comparisonDimensions=[
                    "temperature & relative humidity",
                    "wind speed (km/h)",
                    "antecedent dry days / drought index",
                    "terrain slope angle",
                    "wildland-urban interface density",
                ],
                geospatialLayers=["Slope", "Land Cover / Vegetation", "Road Network", "Built-Up Areas", "Air Quality"],
                fourFactors=[
                    FactorSpec(
                        factorId="fire_weather_potential",
                        name="Fire weather ignition & spread potential",
                        description="Combination of high temperature, low relative humidity, and wind velocity.",
                        primaryVariables=["temp_c", "humidity", "wind_speed_kmh"],
                    ),
                    FactorSpec(
                        factorId="topographic_fuel_susceptibility",
                        name="Topographic & fuel susceptibility",
                        description="Terrain slope acceleration and peri-urban vegetative cover.",
                        primaryVariables=["slope_deg", "built_up_fraction"],
                    ),
                    FactorSpec(
                        factorId="smoke_air_quality_impact",
                        name="Smoke & PM2.5 air quality impact",
                        description="Downwind particulate plume exposure across populated zones.",
                        primaryVariables=["baseline_aqi", "wind_speed_kmh"],
                    ),
                    FactorSpec(
                        factorId="infrastructure_evacuation_exposure",
                        name="Corridor & population exposure",
                        description="Population and road network segments at the wildland-urban interface.",
                        primaryVariables=["population_density", "road_network_density"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "VIIRS / MODIS active fire thermal hotspot satellite feeds",
                    "Remote automated weather stations (RAWS) fuel moisture & wind",
                    "Live PM2.5 nephelometer air quality sensors",
                    "Emergency corridor status feeds",
                ],
                affectedDomains=["FIRE", "AQI", "ROADS", "SAFETY"],
                routineMaxIntensity=15.0,
                moderateThresholdIntensity=35.0,
                severeThresholdIntensity=65.0,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.WATER_LEVEL_RISE,
                displayName="River / Reservoir Water-Level Rise Scenario",
                defaultUnit="m",
                aliases=["water_level_rise", "river level", "water level", "river rise", "reservoir release", "dam release"],
                relevantEvidenceSources=[
                    "River & water body geometry (OpenStreetMap)",
                    "DEM / Elevation profile across riparian buffer",
                    "Historical precipitation & hydrological records",
                    "Riparian road segments & bridge crossings",
                    "Population exposure in adjacent low-lying zones",
                ],
                comparisonDimensions=[
                    "water level rise height (m)",
                    "duration of high stage",
                    "bank elevation & terrain gradient",
                    "upstream rainfall history",
                    "historical high-water marks",
                ],
                geospatialLayers=["River Network & Water Bodies", "DEM / Elevation", "Road Network", "Built-Up Areas"],
                fourFactors=[
                    FactorSpec(
                        factorId="overbank_inundation_susceptibility",
                        name="Overbank inundation susceptibility",
                        description="Elevation differential between water channel and surrounding terrain.",
                        primaryVariables=["elevation_m", "depression_index"],
                    ),
                    FactorSpec(
                        factorId="backwater_drainage_impedance",
                        name="Outfall & drainage backwater stress",
                        description="Submergence of storm drain outfalls discharging into the main watercourse.",
                        primaryVariables=["intensity", "waterway_density"],
                    ),
                    FactorSpec(
                        factorId="bridge_corridor_vulnerability",
                        name="Riparian road & crossing vulnerability",
                        description="Potential disruption to riverfront roads and low-clearance bridges.",
                        primaryVariables=["road_network_density", "intensity"],
                    ),
                    FactorSpec(
                        factorId="riparian_population_exposure",
                        name="Riparian population exposure",
                        description="Residents and structures situated along the low-elevation river corridor.",
                        primaryVariables=["population_density", "built_up_fraction"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "Automated river stage / staff gauge telemetry",
                    "Upstream reservoir inflow & spillway discharge rates",
                    "Acoustic Doppler Current Profiler (ADCP) stream velocity",
                ],
                affectedDomains=["FLOOD", "WATER_LEVEL", "ROADS", "INFRASTRUCTURE"],
                routineMaxIntensity=0.5,
                moderateThresholdIntensity=1.5,
                severeThresholdIntensity=3.0,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.COASTAL_INUNDATION,
                displayName="Coastal Inundation Scenario",
                defaultUnit="m",
                aliases=["coastal_inundation", "coastal flood", "sea level", "king tide", "tidal inundation"],
                relevantEvidenceSources=[
                    "Coastal DEM / Elevation above mean sea level",
                    "Coastline & estuarine geometry",
                    "Historical wind & coastal meteorological records",
                    "Coastal road & port infrastructure network",
                    "Population exposure in low-elevation coastal zones (LECZ)",
                ],
                comparisonDimensions=[
                    "water level elevation above datum (m)",
                    "coastal terrain elevation & slope",
                    "duration / tidal cycle alignment",
                    "historical coastal inundation events",
                ],
                geospatialLayers=["Coastline", "DEM / Coastal Elevation", "Road Network", "Built-Up Areas"],
                fourFactors=[
                    FactorSpec(
                        factorId="coastal_elevation_susceptibility",
                        name="Low-elevation coastal susceptibility",
                        description="Proportion of terrain near sea level subject to direct marine water ingress.",
                        primaryVariables=["elevation_m", "depression_index"],
                    ),
                    FactorSpec(
                        factorId="estuarine_drainage_lock",
                        name="Tidal drainage lock & backflow",
                        description="Impedance of gravity-fed coastal stormwater outfalls during high water.",
                        primaryVariables=["intensity", "elevation_m"],
                    ),
                    FactorSpec(
                        factorId="coastal_road_disruption",
                        name="Coastal road & asset vulnerability",
                        description="Exposure of shoreline arteries and coastal transport links.",
                        primaryVariables=["road_network_density", "elevation_m"],
                    ),
                    FactorSpec(
                        factorId="coastal_population_exposure",
                        name="Coastal population exposure",
                        description="Population density within the low-elevation coastal zone.",
                        primaryVariables=["population_density", "built_up_fraction"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "Coastal tide gauge station telemetry",
                    "Nearshore wave rider buoy height & period",
                    "Coastal floodgate & seawall sensor status",
                ],
                affectedDomains=["COASTAL", "FLOOD", "ROADS", "INFRASTRUCTURE"],
                routineMaxIntensity=0.3,
                moderateThresholdIntensity=1.0,
                severeThresholdIntensity=2.2,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.STORM_SURGE,
                displayName="Storm Surge Scenario",
                defaultUnit="m",
                aliases=["storm_surge", "storm surge", "tidal surge", "cyclonic surge"],
                relevantEvidenceSources=[
                    "Coastal DEM / Elevation & bathymetric gradient proxy",
                    "Historical wind speed & barometric pressure records",
                    "Coastline & shoreline infrastructure geometry",
                    "Population & road network exposure",
                ],
                comparisonDimensions=[
                    "surge height (m)",
                    "onshore wind speed & pressure drop",
                    "coastal elevation above sea level",
                    "historical surge events",
                ],
                geospatialLayers=["Coastline", "DEM / Elevation", "Road Network", "Built-Up Areas"],
                fourFactors=[
                    FactorSpec(
                        factorId="surge_runup_susceptibility",
                        name="Surge run-up & coastal terrain susceptibility",
                        description="Interaction of surge height with coastal elevation and shoreline gradient.",
                        primaryVariables=["intensity", "elevation_m"],
                    ),
                    FactorSpec(
                        factorId="wave_wind_compound_stress",
                        name="Compound wind & wave forcing",
                        description="Simultaneous onshore wind setup and surface wave action.",
                        primaryVariables=["wind_speed_kmh", "intensity"],
                    ),
                    FactorSpec(
                        factorId="coastal_infrastructure_disruption",
                        name="Shoreline road & infrastructure vulnerability",
                        description="Exposure of coastal highways, substations, and port access roads.",
                        primaryVariables=["road_network_density", "elevation_m"],
                    ),
                    FactorSpec(
                        factorId="coastal_population_exposure",
                        name="Coastal population exposure",
                        description="Residents within low-elevation coastal corridors.",
                        primaryVariables=["population_density", "built_up_fraction"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "Tide gauge storm surge residual telemetry",
                    "Offshore meteorological buoy wind & central pressure",
                    "High-resolution hydrodynamic surge forecast model",
                ],
                affectedDomains=["COASTAL", "FLOOD", "WIND", "ROADS"],
                routineMaxIntensity=0.4,
                moderateThresholdIntensity=1.2,
                severeThresholdIntensity=2.5,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.AIR_QUALITY_EVENT,
                displayName="Air Quality / Atmospheric Pollution Scenario",
                defaultUnit="AQI",
                aliases=[
                    "air_quality_event",
                    "air quality",
                    "aqi",
                    "aqi_deterioration",
                    "smog",
                    "pm2.5",
                    "pm10",
                    "pollution",
                    "atmospheric inversion",
                    "haze",
                ],
                relevantEvidenceSources=[
                    "Current & historical air quality observations (PM2.5, PM10, NO2, O3, US AQI)",
                    "Meteorological ventilation parameters (wind speed, humidity, temperature inversion proxy)",
                    "Terrain basin / valley trapping topography (DEM)",
                    "Arterial road network emission corridors",
                    "Population exposure density",
                ],
                comparisonDimensions=[
                    "AQI / PM2.5 concentration",
                    "event duration (hours/days)",
                    "boundary-layer wind speed & atmospheric stagnation",
                    "topographic valley/basin confinement",
                    "historical air pollution episodes",
                ],
                geospatialLayers=[
                    "Air Quality Observation Layer",
                    "DEM / Topographic Basin",
                    "Road Network Emission Corridors",
                    "Population Exposure",
                ],
                fourFactors=[
                    FactorSpec(
                        factorId="atmospheric_stagnation_dispersion",
                        name="Atmospheric stagnation & dispersion deficit",
                        description="Boundary-layer ventilation rate determined by wind speed and thermal inversion stability.",
                        primaryVariables=["wind_speed_kmh", "humidity"],
                    ),
                    FactorSpec(
                        factorId="particulate_concentration_severity",
                        name="Pollutant concentration severity",
                        description="Scenario AQI / PM2.5 load relative to health threshold guidelines.",
                        primaryVariables=["intensity", "baseline_aqi"],
                    ),
                    FactorSpec(
                        factorId="corridor_emission_accumulation",
                        name="Urban & vehicular corridor trapping",
                        description="Emission density from primary road networks and topographic confinement.",
                        primaryVariables=["road_network_density", "depression_index"],
                    ),
                    FactorSpec(
                        factorId="population_respiratory_exposure",
                        name="Population respiratory exposure",
                        description="Resident and commuter density exposed to elevated particulate concentrations.",
                        primaryVariables=["population_density", "radius_km"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "Continuous Ambient Air Quality Monitoring Stations (CAAQMS) PM2.5/PM10/NO2",
                    "Radiosonde / ceilometer atmospheric boundary-layer mixing height",
                    "Surface anemometer wind vector telemetry",
                ],
                affectedDomains=["AQI", "HEALTH", "ENVIRONMENT", "TRAFFIC"],
                routineMaxIntensity=80.0,
                moderateThresholdIntensity=150.0,
                severeThresholdIntensity=250.0,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.EXTREME_WIND,
                displayName="Extreme Wind / Gale Scenario",
                defaultUnit="km/h",
                aliases=["extreme_wind", "wind", "gale", "high wind", "windstorm", "dust storm", "km/h wind"],
                relevantEvidenceSources=[
                    "Historical 10m wind speed & peak gust records (Open-Meteo Archive)",
                    "Current wind speed & direction observations",
                    "Terrain exposure & ridge/canyon acceleration (DEM)",
                    "Road network & overhead structure exposure",
                    "Population & urban density",
                ],
                comparisonDimensions=[
                    "sustained wind speed & peak gusts (km/h)",
                    "duration (hours)",
                    "historical maximum wind events",
                    "terrain ridge/urban canyon exposure",
                ],
                geospatialLayers=["DEM / Terrain Exposure", "Road Network", "Built-Up Areas"],
                fourFactors=[
                    FactorSpec(
                        factorId="aerodynamic_wind_load",
                        name="Aerodynamic wind & gust load",
                        description="Dynamic wind pressure (proportional to velocity squared) relative to local historical norms.",
                        primaryVariables=["intensity", "historical_max_wind_kmh"],
                    ),
                    FactorSpec(
                        factorId="terrain_canyon_amplification",
                        name="Terrain & urban canyon channeling",
                        description="Topographic exposure and built-environment channeling effects.",
                        primaryVariables=["slope_deg", "built_up_fraction"],
                    ),
                    FactorSpec(
                        factorId="road_treefall_disruption",
                        name="Road & overhead utility vulnerability",
                        description="Potential for tree limb debris, high-sided vehicle instability, and overhead line faults.",
                        primaryVariables=["road_network_density", "intensity"],
                    ),
                    FactorSpec(
                        factorId="population_exposure",
                        name="Outdoor & commuter population exposure",
                        description="Population density within the high-wind footprint.",
                        primaryVariables=["population_density", "radius_km"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "Ultrasonic anemometer 3-second gust telemetry",
                    "Electric utility feeder outage & fault location telemetry",
                    "Municipal fallen-tree & corridor obstruction dispatches",
                ],
                affectedDomains=["WIND", "WEATHER", "ROADS", "INFRASTRUCTURE"],
                routineMaxIntensity=38.0,
                moderateThresholdIntensity=62.0,
                severeThresholdIntensity=90.0,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.ROAD_DISRUPTION,
                displayName="Road Disruption / Corridor Bottleneck Scenario",
                defaultUnit="% capacity drop",
                aliases=[
                    "road_disruption",
                    "road_closure",
                    "major_road_closure",
                    "closure",
                    "traffic_surge",
                    "traffic_increase",
                    "volume_surge",
                    "road",
                    "corridor disruption",
                    "bridge closure",
                    "arterial cutoff",
                ],
                relevantEvidenceSources=[
                    "Road network topology & hierarchy (OpenStreetMap)",
                    "Current traffic flow & speed observations",
                    "Historical incident & congestion records",
                    "Terrain & drainage crossing constraints",
                    "Adjacent collector & alternate bypass geometry",
                ],
                comparisonDimensions=[
                    "corridor hierarchy (primary arterial vs collector)",
                    "capacity reduction / volume surge (%)",
                    "duration of disruption (hours)",
                    "availability of parallel bypass routes",
                    "historical corridor congestion events",
                ],
                geospatialLayers=["Road Network", "Traffic Flow Layer", "Infrastructure", "Historical Incident Locations"],
                fourFactors=[
                    FactorSpec(
                        factorId="primary_corridor_capacity_loss",
                        name="Primary corridor capacity stress",
                        description="Magnitude of flow restriction or demand surge on the target arterial segment.",
                        primaryVariables=["intensity", "road_network_density"],
                    ),
                    FactorSpec(
                        factorId="alternate_network_redundancy",
                        name="Alternate network redundancy",
                        description="Availability and connectivity of secondary collector routes to absorb diverted flow.",
                        primaryVariables=["road_ways_count", "road_types"],
                    ),
                    FactorSpec(
                        factorId="spillover_queue_propagation",
                        name="Queue propagation & travel delay",
                        description="Modeled speed reduction and intersection queue spillback across adjacent links.",
                        primaryVariables=["intensity", "duration_hours"],
                    ),
                    FactorSpec(
                        factorId="commuter_exposure",
                        name="Commuter & urban activity exposure",
                        description="Population and commercial density served by the disrupted road network.",
                        primaryVariables=["population_density", "built_up_fraction"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "Live loop-detector / probe-vehicle speed and travel-time feeds",
                    "Verified municipal traffic management center (TMC) road closure logs",
                    "Adaptive traffic signal controller split & cycle telemetry",
                ],
                affectedDomains=["ROADS", "TRAFFIC"],
                routineMaxIntensity=15.0,
                moderateThresholdIntensity=35.0,
                severeThresholdIntensity=65.0,
            ),
            ScenarioCategorySpec(
                category=ScenarioCategory.OTHER,
                displayName="General Urban Stress Scenario",
                defaultUnit="units",
                aliases=["other", "general", "custom"],
                relevantEvidenceSources=[
                    "Current urban & meteorological baseline observations",
                    "Historical meteorological & event archives",
                    "DEM / Elevation & road network geometry",
                    "Population exposure dataset",
                ],
                comparisonDimensions=[
                    "scenario intensity & duration",
                    "historical baseline distribution",
                    "terrain & road network topology",
                    "population density",
                ],
                geospatialLayers=["DEM / Elevation", "Road Network", "Built-Up Areas", "Population Exposure"],
                fourFactors=[
                    FactorSpec(
                        factorId="environmental_anomaly",
                        name="Environmental & hazard anomaly",
                        description="Deviation of the requested scenario intensity from local historical baselines.",
                        primaryVariables=["intensity"],
                    ),
                    FactorSpec(
                        factorId="spatial_terrain_susceptibility",
                        name="Spatial & terrain susceptibility",
                        description="Topographic and land-cover sensitivity across the selected radius.",
                        primaryVariables=["elevation_m", "slope_deg"],
                    ),
                    FactorSpec(
                        factorId="infrastructure_network_stress",
                        name="Infrastructure & road network stress",
                        description="Modeled vulnerability of transport and municipal corridors.",
                        primaryVariables=["road_network_density"],
                    ),
                    FactorSpec(
                        factorId="population_exposure",
                        name="Population exposure",
                        description="Estimated population within the scenario analysis zone.",
                        primaryVariables=["population_density", "radius_km"],
                    ),
                ],
                recommendedRealtimeInputs=[
                    "Live local meteorological & environmental sensor feeds",
                    "Real-time municipal traffic & incident dispatch feeds",
                ],
                affectedDomains=["WEATHER", "ROADS", "INFRASTRUCTURE"],
                routineMaxIntensity=20.0,
                moderateThresholdIntensity=45.0,
                severeThresholdIntensity=75.0,
            ),
        ]
        for s in specs:
            cls.register(s)


ScenarioRegistry._initialize_defaults()
