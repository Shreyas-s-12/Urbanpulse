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
  type?: 'COORDINATES' | 'CITY' | 'PLACE';
  placeId?: string | null;
  name?: string | null;
  address?: string | null;
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
  source?: LocationSource;
  accuracyTier?: LocationAccuracyTier;
  timestamp?: number;
  rawLatitude?: number;
  rawLongitude?: number;
}
export type LocationSource =
  | 'BROWSER_GEOLOCATION'
  | 'DEVICE_GPS'
  | 'DEVICE_LOCATION'
  | 'NETWORK'
  | 'MANUAL'
  | 'MANUAL_ADJUSTMENT'
  | 'SEARCH'
  | 'POI'
  | 'MAP_CLICK'
  | 'PLACE'
  | 'ROUTE'
  | 'LAST_KNOWN';
export type ActiveLocationMode = 'DEVICE' | 'SEARCH' | 'POI' | 'MAP_CLICK' | 'MANUAL';
export type MapFollowMode = 'EXPLORE' | 'MY_LOCATION' | 'LOCKED_ON_USER';
export type LocationConfidenceTier = 'HIGH' | 'GOOD' | 'APPROXIMATE' | 'LOW';
export type PlaceCategoryType =
  | 'COUNTRY'
  | 'REGION'
  | 'CITY'
  | 'TOWN'
  | 'DISTRICT'
  | 'NEIGHBORHOOD'
  | 'AREA'
  | 'STREET'
  | 'ADDRESS'
  | 'LANDMARK'
  | 'POI';
export type LocationSearchConfidence = 'HIGH' | 'MODERATE' | 'LOW';
export interface SavedFavoriteLocation {
  id: string;
  label: 'HOME' | 'WORK' | 'COLLEGE' | 'FAVORITE' | 'CUSTOM';
  customName?: string;
  latitude: number;
  longitude: number;
  displayName: string;
  formattedAddress?: string;
  placeId?: string;
  categoryType?: PlaceCategoryType;
  createdAt: number;
}
export type LocationEventType =
  | 'LOCATION_REQUESTED'
  | 'LOCATION_READING_RECEIVED'
  | 'LOCATION_IMPROVED'
  | 'LOCATION_LOCKED'
  | 'LOCATION_DEGRADED'
  | 'LOCATION_CONFLICT'
  | 'LOCATION_STALE'
  | 'LOCATION_FAILED'
  | 'LOCATION_COORDINATE_MISMATCH';
export interface LocationConflictStatus {
  hasConflict: boolean;
  message?: string;
  divergentDistanceMeters?: number;
  detectedAt?: number;
}
export interface AddressMetadata {
  houseNumber?: string | null;
  street?: string | null;
  neighborhood?: string | null;
  locality?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  countryCode?: string | null;
  postalCode?: string | null;
  formattedAddress?: string;
  reverseGeocodeCoordinate?: { latitude: number; longitude: number };
}
export interface RawDeviceLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: number;
  source: 'BROWSER_GEOLOCATION';
  addressMetadata?: AddressMetadata;
}
export interface SelectedSearchLocation {
  latitude: number;
  longitude: number;
  displayName: string;
  formattedAddress?: string;
  placeId?: string;
  city?: string | null;
  locality?: string | null;
  neighborhood?: string | null;
  district?: string | null;
  state?: string | null;
  country?: string | null;
  countryCode?: string | null;
  types?: string[];
  categoryType?: PlaceCategoryType;
  confidence?: LocationSearchConfidence;
  source: 'SEARCH' | 'MANUAL_ADJUSTMENT' | 'MAP_CLICK';
  timestamp?: number;
}
export interface SelectedPoiLocation {
  placeId: string;
  latitude: number;
  longitude: number;
  displayName: string;
  formattedAddress?: string;
  rating?: number;
  userRatingsTotal?: number;
  photos?: string[];
  types?: string[];
  source: 'POI';
}
export interface MapClickLocation {
  latitude: number;
  longitude: number;
  source: 'MAP_CLICK';
  addressMetadata?: AddressMetadata;
}
export type LocationAccuracyTier = 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'LOW' | 'VERY_LOW';
export type LocationAccuracyState = 'IDLE' | 'LOCATING' | 'IMPROVING' | 'LOCKED' | 'APPROXIMATE' | 'UNAVAILABLE' | 'STALE';
export interface LocationContext extends ResolvedLocation {
  source: LocationSource;
  accuracyTier?: LocationAccuracyTier;
  timestamp?: number;
  rawLatitude?: number;
  rawLongitude?: number;
  ageSeconds?: number;
  accuracyMeters?: number;
  addressMetadata?: AddressMetadata;
  confidence?: number;
  confidenceTier?: LocationConfidenceTier;
  status?: LocationAccuracyState;
  address?: string | null;
  locality?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postalCode?: string | null;
  freshnessText?: string;
  providerName?: string;
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
export type TrafficRoutingPreference = 'TRAFFIC_AWARE' | 'TRAFFIC_AWARE_OPTIMAL';
export interface TrafficSpeedInterval {
  startPolylinePointIndex: number;
  endPolylinePointIndex: number;
  speed: 'NORMAL' | 'SLOW' | 'TRAFFIC_JAM';
}
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
  speedReadingIntervals?: TrafficSpeedInterval[];
  routingPreference?: TrafficRoutingPreference | string;
}
export interface RoutePlan {
  fromLocation: ResolvedLocation;
  toLocation: ResolvedLocation;
  departureTime: string;
  travelMode: TravelMode;
  candidateRoutes: CandidateRoute[];
  recommendedRouteId: string;
  copilotAdvisory: string;
  routingPreference?: TrafficRoutingPreference | string;
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
export interface SampledCorridor {
  name: string;
  origin: Coordinates;
  destination: Coordinates;
  distanceMeters: number;
  durationSeconds: number;
  staticDurationSeconds: number;
  delaySeconds: number;
  delayRatio: number;
  speedIntervals?: {
    normal: number;
    slow: number;
    trafficJam: number;
    total: number;
  };
}
export interface TrafficConditionSummary {
  status: DataStatus;
  trafficStatus: 'NORMAL' | 'MODERATE' | 'HEAVY' | 'SEVERE' | 'UNAVAILABLE';
  level?: 'NORMAL' | 'MODERATE' | 'HEAVY' | 'SEVERE' | 'UNAVAILABLE';
  label: string;
  delayMinutes: number;
  averageDelaySeconds?: number;
  delayRatio: number;
  detail: string;
  corridor?: string;
  sampledCorridors?: SampledCorridor[];
  coverageType?: 'SAMPLED_CORRIDORS' | 'ACTIVE_ROUTE' | 'MAP_LAYER_ONLY' | 'NO_COVERAGE';
  speedIntervals?: {
    normal: number;
    slow: number;
    trafficJam: number;
    total: number;
  };
  location: Coordinates;
  radiusKm: number;
  provider?: string;
  source: string;
  observedAt?: string;
  retrievedAt?: string;
  lastUpdated: string;
  confidence?: number;
  methodology?: string;
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
  guidance?: Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    source: string;
    authorityScore: number;
  }>;
  guidanceCount?: number;
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
  | 'LIVE_UPDATES'
  | 'ACTIVITIES';
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
  | 'ASK_THE_MAP'
  | 'ACTIVITIES'
  | 'PREDICT'
  | 'RISK_FORECAST'
  | 'SMART_ROUTE'
  | 'MISSION_MODE'
  | 'RECOMMEND_PLACE'
  | 'CASCADE';
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
  | 'SHOW_SCENARIO'
  | 'SHOW_RISK'
  | 'SET_RADIUS'
  | 'SELECT_EVENT'
  | 'SELECT_PLACE'
  | 'SET_EVENT_FILTER'
  | 'SHOW_RISK_FORECAST'
  | 'SHOW_ROUTE'
  | 'SHOW_ALTERNATIVE_ROUTES'
  | 'FOCUS_ALERT'
  | 'OPEN_MISSION'
  | 'OPEN_MONITOR'
  | 'SHOW_CASCADE';
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
    eventId?: string;
    placeId?: string;
    filter?: string;
    riskDomain?: string;
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
  currentLocation?: (ResolvedLocation & { selectedMapEntity?: any; activeFilter?: any }) | any;
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
    riskRadar?: LocationRiskReport;
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
// ============================================================
// URBANPULSE RISK RADAR & CANONICAL NEXUS CONTEXT (PHASE 1)
// ============================================================
export type RiskDomain =
  | 'TRAFFIC'
  | 'FLOOD'
  | 'FIRE'
  | 'SAFETY'
  | 'WEATHER'
  | 'ROAD'
  | 'AQI'
  | 'HAZARDS';
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'UNKNOWN';
export interface RiskSignal {
  name: string;
  value: number | string | null;
  unit?: string;
  level: RiskLevel;
  source: string;
  observedAt?: string;
}
export interface DomainRiskAssessment {
  domain: RiskDomain;
  level: RiskLevel;
  score: number | null; // 0-100 (null if UNKNOWN)
  headline: string;
  description: string;
  signals: RiskSignal[];
  confidence: number; // 0.0 - 1.0
  source: string;
}
export interface SpatialRiskZone {
  id: string;
  domain: RiskDomain;
  level: RiskLevel;
  name: string;
  center: Coordinates;
  radiusMeters: number;
  advisory: string;
}
export interface LocationRiskReport {
  location: ResolvedLocation;
  overallLevel: RiskLevel;
  overallScore: number | null;
  confidence: number;
  evaluatedAt: string;
  domains: Record<RiskDomain, DomainRiskAssessment>;
  riskZones: SpatialRiskZone[];
  actionableGuidance: string[];
}
export interface NexusContext {
  activeLocation: ResolvedLocation | null;
  mapCenter: Coordinates;
  mapZoom: number;
  selectedRadiusKm: number;
  selectedMapEntity: {
    type: 'POI' | 'EVENT' | 'COORDINATE' | 'NONE';
    id?: string;
    name?: string;
    coordinates?: Coordinates;
    meta?: Record<string, any>;
  } | null;
  activeFilter: 'ALL' | 'CRIME' | 'WEATHER' | 'TRAFFIC' | 'HAZARD' | 'MUNICIPAL' | 'LIVE' | 'RECENT' | 'FORECAST' | 'ALERTS';
  version: number;
}
// ============================================================
// URBANPULSE 3D GEOSPATIAL & PLACES ARCHITECTURE (PHASE 2)
// ============================================================
export type MapMode = 'ROADMAP' | 'SATELLITE' | 'HYBRID' | 'TERRAIN' | '3D';
export type CameraPreset =
  | 'DEFAULT'
  | 'CITY_OVERVIEW'
  | 'LOCATION_FOCUS'
  | 'EVENT_FOCUS'
  | 'RISK_FOCUS'
  | 'ROUTE_FOCUS'
  | 'POI_FOCUS';
export interface StreetViewState {
  available: boolean | null;
  active: boolean;
  latitude: number;
  longitude: number;
  heading: number;
  pitch: number;
  zoom: number;
  panoId?: string;
  error?: string | null;
}
export interface NearbyActivityItem {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  userRatingsTotal?: number;
  types: string[];
  photo?: string;
  distanceMeters?: number;
}
export type UrbanPulse3DObjectType =
  | 'IntelligenceBeacon'
  | 'EventPulse'
  | 'RiskColumn'
  | 'TrafficPulse'
  | 'HazardRing'
  | 'ScoreBeacon'
  | 'RouteGlow'
  | 'NexusLocationMarker'
  | 'ActivityMarker';
// ============================================================
// URBANPULSE PHASE 3: PREDICTIVE INTELLIGENCE & DECISION ENGINES
// ============================================================
export type IntelligenceClassification =
  | 'OBSERVED'
  | 'CURRENT'
  | 'RECENT'
  | 'FORECAST'
  | 'SIMULATION'
  | 'RECOMMENDATION';
export type TrafficTrend = 'INCREASING' | 'STABLE' | 'DECREASING' | 'UNKNOWN';
export interface TrafficBaseline {
  currentCongestionIndex: number; // 0-100
  historicalBaseline: number; // 0-100
  deviationPercent: number; // e.g. +52%
  trend: TrafficTrend;
  confidence: number;
}
export interface TrafficForecast {
  location: ResolvedLocation;
  currentLevel: 'LOW' | 'MODERATE' | 'HEAVY' | 'SEVERE' | 'UNKNOWN';
  expectedLevel: 'LOW' | 'MODERATE' | 'HEAVY' | 'SEVERE' | 'UNKNOWN';
  forecastWindow: string; // e.g. "Next 2 hours"
  expectedPeakTime?: string; // e.g. "17:30–19:00"
  baseline: TrafficBaseline;
  summary: string;
  confidence: number;
  model: string;
  dataCoverage: string;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  generatedAt: string;
}
export type RiskForecastHorizon =
  | 'NOW'
  | '1_HOUR'
  | '3_HOURS'
  | '6_HOURS'
  | '12_HOURS'
  | '24_HOURS'
  | '7_DAYS'
  | '30_DAY_OUTLOOK';
export interface HorizonRiskDomainItem {
  domain: RiskDomain;
  currentLevel: RiskLevel;
  forecastLevel: RiskLevel;
  confidence: number;
  contributingSignals: string[];
  status: 'AVAILABLE' | 'UNKNOWN';
}
export interface HorizonRiskSnapshot {
  horizon: RiskForecastHorizon;
  label: string;
  overallLevel: RiskLevel;
  overallScore: number | null;
  confidence: number;
  domains: Record<RiskDomain, HorizonRiskDomainItem>;
  summary: string;
}
export interface RiskForecastReport {
  location: ResolvedLocation;
  evaluatedAt: string;
  horizons: Record<RiskForecastHorizon, HorizonRiskSnapshot>;
  guidance: string[];
}
export interface ScenarioSimulationResult {
  scenarioId: string;
  scenarioType: string;
  scenarioTitle: string;
  location: ResolvedLocation;
  isSimulation: true;
  label: 'SIMULATION';
  baseline: {
    overallScore: number;
    trafficStatus: string;
    floodRisk: string;
    roadCondition: string;
  };
  scenario: {
    overallScore: number;
    trafficStatus: string;
    floodRisk: string;
    roadCondition: string;
  };
  difference: {
    scoreDelta: number;
    trafficDelayIncreasePercent?: number;
    inundationDepthMeters?: number;
    speedReductionPercent?: number;
    summary: string;
  };
  affectedDomains: string[];
  affectedAreaKm2: number;
  confidence: number;
  assumptions: string[];
  limitations: string[];
  closedRoadPolyline?: Array<{ latitude: number; longitude: number }>;
  alternateRoutePolyline?: Array<{ latitude: number; longitude: number }>;
  simulatedAt: string;
}
export type SmartRouteCategory = 'FASTEST' | 'LOWEST_TRAFFIC' | 'LOWEST_RISK' | 'BALANCED';
export interface RouteScoreBreakdown {
  travelTimeScore: number; // 40%
  trafficScore: number; // 25%
  riskScore: number; // 20%
  weatherScore: number; // 10%
  roadConditionScore: number; // 5%
  totalScore: number; // 0-100
}
export interface SmartRouteOptionItem {
  id: string;
  category: SmartRouteCategory;
  name: string;
  distanceKm: number;
  estimatedMinutes: number;
  trafficDelayMinutes: number;
  overallRiskScore: number; // 0-100
  weatherRisk: 'CLEAR' | 'ADVISORY' | 'WARNING';
  roadCondition: string;
  scoreBreakdown: RouteScoreBreakdown;
  whyThisRoute: {
    traffic: string;
    hazards: string;
    weather: string;
    roadCondition: string;
    summary: string;
  };
  confidence: number;
  polyline: Array<{ latitude: number; longitude: number }>;
  speedReadingIntervals?: Array<{
    startPolylinePointIndex: number;
    endPolylinePointIndex: number;
    speed: 'NORMAL' | 'SLOW' | 'TRAFFIC_JAM';
  }>;
}
export interface SmartRoutePlan {
  origin: ResolvedLocation;
  destination: ResolvedLocation;
  travelMode: string;
  generatedAt: string;
  options: Record<SmartRouteCategory, SmartRouteOptionItem | null>;
  recommendedCategory: SmartRouteCategory;
  recommendedRoute: SmartRouteOptionItem;
  tradeOffs: string[];
}
export interface MissionPreference {
  priority: 'FASTEST' | 'LOWEST_RISK' | 'LOWEST_TRAFFIC' | 'BALANCED';
  avoidTolls?: boolean;
  avoidKnownHazards?: boolean;
  avoidClosures?: boolean;
  departureWindowStart?: string;
  departureWindowEnd?: string;
}
export interface MissionPlan {
  missionId: string;
  title: string;
  origin: ResolvedLocation;
  destination: ResolvedLocation;
  departureWindow: {
    start: string;
    end: string;
  };
  recommendedDepartureTime: string;
  recommendedDepartureReason: string;
  recommendedCategory: SmartRouteCategory;
  routePlan: SmartRoutePlan;
  expectedConditions: {
    traffic: string;
    weather: string;
    roadRisk: string;
    hazards: string;
  };
  confidence: number;
  whyRecommendation: string[];
  createdAt: string;
}
export interface PlaceRecommendation {
  placeId: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  trafficCondition: string;
  aqiValue: number | null;
  aqiCategory: string;
  weatherCondition: string;
  activitiesCount: number;
  overallRecommendationScore: number; // 0-100
  confidence: number;
  whyThisPlace: string[];
}
export interface PredictiveAnomaly {
  id: string;
  domain: RiskDomain;
  type: string;
  currentValue: number | string;
  expectedValue: number | string;
  deviationPercent: number;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  forecast: string;
  projectedSeverity: 'MODERATE' | 'SEVERE' | 'CRITICAL';
  confidence: number;
  detectedAt: string;
  location: ResolvedLocation;
}
export interface CascadeStep {
  stepIndex: number;
  event: string;
  observed: boolean;
  confidence: number;
  evidence?: string;
}
export interface CascadeChain {
  chainId: string;
  title: string;
  rootTrigger: string;
  chain: CascadeStep[];
  possibleNextImpact: string;
  potentialConsequence: string;
  confidence: number;
  classification: 'POSSIBLE_CONTRIBUTING_CHAIN';
  detectedAt: string;
}
export type AlertState = 'NEW' | 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'EXPIRED';
export interface MonitorRule {
  id: string;
  name: string;
  location: ResolvedLocation;
  radiusKm: number;
  signals: string[];
  condition: string;
  thresholdValue?: any;
  active: boolean;
  createdAt: string;
  lastEvaluatedAt?: string;
}
export interface UrbanPulseAlert {
  id: string;
  ruleId?: string;
  category: 'TRAFFIC' | 'WEATHER' | 'AQI' | 'HAZARDS' | 'ROADS' | 'SAFETY' | 'EVENTS' | 'FORECASTS';
  title: string;
  locationName: string;
  latitude: number;
  longitude: number;
  severity: 'INFO' | 'MODERATE' | 'HIGH' | 'SEVERE';
  state: AlertState;
  currentValue: string;
  normalValue?: string;
  change?: string;
  contributingFactor?: string;
  confidence: number;
  source: string;
  triggeredAt: string;
}
