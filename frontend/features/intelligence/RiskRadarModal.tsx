'use client';

import React, { useState, useEffect } from 'react';
import { useAgentStore } from '@/stores/useAgentStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { agentService } from '@/services/agentService';
import { ShieldCheckIcon, AlertTriangleIcon, CloseIcon } from '@/components/common/Icons';

const DOMAIN_KEYS = ['ALL', 'TRAFFIC', 'FLOOD', 'FIRE', 'SAFETY', 'WEATHER', 'ROAD', 'AQI', 'HAZARDS'] as const;
const HORIZON_KEYS = [
  { id: 'NOW', label: 'Now' },
  { id: '1H', label: '+1h' },
  { id: '3H', label: '+3h' },
  { id: '6H', label: '+6h' },
  { id: '12H', label: '+12h' },
  { id: '24H', label: '+24h' },
  { id: '7_DAY_TREND', label: '7-Day' },
  { id: '30_DAY_OUTLOOK', label: '30-Day Outlook' },
] as const;

export default function RiskRadarModal() {
  const { showRiskModal, setShowRiskModal, activeRisk, activeLocation } = useAgentStore();
  const { currentLocation, selectedRadiusKm } = useLocationStore();
  const [localRisk, setLocalRisk] = useState<any | null>(activeRisk);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [selectedHorizon, setSelectedHorizon] = useState<string>('NOW');
  const [forecastReport, setForecastReport] = useState<any | null>(null);

  const loc = activeLocation || currentLocation;

  const fetchRiskData = async () => {
    if (!loc || loc.latitude == null || loc.longitude == null) {
      setLocalRisk(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const lat = loc.latitude;
      const lng = loc.longitude;
      const city = loc.city || loc.displayName || undefined;
      const countryCode = loc.countryCode || undefined;

      const [riskData, forecastData] = await Promise.all([
        agentService.getRiskReport(lat, lng, selectedRadiusKm || 50, city, countryCode),
        agentService.getRiskForecast(lat, lng, selectedRadiusKm || 50, city, countryCode).catch(() => null),
      ]);
      setLocalRisk(riskData);
      if (forecastData) {
        setForecastReport(forecastData);
      }
    } catch (err: any) {
      console.warn('Failed to fetch risk radar report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showRiskModal) {
      if (activeRisk) {
        setLocalRisk(activeRisk);
      }
      fetchRiskData();
    }
  }, [showRiskModal, activeRisk]);

  if (!showRiskModal) return null;

  // Derive active view report based on selected horizon
  let activeHorizonReport = localRisk || activeRisk;
  if (selectedHorizon !== 'NOW' && forecastReport?.horizons?.[selectedHorizon]) {
    const hor = forecastReport.horizons[selectedHorizon];
    activeHorizonReport = {
      overallLevel: hor.overallLevel,
      overallScore: hor.overallScore,
      confidence: hor.confidence,
      model: hor.model,
      uncertaintyNote: hor.uncertaintyNote,
      domains: hor.domains || activeHorizonReport?.domains || {},
      actionableGuidance: hor.actionableGuidance || activeHorizonReport?.actionableGuidance || [],
      location: activeHorizonReport?.location,
    };
  }

  const report = activeHorizonReport;
  const overallLevel = report?.overallLevel || 'UNKNOWN';
  const overallScore = report?.overallScore;
  const confPercent = Math.round((report?.confidence || 0.85) * 100);
  const locName = report?.location?.displayName || report?.location?.city || loc?.displayName || 'Active Location';
  const domains = report?.domains || {};
  const guidance = report?.actionableGuidance || [];

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'SEVERE':
        return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.40)', text: '#F87171' };
      case 'HIGH':
        return { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.40)', text: '#FB923C' };
      case 'MODERATE':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.40)', text: '#FBBF24' };
      case 'LOW':
        return { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.40)', text: '#4ADE80' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.35)', text: '#94A3B8' };
    }
  };

  const filteredDomainEntries = Object.entries(domains).filter(([dName]) => {
    if (selectedDomain === 'ALL') return true;
    return dName === selectedDomain;
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={() => setShowRiskModal(false)}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-panel, #101620)',
          border: '1px solid var(--border-subtle, #1B2531)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          color: 'var(--text-primary)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle, #1B2531)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-header, #0C1119)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheckIcon size={20} color="var(--accent-primary)" />
            <div>
              <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                UrbanPulse Risk Radar
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {locName} • Multi-domain live intelligence
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowRiskModal(false)}
            aria-label="Close modal"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: '1px solid var(--border, #263241)',
              backgroundColor: 'var(--bg-elevated, #141B26)',
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

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--bg-panel, #101620)' }}>
          {/* Top Summary Banner */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: getLevelBadge(overallLevel).bg,
              border: `1px solid ${getLevelBadge(overallLevel).border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: getLevelBadge(overallLevel).text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                OVERALL RISK LEVEL
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: getLevelBadge(overallLevel).text }}>
                {overallLevel}
                {overallScore !== null && overallScore !== undefined && (
                  <span style={{ fontSize: '15px', fontWeight: 600, marginLeft: '8px', opacity: 0.85 }}>
                    (Index: {overallScore}/100)
                  </span>
                )}
                {overallScore === null && (
                  <span style={{ fontSize: '13px', fontWeight: 500, marginLeft: '8px', opacity: 0.85 }}>
                    (— Incomplete Coverage)
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11.5px', color: getLevelBadge(overallLevel).text, marginTop: '2px' }}>
                Confidence: {confPercent}% • Evaluated across 8 independent physical and civil domains.
              </div>
            </div>

            <button
              type="button"
              onClick={fetchRiskData}
              disabled={loading}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border, #263241)',
                backgroundColor: 'var(--bg-elevated, #141B26)',
                fontSize: '11.5px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Refreshing...' : 'Re-evaluate'}
            </button>
          </div>

          {/* Predictive Horizon Selector */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Forecast Horizon & Predictive Window
            </div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              {HORIZON_KEYS.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelectedHorizon(h.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    border: selectedHorizon === h.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle, #1B2531)',
                    backgroundColor: selectedHorizon === h.id ? 'var(--accent-primary)' : 'var(--bg-elevated, #141B26)',
                    color: selectedHorizon === h.id ? '#FFFFFF' : 'var(--text-secondary)',
                    boxShadow: selectedHorizon === h.id ? 'var(--shadow-xs)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Model Provenance & Uncertainty Note (when viewing predictive horizon) */}
          {selectedHorizon !== 'NOW' && (
            <div
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.10)',
                border: '1px solid rgba(59, 130, 246, 0.30)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '11px',
                color: 'var(--accent-primary, #60A5FA)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong>Predictive Horizon {selectedHorizon}</strong>: {report.uncertaintyNote || 'Confidence decays progressively across extended forecast windows.'}
              </div>
              <div style={{ fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', fontWeight: 700 }}>
                Model: {report.model || 'DECAYING_TELEMETRY_EXTRAPOLATION'}
              </div>
            </div>
          )}

          {/* Domain Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {DOMAIN_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedDomain(k)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: selectedDomain === k ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle, #1B2531)',
                  backgroundColor: selectedDomain === k ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-elevated, #141B26)',
                  color: selectedDomain === k ? 'var(--accent-primary)' : 'var(--text-secondary)',
                }}
              >
                {k}
              </button>
            ))}
          </div>

          {/* Domain Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {filteredDomainEntries.map(([dName, dAssessment]: [string, any]) => {
              const badge = getLevelBadge(dAssessment.level);
              return (
                <div
                  key={dName}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-card, #111821)',
                    border: '1px solid var(--border-subtle, #1B2531)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {dName}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        backgroundColor: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {dAssessment.level}
                      {dAssessment.score !== null && ` • ${dAssessment.score}`}
                      {dAssessment.score === null && ' • —'}
                    </span>
                  </div>

                  <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {dAssessment.headline}
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {dAssessment.description}
                  </div>

                  {/* Signals List */}
                  {dAssessment.signals && dAssessment.signals.length > 0 && (
                    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {dAssessment.signals.map((sig: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: '10.5px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            color: 'var(--text-muted)',
                            padding: '2px 0',
                            borderTop: idx > 0 ? '1px dashed var(--border-subtle, #1B2531)' : 'none',
                          }}
                        >
                          <span>{sig.name}</span>
                          <span style={{ fontWeight: 600, color: sig.value !== null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {sig.value !== null && sig.value !== undefined ? String(sig.value) : '— (No Feed)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: '4px' }}>
                    Source: {dAssessment.source}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actionable Safety Guidance */}
          {guidance && guidance.length > 0 && (
            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-card, #111821)',
                border: '1px solid var(--border-subtle, #1B2531)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                ACTIONABLE SAFETY GUIDANCE
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {guidance.map((item: string, idx: number) => (
                  <div key={idx} style={{ fontSize: '11.5px', color: 'var(--text-primary)', display: 'flex', gap: '6px' }}>
                    <span>•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
