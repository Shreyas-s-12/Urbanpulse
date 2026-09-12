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
  region?: string | null; // state / province
  country: string | null;
  timezone?: string | null;
  displayName: string;
  isUserLocation: boolean;
}

export type IntelligenceRadiusKm = 5 | 10 | 25 | 50 | 100 | 250;

export type AppMode = 'explore' | 'journey';

export type DataStatus = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'STALE' | 'DEMO';

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
    // Crime specific
    verifiedByOfficial?: boolean;
    // General
    address?: string;
    imageUrl?: string;
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

export interface UrbanConditionPillar {
  name: string;
  score: number | null; // null if data unavailable
  status: string;
  metric: string;
  description: string;
  dataStatus: DataStatus;
}

export interface UrbanConditionBreakdown {
  overallScore: number | null; // 0–100, null if insufficient signals
  label: 'EXCELLENT' | 'GOOD' | 'FAVORABLE' | 'MODERATE' | 'CONCERN' | 'CRITICAL' | 'UNAVAILABLE';
  pillars: UrbanConditionPillar[];
  activeIncidentsCount: number;
  locationName: string;
  radiusKm: number;
  confidence: number;
  lastUpdated: string;
  dataStatus: DataStatus;
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
