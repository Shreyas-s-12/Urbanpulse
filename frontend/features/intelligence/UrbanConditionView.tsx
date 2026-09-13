'use client';

import React from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { useUrbanCondition } from '@/hooks/useUrbanCondition';
import { useWeather } from '@/hooks/useWeather';
import { useNearbyEvents } from '@/hooks/useNearbyEvents';

export default function UrbanConditionView() {
  const { currentLocation, selectedRadiusKm } = useLocationStore();

  const centerLat = currentLocation ? currentLocation.latitude : null;
  const centerLon = currentLocation ? currentLocation.longitude : null;
  const cityName = currentLocation?.city || (currentLocation ? 'Coordinates Selected' : 'Current Location');

  const { condition, loading: conditionLoading } = useUrbanCondition(centerLat, centerLon, selectedRadiusKm);
  const { weather, loading: weatherLoading } = useWeather(centerLat, centerLon);
  const { events, loading: eventsLoading } = useNearbyEvents(centerLat, centerLon, selectedRadiusKm);

  const overallScore = condition?.overallScore ?? null;
  const conditionStatus = condition?.label || (overallScore !== null ? (overallScore >= 75 ? 'FAVORABLE' : 'MODERATE RISK') : 'UNAVAILABLE');
  const pillars = condition?.pillars || [];
  const knownSignals = condition?.knownSignals ?? pillars.filter((p) => p.score !== null).length;
  const missingSignals = condition?.missingSignals ?? pillars.filter((p) => p.score === null).length;
  const confidence = condition?.confidence ?? (pillars.length > 0 ? knownSignals / pillars.length : 0);

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
            Confidence: <strong>{Math.round(confidence * 100)}%</strong> • {knownSignals} verified signal(s) active • {missingSignals} missing feed(s) penalized.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '240px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Status Level:</span>
            <strong style={{ color: overallScore !== null && overallScore >= 75 ? 'var(--accent-primary)' : 'var(--severity-critical)' }}>
              {conditionStatus}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Known Signals:</span>
            <strong>{knownSignals} / {pillars.length}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Missing Feeds:</span>
            <strong style={{ color: missingSignals > 0 ? 'var(--text-muted)' : 'var(--accent-primary)' }}>{missingSignals}</strong>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {pillars.map((pillar) => {
            const isNoFeed = pillar.dataStatus === 'NO_VERIFIED_FEED' || pillar.dataStatus === 'NO_COVERAGE';
            const isPartial = pillar.dataStatus === 'PARTIAL';
            const badgeBg =
              pillar.score === null
                ? 'var(--bg-app)'
                : pillar.score >= 80
                  ? 'rgba(19, 184, 135, 0.12)'
                  : pillar.score >= 65
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)';
            const badgeColor =
              pillar.score === null
                ? 'var(--text-muted)'
                : pillar.score >= 80
                  ? 'var(--severity-low)'
                  : pillar.score >= 65
                    ? 'var(--severity-moderate)'
                    : 'var(--severity-high)';

            return (
              <div
                key={pillar.name}
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
          })}
        </div>
      </div>
    </div>
  );
}
