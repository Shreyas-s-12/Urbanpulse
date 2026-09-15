/**
 * UrbanPulse Phase 5 Command Center & Intelligence Types
 */

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'WARNING' | 'MODERATE' | 'LOW' | 'NORMAL';
export type LifecycleState = 'DETECTED' | 'CONFIRMED' | 'ESCALATING' | 'ACTIVE' | 'STABILIZING' | 'RESOLVED';
export type WatermarkTag = 'HISTORICAL' | 'CURRENT' | 'FORECAST' | 'SIMULATION';
export type RelationNature = 'OBSERVED' | 'INFERRED';

export interface UrbanStatusIndicator {
  label: string;
  value: string;
  detail: string;
  severity: SeverityLevel;
  confidence: number;
}

export interface SituationItem {
  id: string;
  category: 'TRAFFIC' | 'WEATHER' | 'INCIDENT' | 'SAFETY' | 'HAZARDS';
  severity: SeverityLevel;
  title: string;
  description: string;
  confidence: number;
  impact: string;
  timestamp: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface CommandOverview {
  locationName: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  radiusKm: number;
  urbanStatus: {
    traffic?: UrbanStatusIndicator;
    weather?: UrbanStatusIndicator;
    aqi?: UrbanStatusIndicator;
    hazards?: UrbanStatusIndicator;
    safety?: UrbanStatusIndicator;
    infrastructure?: UrbanStatusIndicator;
    overallConfidence: number;
  };
  urbanPulseScore: number;
  situationAwareness: SituationItem[];
  totalActiveIncidents: number;
  generatedAt: string;
}

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  category: string;
  status: string;
  confidence: number;
  source: string;
  properties: Record<string, any>;
  timestamp: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  nature: RelationNature;
  confidence: number;
  evidence: string;
  weight: number;
  timestamp: string;
}

export interface CrossDomainGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  focusNodeId: string;
  totalNodes: number;
  totalEdges: number;
  generatedAt: string;
  centerLocation: string;
  provenance?: {
    observedEdges: number;
    inferredEdges: number;
    veracityPolicy: string;
  };
}

export interface CascadeStep {
  stageIndex: number;
  stage: 'OBSERVED' | 'INFERRED' | 'FORECAST';
  title: string;
  detail: string;
  confidence: number;
  evidence: string;
}

export interface IncidentDossier {
  incidentId: string;
  title: string;
  eventType: string;
  lifecycleState: LifecycleState;
  severity: SeverityLevel;
  location: {
    latitude: number;
    longitude: number;
    name: string;
  };
  spatialImpact: {
    impactRadiusKm: number;
    affectedAreaSqKm: number;
    affectedRoadsCount: number;
    affectedPoisCount: number;
    transitDelayMinutes: number;
    trafficStatus: string;
    nearbyPois: Array<{ name: string; vicinity?: string; rating?: number }>;
  };
  infrastructureDependencies: Array<{
    type: string;
    name: string;
    status: string;
    relation: string;
    impactLevel: string;
  }>;
  cascadeChain: CascadeStep[];
  impactForecast: Array<{
    scenario: string;
    likelihood: string;
    potentialConsequence: string;
    confidence: number;
    classification: string;
  }>;
  evidence: Array<{
    source: string;
    dataType: string;
    timestamp: string;
    confidence: number;
    contribution: string;
  }>;
  recommendedActions: Array<{
    optionId: string;
    title: string;
    description: string;
    benefit: string;
    tradeOff: string;
    confidence: number;
  }>;
  stateTimeline: Array<{
    state: LifecycleState;
    timestamp: string;
    evidence: string;
  }>;
  generatedAt: string;
}

export interface CityHealthDomain {
  domain: string;
  status: 'HEALTHY' | 'STABLE' | 'WATCH' | 'AT_RISK' | 'UNKNOWN';
  score: number;
  summary: string;
}

export interface CityHealthResponse {
  locationName: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  overallStatus: string;
  resilienceScore: number;
  confidence: number;
  domains: CityHealthDomain[];
  observedAt: string;
}

export interface DecisionOption {
  optionId: string;
  title: string;
  recommendationLevel: 'RECOMMENDED' | 'VIABLE' | 'ALTERNATIVE';
  summary: string;
  benefits: string[];
  tradeOffs: string[];
  estimatedDurationImpact: string;
  riskLevel: string;
  confidence: number;
  rationale: string;
}

export interface DecisionSupportResponse {
  location: string;
  objective: string;
  constraints: string[];
  currentConditions: {
    trafficStatus: string;
    delayMinutes: number;
    precipitation: number;
  };
  options: DecisionOption[];
  totalEvaluatedOptions: number;
  generatedAt: string;
  disclaimer: string;
}

export interface ComparisonEntity {
  name: string;
  geographyType: string;
  latitude: number;
  longitude: number;
  urbanPulseScore: number;
  confidence: number;
  metrics: {
    trafficStatus: string;
    trafficDelayMinutes: number;
    temperatureC: number;
    precipitationMm: number;
    weatherCondition: string;
    aqi: string | number;
    aqiCategory: string;
    safetyRating: string;
    hazardLevel: string;
    dataConfidence: number;
  };
  sources: string[];
}

export interface ComparisonResponse {
  comparisonWindow: string;
  entities: ComparisonEntity[];
  comparisonMatrix: Array<{
    dimension: string;
    category: string;
    values: Record<string, string>;
  }>;
  explanation: {
    leader: string;
    scoreMargin: number;
    primaryFactors: string[];
    verdict: string;
    attributionConfidence: number;
  };
  comparedAt: string;
}

export interface ProviderHealthItem {
  id: string;
  name: string;
  category: string;
  status: 'HEALTHY' | 'DEGRADED' | 'ERROR' | 'NO_COVERAGE' | 'STALE';
  latencyMs: number;
  freshnessMinutes: number;
  coverage: string;
  lastPing: string;
  errorRate: number;
}

export interface DataQualityDomain {
  domain: string;
  provider: string;
  status: string;
  freshnessMinutes: number;
  coveragePercent: number;
  confidence: number;
  lastSuccessfulUpdate: string;
}

export interface ReplayFrame {
  stepIndex: number;
  timestamp: string;
  displayTime: string;
  watermark: WatermarkTag;
  conditions: {
    trafficStatus: string;
    delayMinutes: number;
    precipitationMm: number;
    temperatureC: number;
  };
  activeEventsCount: number;
  events: Array<{
    id: string;
    title: string;
    eventType: string;
    severity: number;
    latitude: number;
    longitude: number;
  }>;
}

export interface ReplayTimelineResponse {
  window: string;
  totalFrames: number;
  startTime: string;
  endTime: string;
  timeline: ReplayFrame[];
  watermarkPolicy: string;
  generatedAt: string;
}

export interface ReportResponse {
  reportId: string;
  title: string;
  mode: 'EXECUTIVE' | 'TECHNICAL';
  target: {
    name: string;
    coordinates: { latitude: number; longitude: number };
    radiusKm: number;
  };
  timestamp: string;
  executiveSummary: string;
  overallStatus: string;
  compositeScore: number;
  confidence: number;
  currentConditions: Record<string, any>;
  recommendations: Array<{ priority: string; action: string; detail: string }>;
  sources: string[];
  technicalLineage?: Record<string, any>;
}
