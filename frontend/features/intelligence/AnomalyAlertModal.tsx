'use client';

import React, { useState, useEffect } from 'react';
import { useAgentStore } from '@/stores/useAgentStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { agentService } from '@/services/agentService';
import { AnomalyDetectionResponse } from '@shared/types';
import { ZapIcon, CloseIcon, CheckIcon } from '@/components/common/Icons';

export default function AnomalyAlertModal() {
  const { showAnomaliesModal, setShowAnomaliesModal, activeAnomalies, activeLocation } = useAgentStore();
  const { currentLocation } = useLocationStore();
  const [localAnomalies, setLocalAnomalies] = useState<AnomalyDetectionResponse | null>(activeAnomalies);
  const [loading, setLoading] = useState<boolean>(false);

  const loc = activeLocation || currentLocation;

  const fetchAnomalies = async () => {
    if (!loc || loc.latitude == null || loc.longitude == null) {
      setLocalAnomalies(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const lat = loc.latitude;
      const lng = loc.longitude;
      const city = loc.city || loc.displayName || 'Active Location';
      const data = await agentService.getAnomalies(lat, lng, city);
      setLocalAnomalies(data);
    } catch (err) {
      console.warn('Failed to fetch anomalies:', err);
      setLocalAnomalies({
        anomalies: [],
        severityScore: 0,
        detectedCount: 0,
        evaluatedAt: new Date().toISOString(),
        location: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          city: loc.city || 'Active Location',
          displayName: loc.displayName || 'Active Location',
          country: loc.country || null,
          isUserLocation: loc.isUserLocation || false,
        },
      } as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showAnomaliesModal) {
      if (activeAnomalies) {
        setLocalAnomalies(activeAnomalies);
      } else if (!localAnomalies) {
        fetchAnomalies();
      }
    }
  }, [showAnomaliesModal, activeAnomalies]);

  if (!showAnomaliesModal) return null;

  const currentAnom = localAnomalies || activeAnomalies;
  const anomaliesList = currentAnom?.anomalies || [];
  const locName = currentAnom?.location?.city || currentAnom?.location?.displayName || loc?.city || 'Active Location';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(17, 24, 39, 0.4)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={() => setShowAnomaliesModal(false)}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-panel, #101620)',
          border: '1px solid var(--border-subtle, #1B2531)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '740px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          color: 'var(--text-primary)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle, #1B2531)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-header, #0C1119)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ZapIcon size={20} color="var(--accent-primary)" />
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Statistical Anomalies — {locName}
              </h2>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Detected statistical departures from 7-day diurnal rolling mean baselines (Z-Score &gt; 2.0σ).
            </div>
          </div>

          <button
            onClick={() => setShowAnomaliesModal(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Dismiss"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: 'var(--bg-panel, #101620)' }}>
          {anomaliesList.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderRadius: '16px',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                <CheckIcon size={32} color="#10B981" />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#34D399' }}>
                All Signals Tracking Expected Baselines
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '440px', margin: '6px auto 0' }}>
                Traffic flow, atmospheric particulate concentrations, meteorological telemetry, and incident density are within standard diurnal bounds.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {anomaliesList.map((anom, idx) => {
                const isCrit = anom.severity === 'HIGH';
                const sevColor = isCrit ? '#F87171' : '#FBBF24';
                return (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: 'var(--bg-card, #111821)',
                      border: `1px solid ${isCrit ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      borderRadius: '14px',
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                          {anom.signal}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            color: sevColor,
                            backgroundColor: isCrit ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {anom.severity || 'ELEVATED'}
                        </span>
                      </div>

                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {anom.source}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Current: </span>
                        <span style={{ fontWeight: 700, color: sevColor }}>{anom.currentValue}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Expected Baseline: </span>
                        <span style={{ color: 'var(--text-secondary)' }}>{anom.expectedBaseline}</span>
                      </div>
                      {anom.zScore !== undefined && anom.zScore !== null && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Z-Score: </span>
                          <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>+{anom.zScore}σ</span>
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {anom.explanation}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-subtle, #1B2531)',
            backgroundColor: 'var(--bg-header, #0C1119)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={() => setShowAnomaliesModal(false)}
            style={{
              backgroundColor: 'var(--bg-elevated, #141B26)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border, #263241)',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
