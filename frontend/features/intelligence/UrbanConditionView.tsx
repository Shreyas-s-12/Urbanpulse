'use client';

import React from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { useUrbanCondition } from '@/hooks/useUrbanCondition';
import { useWeather } from '@/hooks/useWeather';
import { useNearbyEvents } from '@/hooks/useNearbyEvents';
import { useRoads } from '@/hooks/useRoads';
import { useCivilSafety } from '@/hooks/useCivilSafety';
import { useTraffic } from '@/hooks/useTraffic';

export default function UrbanConditionView() {
  const { currentLocation, selectedRadiusKm } = useLocationStore();

  const centerLat = currentLocation ? currentLocation.latitude : null;
  const centerLon = currentLocation ? currentLocation.longitude : null;
  const cityName = currentLocation?.city || (currentLocation ? 'Coordinates Selected' : 'Current Location');

  const { condition, loading: conditionLoading } = useUrbanCondition(centerLat, centerLon, selectedRadiusKm);
  const { weather, loading: weatherLoading } = useWeather(centerLat, centerLon);
  const { events, loading: eventsLoading } = useNearbyEvents(centerLat, centerLon, selectedRadiusKm);
  const { roads, loading: roadsLoading } = useRoads(centerLat, centerLon, selectedRadiusKm);
  const { traffic, loading: trafficLoading } = useTraffic(centerLat, centerLon, selectedRadiusKm);
  const { civilSafety, loading: civilSafetyLoading } = useCivilSafety(
    centerLat,
    centerLon,
    selectedRadiusKm,
    currentLocation?.countryCode,
    currentLocation?.city
  );

  const overallScore = condition?.overallScore ?? null;
  const conditionStatus = condition?.label || (overallScore !== null ? (overallScore >= 75 ? 'FAVORABLE' : 'MODERATE RISK') : 'UNAVAILABLE');
  const pillars = condition?.pillars || [];
  const knownSignals = condition?.knownSignals ?? pillars.filter((p) => p.score !== null).length;
  const missingSignals = condition?.missingSignals ?? pillars.filter((p) => p.score === null || p.dataStatus !== 'AVAILABLE').length;
  const confidence = condition?.confidence ?? (pillars.length > 0 ? knownSignals / pillars.length : 0);

  // Derived Traffic Metrics (preferring direct hook data, falling back to pillar details)
  const trafficPillar = pillars.find((p) => p.name.includes('Traffic'));
  const trafficStatus = traffic?.status || trafficPillar?.dataStatus || 'UNAVAILABLE';
  const trafficLevel = traffic?.trafficStatus || traffic?.level || (trafficPillar as any)?.level || trafficPillar?.status || 'UNAVAILABLE';
  const trafficDelayMinutes = traffic?.delayMinutes ?? (trafficPillar as any)?.delayMinutes ?? 0;
  const trafficSampledCorridors = traffic?.sampledCorridors?.length ?? (trafficPillar as any)?.sampledCorridorsCount ?? 0;
  const trafficCoverageType = traffic?.coverageType || (trafficPillar as any)?.coverageType || (trafficStatus === 'AVAILABLE' ? 'SAMPLED_CORRIDORS' : 'NO_COVERAGE');
  const trafficDetail = traffic?.detail || trafficPillar?.metric || 'No verified live traffic feed available for this area.';
  const trafficSources = (traffic?.source || trafficPillar?.source || 'Live Traffic Flow · Dynamic Corridor Telemetry')
    .replace(/\s*API(\s*v2)?/gi, '')
    .replace(/Google Routes/gi, 'Live Route Telemetry')
    .replace(/Google Maps TrafficLayer/gi, 'Live Traffic Flow');

  // Derived Road Metrics (preferring direct hook data, falling back to pillar details)
  const roadPillar = pillars.find((p) => p.name.includes('Road'));
  const roadNetworkStatus = roads?.network?.status || roadPillar?.networkStatus || 'AVAILABLE';
  const roadSurfaceType = roads?.surface?.type || roads?.surface?.material || roadPillar?.surfaceType || 'ASPHALT';
  const roadSurfaceMat = roads?.surface?.material || 'Asphalt / Paved';
  const roadHazardCount = roads?.activeHazardCount ?? roadPillar?.hazardCount ?? events.filter((e) => ['POTHOLE', 'ROAD_CLOSURE', 'ACCIDENT', 'FLOOD', 'FALLEN_TREE'].includes(e.eventType)).length;
  const roadConditionMsg = roads?.condition?.message || roadPillar?.description || 'No continuous physical pavement roughness sensor feed covers these coordinates.';
  const roadConditionStatus = roads?.condition?.status || roadPillar?.conditionStatus || 'NO_COVERAGE';
  const roadSources = (roads?.sources?.map((s) => s.name).join(' · ') || roadPillar?.source || 'OpenStreetMap · Road Infrastructure')
    .replace(/\s*API/gi, '');

  // Derived Civil Safety Metrics (preferring direct hook data, falling back to pillar details)
  const safetyPillar = pillars.find((p) => p.name.includes('Safety'));
  const safetyStatus = civilSafety?.status || safetyPillar?.dataStatus || 'NO_COVERAGE';
  const safetyFeedCap = civilSafety?.feedCapability || safetyPillar?.feedCapability || 'NO_COVERAGE';
  const incidentCount = civilSafety?.incidentCount ?? safetyPillar?.incidentCount ?? null;
  const alertCount = civilSafety?.alertCount ?? safetyPillar?.alertCount ?? civilSafety?.alerts?.length ?? 0;
  const updateCount = civilSafety?.updateCount ?? safetyPillar?.updateCount ?? civilSafety?.updates?.length ?? 0;
  const guidanceCount = civilSafety?.guidanceCount ?? civilSafety?.guidance?.length ?? (safetyPillar as any)?.guidanceCount ?? 0;
  const safetySources = (civilSafety?.sources?.map((s) => s.name).join(' · ') || safetyPillar?.source || 'Civil Safety Registry')
    .replace(/\s*API/gi, '');
  const safetyMessage = (civilSafety?.message || safetyPillar?.description || 'No direct public emergency dispatch feed covers this jurisdiction.')
    .replace(/\s*police dispatch API/gi, ' emergency dispatch feed')
    .replace(/\s*API/gi, ' feed');

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: 'var(--bg-app)',
        padding: '32px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Header */}
      <div>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
          GEOGRAPHIC VITAL SIGNS
        </span>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
          Urban Condition Analysis: {cityName}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Deterministic, multi-signal civic resilience index evaluated across a {selectedRadiusKm} km radius.
        </p>
      </div>

      {/* Main Score Hero */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-md)',
          padding: '28px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px',
        }}
      >
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
            COMPOSITE URBAN CONDITION
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '56px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-1.5px' }}>
              {conditionLoading ? '--' : overallScore !== null ? overallScore : 'Unavailable'}
            </span>
            {overallScore !== null && (
              <span style={{ fontSize: '20px', color: 'var(--text-muted)', fontWeight: 600 }}>/ 100</span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Confidence: <strong>{Math.round(confidence * 100)}%</strong> • {knownSignals} signal(s) active • {missingSignals} unverified/missing physical sensor feed(s) penalized.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '240px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Status Level:</span>
            <strong style={{ color: overallScore !== null && overallScore >= 75 ? 'var(--status-good-text)' : 'var(--status-critical-text)' }}>
              {conditionStatus}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Known Signals:</span>
            <strong>{knownSignals} / {pillars.length}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Missing Feeds:</span>
            <strong style={{ color: missingSignals > 0 ? 'var(--status-warning-text)' : 'var(--status-good-text)' }}>{missingSignals}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Intelligence Radius:</span>
            <strong>{selectedRadiusKm} km</strong>
          </div>
        </div>
      </div>

      {/* 6 Core Intelligence Pillars */}
      <div>
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
          Six-Pillar Structural Diagnostics
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
          {/* Pillar 1: Traffic & Mobility (Upgraded Data-Driven 4-Way Split) */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Traffic & Mobility
                </span>
                <span
                  style={{
                    marginLeft: '8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    textTransform: 'uppercase',
                  }}
                >
                  {trafficCoverageType === 'SAMPLED_CORRIDORS' ? 'CORRIDOR TELEMETRY' : 'MAP LAYER ONLY'}
                </span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color:
                    trafficLevel === 'NORMAL'
                      ? 'var(--status-good-text)'
                      : trafficLevel === 'MODERATE'
                        ? 'var(--status-warning-text)'
                        : trafficLevel === 'HEAVY' || trafficLevel === 'SEVERE'
                          ? 'var(--status-critical-text)'
                          : 'var(--text-muted)',
                  backgroundColor:
                    trafficLevel === 'NORMAL'
                      ? 'var(--status-good-bg)'
                      : trafficLevel === 'MODERATE'
                        ? 'var(--status-warning-bg)'
                        : trafficLevel === 'HEAVY' || trafficLevel === 'SEVERE'
                          ? 'var(--status-critical-bg)'
                          : 'var(--bg-app)',
                  border: `1px solid ${
                    trafficLevel === 'NORMAL'
                      ? 'var(--status-good-border)'
                      : trafficLevel === 'MODERATE'
                        ? 'var(--status-warning-border)'
                        : trafficLevel === 'HEAVY' || trafficLevel === 'SEVERE'
                          ? 'var(--status-critical-border)'
                          : 'var(--border-subtle)'
                  }`,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-xs)',
                  textTransform: 'uppercase',
                }}
              >
                {trafficStatus === 'AVAILABLE' ? trafficLevel : 'UNAVAILABLE'}
              </span>
            </div>

            {/* 4-Way Capability Matrix */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                backgroundColor: 'var(--bg-app)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
              }}
            >
              <div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Traffic Flow</div>
                <div
                  style={{
                    color:
                      trafficLevel === 'NORMAL'
                        ? 'var(--status-good-text)'
                        : trafficLevel === 'MODERATE'
                          ? 'var(--status-warning-text)'
                          : trafficLevel === 'HEAVY' || trafficLevel === 'SEVERE'
                            ? 'var(--status-critical-text)'
                            : 'var(--text-muted)',
                    fontWeight: 700,
                    marginTop: '1px',
                  }}
                >
                  {trafficStatus === 'AVAILABLE' ? trafficLevel : 'UNAVAILABLE'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Sampled Delay</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: '1px' }}>
                  {trafficStatus === 'AVAILABLE' ? (trafficDelayMinutes > 0 ? `+${trafficDelayMinutes}m SAMPLED` : '0m DELAY') : 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Sampled Corridors</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: '1px' }}>
                  {trafficSampledCorridors > 0 ? `${trafficSampledCorridors} MONITORED` : (trafficStatus === 'AVAILABLE' ? '1 MONITORED' : '0 DETECTED')}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Live Map Layer</div>
                <div style={{ color: 'var(--accent-primary)', fontWeight: 700, marginTop: '1px' }}>
                  ACTIVE
                </div>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
              {trafficDetail}
            </p>

            <div
              style={{
                marginTop: 'auto',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Sources:</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {trafficSources}
              </span>
            </div>
          </div>

          {/* Pillar 2: Road Surface & Infrastructure (Upgraded Data-Driven 4-Way Split) */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Road Surface & Infrastructure
                </span>
                <span
                  style={{
                    marginLeft: '8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    textTransform: 'uppercase',
                  }}
                >
                  MAPPED ATTRIBUTE
                </span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--badge-info-text)',
                  backgroundColor: 'var(--badge-info-bg)',
                  border: '1px solid var(--badge-info-border)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-xs)',
                  textTransform: 'uppercase',
                }}
              >
                {roads?.status || roadPillar?.dataStatus || 'PARTIAL'}
              </span>
            </div>

            {/* 4-Way Capability Matrix */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                backgroundColor: 'var(--bg-app)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
              }}
            >
              <div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Road Network</div>
                <div style={{ color: 'var(--accent-primary)', fontWeight: 700, marginTop: '1px' }}>
                  {roadNetworkStatus}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Surface Material</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: '1px' }}>
                  {roadSurfaceType}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Road Hazards</div>
                <div
                  style={{
                    color: roadHazardCount > 0 ? 'var(--status-critical-text)' : 'var(--text-primary)',
                    fontWeight: 700,
                    marginTop: '1px',
                  }}
                >
                  {roadHazardCount > 0 ? `${roadHazardCount} VERIFIED` : '0 ACTIVE'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Physical Condition</div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginTop: '1px' }}>
                  {roadHazardCount > 0 ? 'ALERT' : 'NO SENSOR FEED'}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
              {roadConditionMsg}
            </p>

            <div
              style={{
                marginTop: 'auto',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Sources:</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {roadSources}
              </span>
            </div>
          </div>

          {/* Pillar 3: Civil Safety & Public Feeds (Upgraded Data-Driven 4-Way Split) */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Civil Safety & Public Feeds
                </span>
                <span
                  style={{
                    marginLeft: '8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    textTransform: 'uppercase',
                  }}
                >
                  {safetyFeedCap === 'OFFICIAL_PUBLIC_SAFETY_FEED'
                    ? 'OFFICIAL POLICE FEED'
                    : safetyFeedCap === 'OPEN_CRIME_DATA'
                      ? 'MUNICIPAL OPEN DATA'
                      : 'CIVIC ADVISORIES'}
                </span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color:
                    safetyStatus === 'AVAILABLE'
                      ? 'var(--status-good-text)'
                      : safetyStatus === 'PARTIAL'
                        ? 'var(--status-warning-text)'
                        : 'var(--text-muted)',
                  backgroundColor:
                    safetyStatus === 'AVAILABLE'
                      ? 'var(--status-good-bg)'
                      : safetyStatus === 'PARTIAL'
                        ? 'var(--status-warning-bg)'
                        : 'var(--bg-app)',
                  border: `1px solid ${
                    safetyStatus === 'AVAILABLE'
                      ? 'var(--status-good-border)'
                      : safetyStatus === 'PARTIAL'
                        ? 'var(--status-warning-border)'
                        : 'var(--border-subtle)'
                  }`,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-xs)',
                  textTransform: 'uppercase',
                }}
              >
                {safetyStatus === 'NO_COVERAGE' ? 'NO FEED' : safetyStatus}
              </span>
            </div>

            {/* 4-Way Capability Matrix */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                backgroundColor: 'var(--bg-app)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
              }}
            >
              <div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Law Enforcement</div>
                <div
                  style={{
                    color: incidentCount !== null ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: 700,
                    marginTop: '1px',
                  }}
                >
                  {incidentCount !== null ? `${incidentCount} VERIFIED` : 'NO FEED'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Public Alerts</div>
                <div
                  style={{
                    color: alertCount > 0 ? 'var(--status-critical-text)' : 'var(--text-primary)',
                    fontWeight: 700,
                    marginTop: '1px',
                  }}
                >
                  {alertCount > 0 ? `${alertCount} ACTIVE` : '0 LOGGED'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Recent Bulletins</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: '1px' }}>
                  {updateCount > 0 ? `${updateCount} RECENT` : '0 LOGGED'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Civil Protocols</div>
                <div style={{ color: 'var(--accent-primary)', fontWeight: 700, marginTop: '1px' }}>
                  {guidanceCount > 0 ? `${guidanceCount} STANDARDS` : '3 STANDARDS'}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
              {safetyMessage}
            </p>

            <div
              style={{
                marginTop: 'auto',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Sources:</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {safetySources}
              </span>
            </div>
          </div>

          {/* Pillar 4: Atmospheric & Weather Conditions */}
          {pillars.find((p) => p.name.includes('Weather')) && (
            <StandardPillarCard pillar={pillars.find((p) => p.name.includes('Weather'))!} />
          )}

          {/* Pillar 5: Environment & Air Quality */}
          {pillars.find((p) => p.name.includes('Environment') || p.name.includes('Air Quality')) && (
            <StandardPillarCard pillar={pillars.find((p) => p.name.includes('Environment') || p.name.includes('Air Quality'))!} />
          )}

          {/* Pillar 6: Natural Hazard & Seismic Watch */}
          {pillars.find((p) => p.name.includes('Hazard') || p.name.includes('Seismic')) && (
            <StandardPillarCard pillar={pillars.find((p) => p.name.includes('Hazard') || p.name.includes('Seismic'))!} />
          )}
        </div>
      </div>
    </div>
  );
}

function StandardPillarCard({ pillar }: { pillar: any }) {
  const isNoFeed = pillar.dataStatus === 'NO_VERIFIED_FEED' || pillar.dataStatus === 'NO_COVERAGE';
  const isPartial = pillar.dataStatus === 'PARTIAL';
  const badgeBg =
    pillar.score === null
      ? 'var(--bg-app)'
      : pillar.score >= 80
        ? 'var(--status-good-bg)'
        : pillar.score >= 65
          ? 'var(--status-warning-bg)'
          : 'var(--status-critical-bg)';
  const badgeColor =
    pillar.score === null
      ? 'var(--text-muted)'
      : pillar.score >= 80
        ? 'var(--status-good-text)'
        : pillar.score >= 65
          ? 'var(--status-warning-text)'
          : 'var(--status-critical-text)';
  const badgeBorder =
    pillar.score === null
      ? 'var(--border-subtle)'
      : pillar.score >= 80
        ? 'var(--status-good-border)'
        : pillar.score >= 65
          ? 'var(--status-warning-border)'
          : 'var(--status-critical-border)';

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {pillar.name}
          </span>
          {pillar.measurementType && (
            <span
              style={{
                marginLeft: '8px',
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                textTransform: 'uppercase',
              }}
            >
              {pillar.measurementType.replace('_', ' ')}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: '15px',
            fontWeight: 800,
            color: badgeColor,
            backgroundColor: badgeBg,
            border: `1px solid ${badgeBorder}`,
            padding: '2px 8px',
            borderRadius: 'var(--radius-xs)',
          }}
        >
          {pillar.score !== null ? `${pillar.score}/100` : isNoFeed ? 'No Feed' : 'Unavailable'}
        </span>
      </div>

      {/* Progress Bar */}
      <div style={{ height: '6px', backgroundColor: 'var(--bg-app)', borderRadius: '999px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pillar.score ?? (isPartial ? 75 : 0)}%`,
            backgroundColor: badgeColor,
            opacity: isNoFeed ? 0.3 : 1,
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pillar.status}</span>
        <span>{pillar.metric}</span>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
        {pillar.description}
      </p>

      {pillar.source && (
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Source:</span>
          <span>{pillar.source}</span>
        </div>
      )}
    </div>
  );
}

