/**
 * UrbanPulse Shared Type Definitions
 * Tagline: Real-Time Intelligence for the World Around You
 * Global location-aware urban and environmental intelligence platform.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null; // meters
  city: string | null;
  district?: string | null;
  state?: string | null; // state / province / administrative area
  region?: string | null; // backward compatibility alias for state
  country: string | null;
  countryCode?: string | null; // ISO 3166-1 alpha-2, e.g. "IN", "US", "GB", "JP"
  regionCode?: string | null;
  timezone?: string | null;
  radius?: number | null;
  displayName: string;
  isUserLocation: boolean;
}

export type IntelligenceRadiusKm = 5 | 10 | 25 | 50 | 100 | 250;

export type AppMode = 'explore' | 'journey';

export type DataStatus = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'STALE' | 'DEMO' | 'NO_VERIFIED_FEED' | 'NO_COVERAGE' | 'ERROR' | 'EMPTY_VERIFIED';

export type DataFreshness = 'LIVE' | 'RECENT' | 'STALE' | 'PARTIAL' | 'UNAVAILABLE' | 'ERROR';

export type UnitSystem = 'metric' | 'imperial';

export type AQIScale = 'US_AQI' | 'EUROPEAN_AQI' | 'CPCB_INDIA_AQI';

export interface ProvenanceMetadata {
  source: string;
  sourceType: 'LIVE_API' | 'SATELLITE_MODEL' | 'GOVERNMENT_STATION' | 'SENSOR_NETWORK' | 'MAPPING_PROVIDER' | 'NONE';
  observedAt: string;
  retrievedAt: string;
  coverage: string;
  confidence: number;
  status: DataStatus;
}

export type EventCategory =
  | 'ACCIDENT'
  | 'FIRE'
  | 'FLOOD'
  | 'EARTHQUAKE'
  | 'CYCLONE'
  | 'STORM'
  | 'LANDSLIDE'
  | 'POTHOLE'
  | 'ROAD_CLOSURE'
  | 'TRAFFIC'
  | 'MURDER'
  | 'ROBBERY'
  | 'THEFT'
  | 'POLICE_INCIDENT'
  | 'PUBLIC_SAFETY_ALERT'
  | 'GARBAGE'
  | 'BLOCKED_DRAIN'
  | 'FALLEN_TREE'
  | 'WEATHER_ALERT'
  | 'OTHER';

export type EventStatus =
  | 'VERIFIED'
  | 'REPORTED'
  | 'UNVERIFIED'
  | 'MONITORING'
  | 'RESOLVED';

export type EventSource =
  | 'Google Maps'
  | 'Open-Meteo'
  | 'USGS'
  | 'GDACS'
  | 'Official Police Feed'
  | 'Municipal Dispatch'
  | 'Verified Citizen Feed'
  | 'UrbanPulse Sensor'
  | 'Demo Data';

export interface UnifiedCityEvent {
  eventId: string;
  canonicalEventId?: string;
  eventType: EventCategory;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  timestamp: string; // ISO 8601
  severity: number; // 0–100 deterministic
  confidence: number; // 0–100 %
  source: EventSource;
  sourceId?: string;
  status: EventStatus;
  affectedRadiusKm: number;
  distanceKm?: number; // Computed relative to active center
  userImpact?: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  metadata?: {
    // Earthquake specific
    magnitude?: number;
    depthKm?: number;
    impactRisk?: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
    // Flood / Storm specific
    waterDepthCm?: number;
    rainfallMm?: number;
    windSpeedKmh?: number;
    // Traffic / Accident specific
    lanesBlocked?: number;
    delayMinutes?: number;
    delayRatio?: number;
    corridor?: string;
    // Weather & Environmental
    weatherCode?: number;
    precipitationMm?: number;
    aqiValue?: number;
    aqiScale?: string;
    category?: string;
    pollutant?: string;
    // Crime specific
    verifiedByOfficial?: boolean;
    // General
    address?: string;
    imageUrl?: string;
    [key: string]: any;
  };
}

export type TravelMode = 'drive' | 'two_wheeler' | 'transit' | 'walk' | 'bicycle';

export type RouteCategory = 'FASTEST' | 'SAFEST' | 'LOWEST_RISK' | 'RECOMMENDED';

export interface CandidateRoute {
  id: string;
  name: string;
  category: RouteCategory;
  travelMode: TravelMode;
  distanceKm: number;
  estimatedTimeMinutes: number;
  trafficDelayMinutes: number;
  overallRiskScore: number; // 0–100
  confidenceScore: number; // 0–100 %
  summary: string;
  rationale: string;
  polyline: Coordinates[];
  intersectingEvents: UnifiedCityEvent[];
  weatherAlerts: string[];
}

export interface RoutePlan {
  fromLocation: ResolvedLocation;
  toLocation: ResolvedLocation;
  departureTime: string;
  travelMode: TravelMode;
  candidateRoutes: CandidateRoute[];
  recommendedRouteId: string;
  copilotAdvisory: string;
}

export interface WeatherConditionSummary {
  temperatureC: string;
  conditionLabel: string;
  rainProbability: number;
  humidity: number;
  windSpeedKmh: number;
  uvIndex: number;
  apparentTemperatureC?: string;
  surfacePressureHpa?: number;
  cloudCoverPercent?: number;
  airQualityStatus: string;
  source: string;
  lastUpdated: string;
  status: DataStatus;
}

export interface TrafficConditionSummary {
  status: DataStatus;
  trafficStatus: 'NORMAL' | 'MODERATE' | 'HEAVY' | 'SEVERE' | 'UNAVAILABLE';
  label: string;
  delayMinutes: number;
  delayRatio: number;
  detail: string;
  corridor?: string;
  speedIntervals?: {
    normal: number;
    slow: number;
    trafficJam: number;
    total: number;
  };
  location: Coordinates;
  radiusKm: number;
  source: string;
  lastUpdated: string;
  reason?: string;
}

export interface UrbanConditionPillar {
  name: string;
  score: number | null; // null if data unavailable
  status: string;
  metric: string;
  description: string;
  dataStatus: DataStatus;
  source?: string;
  sourceType?: string;
  feedCapability?: string;
  measurementType?: 'MEASURED' | 'OFFICIAL' | 'MAPPED_ATTRIBUTE' | 'MODELED' | 'CROWDSOURCED' | 'INFERRED' | 'NONE';
  confidence?: number;
  networkStatus?: string;
  surfaceType?: string;
  hazardCount?: number;
  conditionStatus?: string;
  incidentCount?: number | null;
  alertCount?: number;
  updateCount?: number;
  sources?: Array<{ name: string; type?: string; role?: string; authority?: string }>;
  details?: Record<string, any>;
}

export interface AirQualitySummary {
  value: number | null;
  pollutant: string;
  scale: AQIScale;
  category: string;
  unit: string;
  source: string;
  sourceType: 'LIVE_API' | 'SATELLITE_MODEL' | 'GOVERNMENT_STATION';
  observedAt: string;
  confidence: number;
  status: DataStatus;
  breakdown?: {
    pm2_5?: number;
    pm10?: number;
    no2?: number;
    so2?: number;
    co?: number;
    o3?: number;
  };
}

export interface RoadNetworkDetails {
  status: DataStatus;
  roadTypes?: string[];
  sampleWaysCount?: number;
  sampleHighwayName?: string | null;
  lanes?: number | null;
  source?: string;
  authority?: string;
}

export interface RoadSurfaceDetails {
  status: DataStatus;
  type?: string;
  material?: string;
  allReportedSurfaces?: string[];
  measurementType: 'MAPPED_ATTRIBUTE' | 'MEASURED';
  source?: string;
}

export interface RoadConditionDetails {
  status: DataStatus;
  message: string;
  potholeCount?: number;
  measurementType: 'MEASURED' | 'NONE' | 'MODELED';
  roughnessIndex?: number | null;
}

export interface RoadHazardsDetails {
  status: DataStatus;
  count: number;
  items?: UnifiedCityEvent[];
}

export interface RoadsSummary {
  status: DataStatus;
  roadNetworkStatus?: 'AVAILABLE' | 'UNAVAILABLE';
  roadConditionStatus?: 'AVAILABLE' | 'NO_VERIFIED_FEED' | 'NO_COVERAGE' | 'UNAVAILABLE';
  roadConditionSource?: string;
  coverage: string;
  activeHazardCount: number;
  network: RoadNetworkDetails;
  surface: RoadSurfaceDetails;
  condition: RoadConditionDetails;
  hazards: RoadHazardsDetails | UnifiedCityEvent[];
  sources: Array<{
    name: string;
    type: string;
    role?: string;
    authority?: string;
  }>;
  confidence: number;
  observedAt: string;
  retrievedAt?: string;
}

export interface CivilSafetySummary {
  status: DataStatus;
  feedCapability: 'OFFICIAL_PUBLIC_SAFETY_FEED' | 'OPEN_CRIME_DATA' | 'PUBLIC_SAFETY_UPDATE' | 'EMPTY_VERIFIED' | 'NO_COVERAGE' | 'ERROR';
  incidentCount: number | null; // null if feed unavailable, NEVER fake 0
  incidents: UnifiedCityEvent[];
  alerts?: UnifiedCityEvent[];
  alertCount?: number;
  updates: Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    source: string;
    authorityScore: number;
  }>;
  updateCount?: number;
  sources: Array<{
    name: string;
    type: string;
    authority: string;
  }>;
  coverage: string;
  observedAt: string;
  retrievedAt?: string;
  confidence: number;
  message?: string;
}

export interface UrbanConditionBreakdown {
  overallScore: number | null; // 0–100, null if insufficient signals
  label: 'EXCELLENT' | 'GOOD' | 'FAVORABLE' | 'MODERATE' | 'CONCERN' | 'CRITICAL' | 'UNAVAILABLE';
  pillars: UrbanConditionPillar[];
  activeIncidentsCount: number;
  locationName: string;
  radiusKm: number;
  confidence: number; // 0.0–1.0
  knownSignals: number;
  missingSignals: number;
  lastUpdated: string;
  dataStatus: DataStatus;
}

export interface UrbanIntelResponse {
  location: ResolvedLocation;
  radiusKm: IntelligenceRadiusKm;
  weather: WeatherConditionSummary;
  airQuality: AirQualitySummary;
  traffic: TrafficConditionSummary;
  roads: RoadsSummary;
  events: UnifiedCityEvent[];
  hazards: UnifiedCityEvent[];
  condition: UrbanConditionBreakdown;
  retrievedAt: string;
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'copilot';
  content: string;
  timestamp: string;
  citedLiveSignals?: Array<{
    type: string;
    source: string;
    detail: string;
  }>;
  suggestedActions?: string[];
  referenceKnowledge?: string[];
  recommendation?: string;
}

export type AgentIntent =
  | 'TRAFFIC'
  | 'WEATHER'
  | 'AIR_QUALITY'
  | 'OVERALL_RATING'
  | 'EVENTS'
  | 'HAZARDS'
  | 'ROUTE'
  | 'GENERAL_INTELLIGENCE'
  | 'COMPARISON'
  | 'FORECAST'
  | 'MONTHLY_OUTLOOK'
  | 'LIVE_UPDATES';

export type AgentTimeQualifier = 'CURRENT' | 'NEXT_7_DAYS' | 'NEXT_30_DAYS' | 'HISTORICAL' | null;

export type ForecastHorizon = '7_DAYS' | '30_DAYS';

export interface ForecastPoint {
  date: string;
  temperatureMinC?: number;
  temperatureMaxC?: number;
  precipitationProbability?: number;
  weatherCondition?: string;
  trafficTendency?: 'NORMAL' | 'MODERATE_PEAKS' | 'HEAVY_CONGESTION' | 'ELEVATED';
  predictedAqi?: number;
  aqiRange?: [number, number];
  aqiScale?: AQIScale;
  aqiCategory?: string;
  urbanConditionScore?: number;
  confidence: number; // 0.0 - 1.0
  isEstimate: boolean;
}

export interface LocationForecast {
  location: ResolvedLocation;
  horizon: ForecastHorizon;
  summary: string;
  daily: ForecastPoint[];
  monthlyOutlook?: {
    trend: string;
    riskFactors: string[];
    expectedRange: [number, number];
    confidence: number;
  };
  confidence: number;
  sources: Array<{ type: string; source: string; generatedAt: string }>;
  limitations: string[];
  generatedAt: string;
}

export interface LiveUpdateItem {
  id: string;
  eventType: EventCategory;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  affectedRadiusKm: number;
  severity: number;
  confidence: number;
  freshness: DataFreshness;
  source: string;
  sourceType: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface RAGKnowledgeItem {
  id: string;
  title: string;
  content: string;
  location?: string | null;
  country?: string | null;
  region?: string | null;
  category: 'STABLE' | 'RECENT';
  eventType?: string | null;
  source: string;
  authorityScore: number; // 0.0 - 1.0
  confidence: number;
  publishedAt: string;
  observedAt?: string | null;
  expiresAt?: string | null;
}

export type AgentIntent =
  | 'GENERAL_INTELLIGENCE'
  | 'TRAFFIC'
  | 'WEATHER'
  | 'AIR_QUALITY'
  | 'OVERALL_RATING'
  | 'ROADS'
  | 'CIVIL_SAFETY'
  | 'HAZARDS'
  | 'EVENTS'
  | 'ROUTE'
  | 'FORECAST'
  | 'MONTHLY_OUTLOOK'
  | 'LIVE_UPDATES'
  | 'WHAT_CHANGED'
  | 'WHY_SCORE'
  | 'MONITOR'
  | 'ANOMALY'
  | 'SIMULATE'
  | 'COMPARISON'
  | 'ASK_THE_MAP';

export type AgentMapActionType =
  | 'CENTER_MAP'
  | 'SET_ZOOM'
  | 'SHOW_TRAFFIC_LAYER'
  | 'HIDE_TRAFFIC_LAYER'
  | 'SHOW_AQI_LAYER'
  | 'HIDE_AQI_LAYER'
  | 'SHOW_EVENTS_LAYER'
  | 'HIDE_EVENTS_LAYER'
  | 'SHOW_FORECAST'
  | 'SHOW_LIVE_UPDATES'
  | 'DRAW_ROUTE'
  | 'CLEAR_ROUTE'
  | 'SHOW_TRAFFIC'
  | 'SHOW_AQI'
  | 'SHOW_WEATHER'
  | 'SHOW_EVENTS'
  | 'SHOW_HAZARDS'
  | 'SHOW_ANOMALIES'
  | 'SHOW_SCORE'
  | 'SHOW_COMPARISON'
  | 'SHOW_CHANGES'
  | 'SHOW_SCENARIO';

export interface AgentMapAction {
  type: AgentMapActionType;
  payload?: {
    latitude?: number;
    longitude?: number;
    zoom?: number;
    radiusKm?: number;
    routeId?: string;
    label?: string;
    horizon?: ForecastHorizon;
    forecast?: LocationForecast | any;
    updates?: LiveUpdateItem[] | any;
    bulletins?: RAGKnowledgeItem[] | any;
    data?: any;
  };
}

export interface AgentToolActivity {
  step: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  detail?: string;
  timestamp: string;
}

export interface AgentInteractionRequest {
  query: string;
  sessionId?: string;
  currentLocation?: ResolvedLocation | null;
  selectedRadiusKm?: number;
  conversationHistory?: Array<{
    sender: 'user' | 'agent';
    content: string;
  }>;
}

export interface AgentInteractionResponse {
  id: string;
  message: string;
  intent: AgentIntent;
  location: ResolvedLocation | null;
  data: {
    traffic?: TrafficConditionSummary | null;
    weather?: WeatherConditionSummary | null;
    airQuality?: AirQualitySummary | null;
    condition?: UrbanConditionBreakdown | null;
    roads?: RoadsSummary | null;
    events?: UnifiedCityEvent[];
    forecast?: LocationForecast | null;
    liveUpdates?: LiveUpdateItem[];
    ragKnowledge?: RAGKnowledgeItem[];
    comparison?: {
      locationA: { location: ResolvedLocation; summary: any };
      locationB: { location: ResolvedLocation; summary: any };
      verdict: string;
    };
    changes?: LocationChangesResponse;
    explainableScore?: ExplainableUrbanScore;
    anomalies?: AnomalyDetectionResponse;
    scenario?: ScenarioSimulationResult;
    monitors?: LocationMonitor[];
    alerts?: MonitorAlert[];
    cityComparison?: CityComparisonResponse;
  };
  sources: Array<{
    type: string;
    source: string;
    detail: string;
    observedAt?: string;
    freshness?: DataFreshness;
  }>;
  confidence: number; // 0.0 - 1.0
  actions: AgentMapAction[];
  toolActivities: AgentToolActivity[];
  timestamp: string;
}

// ============================================================
// WHAT CHANGED? ENGINE
// ============================================================
export type ChangeComparisonWindow = '1h' | '6h' | '12h' | '24h' | '7d';
export type LocationChangeSignal = 'traffic' | 'weather' | 'aqi' | 'hazards' | 'events' | 'condition' | 'safety' | 'roads';

export interface LocationChangeItem {
  signal: LocationChangeSignal;
  label: string;
  previousValue: number | string | null;
  currentValue: number | string | null;
  delta: number | null;
  percentChange: number | null;
  direction: 'UP' | 'DOWN' | 'STABLE' | 'NEW' | 'RESOLVED';
  significance: 'HIGH' | 'MODERATE' | 'LOW';
  source: string;
  previousObservedAt: string;
  currentObservedAt: string;
  confidence: number;
  description: string;
}

export interface LocationChangesResponse {
  location: ResolvedLocation;
  window: ChangeComparisonWindow;
  changes: LocationChangeItem[];
  meaningfulCount: number;
  mainChange: string;
  confidence: number;
  retrievedAt: string;
}

// ============================================================
// EXPLAINABLE URBANPULSE SCORE & HISTORY
// ============================================================
export interface ScoreComponentDetail {
  name: string;
  score: number | null;
  weight: number;
  weightedScore: number | null;
  dataStatus: DataStatus;
  status: string;
  metric: string;
  source: string;
}

export interface ScoreHistoryItem {
  timestamp: string;
  label: string; // 'Today' | 'Yesterday' | '7 days ago' | '30 days ago'
  score: number;
  confidence: number;
}

export interface ExplainableUrbanScore {
  score: number;
  confidence: number;
  components: Record<string, ScoreComponentDetail>;
  knownSignals: number;
  missingSignals: number;
  weights: Record<string, number>;
  positiveFactors: string[];
  negativeFactors: string[];
  explanation: string;
  history: ScoreHistoryItem[];
  trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
  timestamp: string;
}

// ============================================================
// MONITOR THIS PLACE & ALERTS
// ============================================================
export type MonitorSignal = 'traffic' | 'aqi' | 'weather' | 'hazards' | 'events' | 'road closures' | 'urban condition';

export interface LocationMonitor {
  id: string;
  location: ResolvedLocation;
  radiusKm: number;
  signals: MonitorSignal[];
  threshold?: string | number;
  active: boolean;
  createdAt: string;
  lastEvaluatedAt?: string;
  lastAlertAt?: string;
}

export interface MonitorAlert {
  id: string;
  monitorId: string;
  locationName: string;
  trigger: string;
  previousState: string;
  currentState: string;
  severity: 'HIGH' | 'MODERATE' | 'INFO';
  source: string;
  confidence: number;
  observedAt: string;
  triggeredAt: string;
}

// ============================================================
// ANOMALY DETECTION
// ============================================================
export type AnomalyType =
  | 'SUDDEN_SPIKE'
  | 'SUDDEN_DROP'
  | 'UNUSUAL_LEVEL'
  | 'UNUSUAL_EVENT_COUNT'
  | 'UNUSUAL_ROUTE_DELAY'
  | 'UNUSUAL_WEATHER'
  | 'UNUSUAL_AQI';

export interface AnomalyItem {
  id: string;
  signal: string;
  anomalyType: AnomalyType;
  currentValue: number | string;
  expectedBaseline: number | string;
  deviationPercent: number;
  zScore?: number;
  severity: 'HIGH' | 'MODERATE' | 'LOW';
  confidence: number;
  observedAt: string;
  source: string;
  explanation: string;
}

export interface AnomalyDetectionResponse {
  location: ResolvedLocation;
  window: string;
  anomalies: AnomalyItem[];
  isAnomalous: boolean;
  confidence: number;
  evaluatedAt: string;
}

// ============================================================
// SCENARIO SIMULATION
// ============================================================
export type ScenarioType =
  | 'heavy_rainfall'
  | 'major_road_closure'
  | 'traffic_increase'
  | 'aqi_deterioration'
  | 'large_public_event'
  | 'extreme_heat'
  | 'flood_scenario';

export interface ScenarioSimulationRequest {
  location: ResolvedLocation;
  scenario: ScenarioType;
  parameters?: Record<string, any>;
  radiusKm?: number;
}

export interface ScenarioSimulationResult {
  scenario: ScenarioType;
  scenarioTitle: string;
  location: ResolvedLocation;
  baselineScore: number;
  projectedScoreRange: [number, number];
  projectedTrafficImpact: string;
  projectedFloodRisk: string;
  routeImpact: string;
  confidence: number;
  assumptions: string[];
  limitations: string[];
  label: 'SIMULATION';
  simulatedAt: string;
}

// ============================================================
// CITY COMPARISON
// ============================================================
export interface CityComparisonMatrixRow {
  signal: string;
  values: Record<string, number | string | null>; // city key -> value
}

export interface CityComparisonEntry {
  location: ResolvedLocation;
  trafficScore: number | null;
  aqiScore: number | null;
  aqiCategory: string;
  aqiStandard: string;
  weatherScore: number | null;
  safetyScore: number | null;
  urbanPulseScore: number | null;
  confidence: number;
  summary: string;
}

export interface CityComparisonResponse {
  cities: CityComparisonEntry[];
  matrix: CityComparisonMatrixRow[];
  verdict: string;
  confidence: number;
  timestamp: string;
}

