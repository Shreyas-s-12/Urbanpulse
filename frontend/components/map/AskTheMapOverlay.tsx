'use client';

import React from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { locationService } from '@/services/locationService';

const QUICK_ACTIONS = [
  { label: 'Traffic Around Here', query: 'Traffic around here', icon: '🚦' },
  { label: 'Weather At This Point', query: 'Weather at this point', icon: '🌤️' },
  { label: 'Air Quality', query: 'Air quality at this point', icon: '🍃' },
  { label: 'Nearby Hazards', query: 'Any hazards nearby?', icon: '⚠️' },
  { label: 'Civil Safety', query: 'Is this area safe?', icon: '🛡️' },
  { label: 'Road Conditions', query: 'Road conditions', icon: '🛣️' },
  { label: 'UrbanPulse Score', query: 'What is the UrbanPulse score here?', icon: '💯' },
  { label: '7-Day Forecast', query: '7-day forecast for this location', icon: '🔮' },
  { label: 'What Changed?', query: 'What changed here in the last 24h?', icon: '📈' },
  { label: 'Detect Anomalies', query: 'Are there any anomalies here?', icon: '⚡' },
];

export default function AskTheMapOverlay() {
  const { selectedMapPoint, setSelectedMapPoint } = useLocationStore();
  const { sendMessage, setActiveLocation } = useAgentStore();

  if (!selectedMapPoint) return null;

  const handleAction = async (promptQuery: string) => {
    try {
      const resolved = await locationService.reverseGeocode(
        selectedMapPoint.latitude,
        selectedMapPoint.longitude
      );
      setActiveLocation(resolved);
      const placeName = resolved.city || resolved.displayName || `${selectedMapPoint.latitude.toFixed(3)}, ${selectedMapPoint.longitude.toFixed(3)}`;
      sendMessage(`${promptQuery} in ${placeName}`);
    } catch {
      sendMessage(`${promptQuery} at coordinates (${selectedMapPoint.latitude.toFixed(4)}, ${selectedMapPoint.longitude.toFixed(4)})`);
    }
    setSelectedMapPoint(null);
  };

  const pointLabel =
    selectedMapPoint.label ||
    `${selectedMapPoint.latitude.toFixed(4)}°, ${selectedMapPoint.longitude.toFixed(4)}°`;

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-panel)',
        padding: '16px 20px',
        width: '92%',
        maxWidth: '640px',
        color: 'var(--text-primary)',
        animation: 'fadeInDown 0.2s ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📍</span>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Ask-The-Map Location Context
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {pointLabel}
            </div>
          </div>
        </div>

        <button
          onClick={() => setSelectedMapPoint(null)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '4px 8px',
            borderRadius: '6px',
          }}
          title="Dismiss"
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
        Select a real-time intelligence inquiry or type a query in the agent console:
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        {QUICK_ACTIONS.map((action, idx) => (
          <button
            key={idx}
            onClick={() => handleAction(action.query)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '20px',
              padding: '6px 12px',
              fontSize: '12px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary-light)';
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.color = 'var(--accent-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-app)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
