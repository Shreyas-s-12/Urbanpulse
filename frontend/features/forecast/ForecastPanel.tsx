'use client';

import React, { useState } from 'react';
import { useAgentStore } from '@/stores/useAgentStore';

export default function ForecastPanel() {
  const { activeForecast, showForecastPanel, setShowForecastPanel, activeLocation } = useAgentStore();
  const [selectedHorizon, setSelectedHorizon] = useState<'7_DAYS' | '30_DAYS'>('7_DAYS');

  if (!showForecastPanel || !activeForecast) return null;

  const dailyPoints: any[] = activeForecast.daily || [];
  const monthlyOutlook = activeForecast.monthlyOutlook;
  const is30Day = activeForecast.horizon === '30_DAYS' || selectedHorizon === '30_DAYS';
  const cityName = activeLocation?.city || activeLocation?.displayName || 'Active Area';

  const getScoreBadge = (score: number) => {
    if (score >= 80) {
      return { bg: 'rgba(16, 185, 129, 0.12)', color: '#059669' };
    }
    if (score >= 60) {
      return { bg: 'rgba(245, 158, 11, 0.12)', color: '#D97706' };
    }
    return { bg: 'rgba(239, 68, 68, 0.12)', color: '#DC2626' };
  };

  const getAqiBadgeColor = (category: string) => {
    const c = (category || '').toLowerCase();
    if (c.includes('good') || c.includes('satisfactory')) return '#059669';
    if (c.includes('moderate')) return '#D97706';
    if (c.includes('poor')) return '#EA580C';
    return '#DC2626';
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        width: '420px',
        maxHeight: 'calc(100% - 40px)',
        backgroundColor: 'var(--bg-surface, #FFFFFF)',
        borderRadius: 'var(--radius-lg, 16px)',
        border: '1px solid var(--border-subtle, #E2E8F0)',
        boxShadow: 'var(--shadow-panel, 0 20px 25px -5px rgba(0, 0, 0, 0.08))',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        overflow: 'hidden',
        color: 'var(--text-primary, #11161B)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle, #E2E8F0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-surface, #FFFFFF)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.1rem' }}>🔮</span>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              {is30Day ? '30-Day Outlook' : '7-Day Multi-Pillar Forecast'}
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--radius-xs, 4px)',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                color: 'var(--accent-primary, #2563EB)',
              }}
            >
              FORECAST
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #65717D)', marginTop: '3px' }}>
            {cityName} • Grounded Numerical Telemetry
          </div>
        </div>
        <button
          onClick={() => setShowForecastPanel(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #8E9BA8)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            fontSize: '1.1rem',
            lineHeight: 1,
            transition: 'color 0.15s ease',
          }}
          title="Close Drawer"
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          padding: '0 16px',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle, #E2E8F0)',
          backgroundColor: 'var(--bg-surface, #FFFFFF)',
        }}
      >
        <button
          onClick={() => setSelectedHorizon('7_DAYS')}
          style={{
            flex: 1,
            padding: '10px 12px',
            fontSize: '12px',
            fontWeight: 600,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: !is30Day ? 'var(--accent-primary, #2563EB)' : 'var(--text-secondary, #65717D)',
            borderBottom: !is30Day ? '2px solid var(--accent-primary, #2563EB)' : '2px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          7-Day Multi-Pillar
        </button>
        <button
          onClick={() => setSelectedHorizon('30_DAYS')}
          style={{
            flex: 1,
            padding: '10px 12px',
            fontSize: '12px',
            fontWeight: 600,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: is30Day ? 'var(--accent-primary, #2563EB)' : 'var(--text-secondary, #65717D)',
            borderBottom: is30Day ? '2px solid var(--accent-primary, #2563EB)' : '2px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          30-Day Outlook
        </button>
      </div>

      {/* Content Body */}
      <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {is30Day && monthlyOutlook ? (
          /* 30-Day Outlook Mode */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Section 1: Expected Urban Condition */}
            <div>
              <div
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted, #8E9BA8)',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                EXPECTED URBAN CONDITION
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary, #11161B)', marginTop: '4px', letterSpacing: '-0.02em' }}>
                {monthlyOutlook.expectedRange?.[0]}–{monthlyOutlook.expectedRange?.[1]}{' '}
                <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-muted, #8E9BA8)' }}>/ 100</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary, #65717D)', marginTop: '6px' }}>
                Trend:{' '}
                <strong style={{ color: 'var(--text-primary, #11161B)', fontWeight: 600 }}>
                  {monthlyOutlook.trend}
                </strong>
              </div>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border-subtle, #E2E8F0)' }} />

            {/* Section 2: Seasonal Dynamics & Risks */}
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-primary, #11161B)',
                  marginBottom: '10px',
                }}
              >
                Seasonal Dynamics & Risks
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {(monthlyOutlook.riskFactors || []).map((risk: string, idx: number) => (
                  <li
                    key={idx}
                    style={{
                      fontSize: '13px',
                      lineHeight: 1.55,
                      color: 'var(--text-secondary, #65717D)',
                    }}
                  >
                    {risk}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border-subtle, #E2E8F0)' }} />

            {/* Section 3: Sources & Confidence */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: 'var(--text-secondary, #65717D)',
                }}
              >
                <span>Sources & Confidence</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-primary, #2563EB)' }}>
                  Confidence: {Math.round((activeForecast.confidence || 0.62) * 100)}%
                </span>
              </div>

              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted, #8E9BA8)',
                  lineHeight: 1.5,
                  marginTop: '10px',
                  fontStyle: 'italic',
                }}
              >
                ⚠️ 30-day outlooks reflect climatological bounds and historical trendlines. UrbanPulse never fabricates exact daily predictions a month in advance.
              </div>
            </div>
          </div>
        ) : (
          /* 7-Day Daily Horizon */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--text-muted, #8E9BA8)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '2px',
              }}
            >
              <span>7-DAY TELEMETRY</span>
              <span style={{ color: 'var(--accent-primary, #2563EB)' }}>
                Confidence: {Math.round((activeForecast.confidence || 0.85) * 100)}%
              </span>
            </div>

            {dailyPoints.map((dp: any, index: number) => {
              const dateObj = new Date(dp.date);
              const dayName = index === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const scoreBadge = getScoreBadge(dp.urbanConditionScore);

              return (
                <div
                  key={dp.date || index}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm, 8px)',
                    backgroundColor: 'var(--bg-surface, #FFFFFF)',
                    border: '1px solid var(--border-subtle, #E2E8F0)',
                    boxShadow: 'var(--shadow-xs, 0 1px 2px 0 rgba(0, 0, 0, 0.03))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>{dayName}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>•</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{dp.weatherCondition}</span>
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: scoreBadge.color,
                        backgroundColor: scoreBadge.bg,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-xs, 4px)',
                      }}
                    >
                      {dp.urbanConditionScore}/100
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      paddingTop: '6px',
                      borderTop: '1px solid var(--border-subtle, #E2E8F0)',
                    }}
                  >
                    <div>
                      🌡️ <strong>{dp.tempHighC}°</strong> / {dp.tempLowC}°C
                    </div>
                    <div>
                      🌫️{' '}
                      <span style={{ color: getAqiBadgeColor(dp.aqiCategory), fontWeight: 600 }}>
                        AQI {dp.aqiValue}
                      </span>
                    </div>
                    <div>
                      🚗 <strong>{dp.trafficTendency}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
