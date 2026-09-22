'use client';

import React, { useState } from 'react';
import { useAgentStore } from '@/stores/useAgentStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { agentService } from '@/services/agentService';
import {
  CompassIcon,
  CarIcon,
  ShieldCheckIcon,
  HistoryClockIcon,
  AlertTriangleIcon,
  CloseIcon,
} from '@/components/common/Icons';

export default function MissionModal() {
  const {
    showMissionModal,
    setShowMissionModal,
    activeMission,
    setActiveMission,
    setActiveSmartRoutes,
  } = useAgentStore();
  const { currentLocation } = useLocationStore();

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [preference, setPreference] = useState<'FASTEST' | 'LOWEST_TRAFFIC' | 'LOWEST_RISK' | 'BALANCED'>('BALANCED');
  const [travelMode, setTravelMode] = useState<'drive' | 'two_wheeler' | 'transit'>('drive');
  const [isPlanning, setIsPlanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (activeMission) {
      setOrigin(activeMission.origin?.city || activeMission.origin?.displayName || '');
      setDestination(activeMission.destination?.city || activeMission.destination?.displayName || '');
    } else if (currentLocation?.city) {
      setOrigin(currentLocation.city);
    }
  }, [activeMission, currentLocation]);

  if (!showMissionModal) return null;

  const mission = activeMission;
  const bestWindow = mission?.recommendedDepartureWindow;
  const smartRoutes = mission?.smartRoutesPlan;
  const candidateRoutes = smartRoutes?.candidateRoutes || [];

  const handlePlanMission = async () => {
    if (!origin.trim() || !destination.trim()) {
      setErrorMsg('Please specify both an origin and a destination.');
      return;
    }
    setErrorMsg(null);
    setIsPlanning(true);

    try {
      const res = await agentService.planMission(
        origin.trim(),
        destination.trim(),
        preference
      );
      setActiveMission(res);
      if (res.smartRoutesPlan) {
        setActiveSmartRoutes(res.smartRoutesPlan);
      }
    } catch (err: any) {
      console.warn('Mission planning error:', err);
      setErrorMsg(err.message || 'Unable to plan mission at this time.');
    } finally {
      setIsPlanning(false);
    }
  };

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
      onClick={() => setShowMissionModal(false)}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CompassIcon size={20} color="var(--accent-primary)" />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                UrbanPulse Mission Mode
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Predictive travel corridor planning & departure timing optimization
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMissionModal(false)}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--bg-panel)' }}>
          {/* Query Inputs */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Origin Corridor
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mysuru Palace, Bengaluru, Tokyo"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--input-border)',
                    fontSize: '12.5px',
                    outline: 'none',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Destination
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bangalore Airport, Chamundi Hill"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--input-border)',
                    fontSize: '12.5px',
                    outline: 'none',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Strategy:</span>
                {(['BALANCED', 'FASTEST', 'LOWEST_TRAFFIC', 'LOWEST_RISK'] as const).map((pref) => (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => setPreference(pref)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: preference === pref ? '1px solid var(--badge-info-border)' : '1px solid var(--border)',
                      backgroundColor: preference === pref ? 'var(--badge-info-bg)' : 'var(--bg-elevated)',
                      color: preference === pref ? 'var(--badge-info-text)' : 'var(--text-secondary)',
                    }}
                  >
                    {pref.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handlePlanMission}
                disabled={isPlanning}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--button)',
                  color: 'var(--button-foreground)',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: isPlanning ? 'wait' : 'pointer',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                {isPlanning ? 'Analyzing Corridors...' : 'Compute Mission Plan'}
              </button>
            </div>

            {errorMsg && (
              <div style={{ fontSize: '11.5px', color: 'var(--status-critical-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangleIcon size={14} color="var(--status-critical-text)" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Mission Results */}
          {mission && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Departure Window Recommendation Banner */}
              {bestWindow && (
                <div
                  style={{
                    backgroundColor: 'var(--badge-info-bg)',
                    border: '1px solid var(--badge-info-border)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <HistoryClockIcon size={20} color="var(--badge-info-text)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--badge-info-text)', textTransform: 'uppercase' }}>
                      Optimal Departure Window
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {bestWindow.departureTime}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      <strong>Why this window:</strong> {bestWindow.rationale}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--status-good-text)', fontWeight: 600, marginTop: '4px' }}>
                      Est. Duration: {bestWindow.estimatedDurationMinutes}m (Saves approx. {bestWindow.expectedDelayMinutes || 0}m congestion delay)
                    </div>
                  </div>
                </div>
              )}

              {/* Scored Candidate Routes */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Multi-Criteria Candidate Corridors ({candidateRoutes.length})
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                  {candidateRoutes.map((r: any) => {
                    const isSelected = r.category === preference || r.category === smartRoutes?.recommendedCategory;
                    return (
                      <div
                        key={r.id}
                        style={{
                          backgroundColor: isSelected ? 'var(--badge-info-bg)' : 'var(--bg-card)',
                          border: isSelected ? '1.5px solid var(--badge-info-border)' : '1px solid var(--border-subtle)',
                          borderRadius: '10px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: isSelected ? 'var(--button)' : 'var(--bg-elevated)',
                              color: isSelected ? 'var(--button-foreground)' : 'var(--text-secondary)',
                              textTransform: 'uppercase',
                            }}
                          >
                            {r.category.replace('_', ' ')}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Score: {r.scoreBreakdown?.totalScore || 85}/100
                          </span>
                        </div>

                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                          {r.name}
                        </div>

                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          {r.estimatedTimeMinutes} mins · {r.distanceKm} km · Delay: +{r.trafficDelayMinutes || 0}m
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                          "{r.whyThisRoute || r.summary}"
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
