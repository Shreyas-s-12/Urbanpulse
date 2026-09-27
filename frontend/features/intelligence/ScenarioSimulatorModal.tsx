'use client';

import React, { useState } from 'react';
import { useAgentStore } from '@/stores/useAgentStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { agentService } from '@/services/agentService';
import {
  WeatherRainIcon,
  RoadIcon,
  CarIcon,
  LeafIcon,
  SparklesIcon,
  AlertTriangleIcon,
  CloseIcon,
} from '@/components/common/Icons';

const SCENARIO_CATEGORIES = [
  { id: 'RAINFALL', label: 'Rainfall', unit: 'mm', defaultIntensity: 10, defaultDuration: 1, icon: WeatherRainIcon },
  { id: 'FLOOD', label: 'Flood / Inundation', unit: 'm', defaultIntensity: 0.5, defaultDuration: 6, icon: WeatherRainIcon },
  { id: 'EXTREME_HEAT', label: 'Extreme Heat', unit: '°C', defaultIntensity: 45, defaultDuration: 72, icon: SparklesIcon },
  { id: 'CYCLONE', label: 'Cyclone', unit: 'km/h', defaultIntensity: 110, defaultDuration: 12, icon: WeatherRainIcon },
  { id: 'LANDSLIDE', label: 'Landslide', unit: 'mm', defaultIntensity: 80, defaultDuration: 6, icon: AlertTriangleIcon },
  { id: 'EARTHQUAKE', label: 'Earthquake', unit: 'Mw', defaultIntensity: 6.5, defaultDuration: 0.1, icon: AlertTriangleIcon },
  { id: 'DROUGHT', label: 'Drought', unit: '% deficit', defaultIntensity: 45, defaultDuration: 720, icon: LeafIcon },
  { id: 'STORM', label: 'Severe Storm', unit: 'mm/h', defaultIntensity: 40, defaultDuration: 2, icon: WeatherRainIcon },
  { id: 'WILDFIRE', label: 'Wildfire', unit: 'FWI', defaultIntensity: 50, defaultDuration: 24, icon: SparklesIcon },
  { id: 'WATER_LEVEL_RISE', label: 'Water-Level Rise', unit: 'm', defaultIntensity: 1.8, defaultDuration: 12, icon: WeatherRainIcon },
  { id: 'COASTAL_INUNDATION', label: 'Coastal Inundation', unit: 'm', defaultIntensity: 1.2, defaultDuration: 6, icon: WeatherRainIcon },
  { id: 'STORM_SURGE', label: 'Storm Surge', unit: 'm', defaultIntensity: 1.5, defaultDuration: 6, icon: WeatherRainIcon },
  { id: 'AIR_QUALITY_EVENT', label: 'Air Quality Event', unit: 'AQI', defaultIntensity: 210, defaultDuration: 24, icon: LeafIcon },
  { id: 'EXTREME_WIND', label: 'Extreme Wind', unit: 'km/h', defaultIntensity: 75, defaultDuration: 4, icon: SparklesIcon },
  { id: 'ROAD_DISRUPTION', label: 'Road Disruption', unit: '%', defaultIntensity: 40, defaultDuration: 3, icon: RoadIcon },
];

const EVIDENCE_BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'HISTORICAL EVIDENCE': { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  'MODEL-DERIVED PREDICTION': { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  'CURRENT OBSERVATION': { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' },
  'ASSUMPTION': { bg: '#F3E8FF', text: '#6B21A8', border: '#D8B4FE' },
  'INFERENCE': { bg: '#E0E7FF', text: '#3730A3', border: '#A5B4FC' },
  'UNKNOWN / INSUFFICIENT DATA': { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB' },
};

export default function ScenarioSimulatorModal() {
  const { showScenarioModal, setShowScenarioModal, activeScenario, activeLocation } = useAgentStore();
  const { currentLocation } = useLocationStore();

  const [queryText, setQueryText] = useState<string>('');
  const [locationInput, setLocationInput] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('RAINFALL');
  const [intensityVal, setIntensityVal] = useState<number>(10);
  const [durationHrs, setDurationHrs] = useState<number>(1);
  const [targetYearInput, setTargetYearInput] = useState<string>('');
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [activeMapLayer, setActiveMapLayer] = useState<string>('Scenario Prediction');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(activeScenario);

  React.useEffect(() => {
    if (activeScenario) {
      setSimResult(activeScenario);
      const cat =
        (activeScenario as any).canonicalScenarioCategory ||
        (activeScenario as any).scenarioType ||
        activeScenario.scenario ||
        'RAINFALL';
      setSelectedType(String(cat).toUpperCase());
    }
  }, [activeScenario]);

  if (!showScenarioModal) return null;

  const activeCatMeta =
    SCENARIO_CATEGORIES.find((c) => c.id === selectedType) || SCENARIO_CATEGORIES[0];

  const handleSelectCategory = (catId: string) => {
    setSelectedType(catId);
    const meta = SCENARIO_CATEGORIES.find((c) => c.id === catId);
    if (meta) {
      setIntensityVal(meta.defaultIntensity);
      setDurationHrs(meta.defaultDuration);
    }
  };

  const handleRunSimulation = async () => {
    const loc = activeLocation || currentLocation || simResult?.location;
    setIsSimulating(true);
    try {
      const payload: any = {
        query: queryText.trim() || undefined,
        location: locationInput.trim() || loc,
        latitude: locationInput.trim() ? undefined : loc?.latitude,
        longitude: locationInput.trim() ? undefined : loc?.longitude,
        scenario: selectedType,
        scenarioType: selectedType,
        radiusKm,
        parameters: {
          intensity: intensityVal,
          unit: activeCatMeta.unit,
          duration_hours: durationHrs,
          targetYear: targetYearInput ? Number(targetYearInput) : undefined,
        },
      };
      const res = await agentService.simulateScenario(payload);
      setSimResult(res);
    } catch (err) {
      console.warn('Scenario analysis request failed:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const locName =
    simResult?.location?.displayName ||
    simResult?.location?.city ||
    locationInput ||
    activeLocation?.city ||
    currentLocation?.city ||
    'Dynamic Location';

  const fourFactors: any[] = simResult?.fourKeyFactors || [];
  const histComparison = simResult?.historicalComparison || {};
  const affectedRoads: any[] = simResult?.affectedRoads || [];
  const affectedAreas: any[] = simResult?.affectedAreas || [];
  const histEvents: any[] = simResult?.historicalEvents || [];
  const confidenceLevel = simResult?.confidenceLevel || 'MEDIUM';
  const confidenceRationale = simResult?.confidenceReport?.rationale || '';
  const realtimeInputs: string[] = simResult?.recommendedRealtimeInputs || [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--overlay-backdrop)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={() => setShowScenarioModal(false)}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-panel)',
          color: 'var(--text-primary)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-header)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <SparklesIcon size={18} color="var(--accent-primary)" />
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                UrbanPulse Generalized Scenario Intelligence Engine — {locName}
              </h2>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  backgroundColor: 'var(--status-warning-bg)',
                  color: 'var(--status-warning-text)',
                  border: '1px solid var(--status-warning-border)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  letterSpacing: '0.08em',
                }}
              >
                EVIDENCE-GROUNDED SIMULATION
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Multi-hazard scenario analysis grounded in multi-year historical archives, Copernicus DEM topography, and OpenStreetMap infrastructure.
            </div>
          </div>

          <button
            onClick={() => setShowScenarioModal(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            backgroundColor: 'var(--bg-panel)',
          }}
        >
          {/* Free-form Natural Language Scenario Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Natural Language Scenario Prompt (Any Location, Hazard, Intensity, Duration, or Year)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder='e.g. "Assume 10 mm rainfall occurs in 1 hour in Malleswaram" or "Analyze a hypothetical 45°C temperature event lasting 3 days in Mysuru"'
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              />
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="Optional Location Override"
                style={{
                  width: '190px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              />
            </div>
          </div>

          {/* 15 Scenario Categories Grid */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Or Configure Scenario Category & Parameters
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '6px' }}>
              {SCENARIO_CATEGORIES.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => handleSelectCategory(sc.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    backgroundColor: selectedType === sc.id ? 'var(--badge-info-bg)' : 'var(--bg-card)',
                    border: selectedType === sc.id ? '1px solid var(--badge-info-border)' : '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: selectedType === sc.id ? 'var(--badge-info-text)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  <sc.icon size={14} />
                  <span>{sc.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Parameter Controls */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '10px',
              backgroundColor: 'var(--bg-card)',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Intensity ({activeCatMeta.unit})
              </div>
              <input
                type="number"
                step="any"
                value={intensityVal}
                onChange={(e) => setIntensityVal(Number(e.target.value))}
                style={{
                  width: '100%',
                  marginTop: '4px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-panel)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Duration (Hours)</div>
              <input
                type="number"
                step="0.5"
                min="0.1"
                value={durationHrs}
                onChange={(e) => setDurationHrs(Number(e.target.value))}
                style={{
                  width: '100%',
                  marginTop: '4px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-panel)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target Year (Optional)</div>
              <input
                type="number"
                placeholder="e.g. 2028"
                value={targetYearInput}
                onChange={(e) => setTargetYearInput(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '4px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-panel)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Radius (km)</div>
              <input
                type="number"
                min="1"
                max="50"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                style={{
                  width: '100%',
                  marginTop: '4px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-panel)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              />
            </div>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={isSimulating}
            style={{
              width: '100%',
              padding: '11px',
              backgroundColor: 'var(--button)',
              color: 'var(--button-foreground)',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: isSimulating ? 'not-allowed' : 'pointer',
            }}
          >
            {isSimulating ? 'Retrieving Historical Archive, DEM Topography & Running Scenario Model...' : 'Run Scenario Intelligence Engine'}
          </button>

          {/* Results Display */}
          {simResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Confidence & Primary Status Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>{simResult.scenarioTitle}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {confidenceRationale || simResult.projectedFloodRisk}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#DBEAFE',
                      color: '#1E40AF',
                    }}
                  >
                    Confidence: {confidenceLevel} ({Math.round((simResult.confidence || 0.72) * 100)}%)
                  </span>
                </div>
              </div>

              {/* Dynamic 4-Factor Impact Model */}
              {fourFactors.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
                    Scenario-Specific 4-Factor Impact Model ({simResult.canonicalScenarioCategory || selectedType})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {fourFactors.map((f: any, idx: number) => {
                      const badgeStyle =
                        EVIDENCE_BADGE_COLORS[f.evidenceType] || EVIDENCE_BADGE_COLORS['MODEL-DERIVED PREDICTION'];
                      return (
                        <div
                          key={f.factorId || idx}
                          style={{
                            backgroundColor: 'var(--bg-card)',
                            padding: '12px',
                            borderRadius: '10px',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700 }}>
                              {idx + 1}. {f.factorName}
                            </span>
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: badgeStyle.bg,
                                color: badgeStyle.text,
                                border: `1px solid ${badgeStyle.border}`,
                              }}
                            >
                              {f.evidenceType}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '4px' }}>
                            {f.status} {f.score != null ? `(${f.score}/100)` : ''}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {f.explanation}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Visually Distinct Map Layer Selector (Section 13) */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                  Separated Evidence & Map Layers (Historical vs. Predicted vs. Current)
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {['Scenario Prediction', 'Historical Events', 'Current Conditions', 'Infrastructure', 'Terrain'].map(
                    (layerName) => (
                      <button
                        key={layerName}
                        onClick={() => setActiveMapLayer(layerName)}
                        style={{
                          padding: '5px 10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          border:
                            activeMapLayer === layerName
                              ? '1px solid var(--accent-primary)'
                              : '1px solid var(--border-subtle)',
                          backgroundColor:
                            activeMapLayer === layerName ? 'var(--badge-info-bg)' : 'var(--bg-card)',
                          color: activeMapLayer === layerName ? 'var(--badge-info-text)' : 'var(--text-secondary)',
                        }}
                      >
                        Layer: {layerName}
                      </button>
                    )
                  )}
                </div>

                {activeMapLayer === 'Scenario Prediction' && (
                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', fontSize: '11px' }}>
                    <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                      Predicted Affected Areas & Roads [MODEL-DERIVED PREDICTION — Not Observed Closures]:
                    </div>
                    {affectedAreas.map((a: any, i: number) => (
                      <div key={i} style={{ marginBottom: '4px' }}>
                        • <strong>{a.label}</strong> ({a.severity}, Confidence: {a.confidence}): {a.impact}
                      </div>
                    ))}
                    {affectedRoads.map((r: any, i: number) => (
                      <div key={i} style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                        • Road Corridor: <strong>{r.roadName}</strong> — <em>{r.predictedImpact}</em> (Confidence: {r.confidence})
                      </div>
                    ))}
                  </div>
                )}

                {activeMapLayer === 'Historical Events' && (
                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)', fontSize: '11px' }}>
                    <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                      Retrieved Historical Observations [HISTORICAL EVIDENCE]:
                    </div>
                    {histEvents.length === 0 ? (
                      <div>No comparable historical events retrieved.</div>
                    ) : (
                      histEvents.map((ev: any, i: number) => (
                        <div key={i} style={{ marginBottom: '4px' }}>
                          • <strong>{ev.date}</strong> — {ev.intensity} at {ev.location}: {ev.observedImpact} ({ev.source})
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Assumptions, Limitations & Real-Time Data Needed */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px' }}>
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Explicit Assumptions [ASSUMPTION]:</div>
                  <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-secondary)' }}>
                    {(simResult.assumptions || []).map((a: string, i: number) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>Real-Time Telemetry That Would Improve Prediction:</div>
                  <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-secondary)' }}>
                    {realtimeInputs.map((rt: string, i: number) => (
                      <li key={i}>{rt}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
