'use client';

import React, { useEffect, useState } from 'react';
import { useAgentStore } from '@/stores/useAgentStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { agentService } from '@/services/agentService';

export default function MonitoringDrawer() {
  const {
    showMonitoringDrawer,
    setShowMonitoringDrawer,
    activeMonitors,
    monitorAlerts,
    fetchMonitors,
    fetchMonitorAlerts,
  } = useAgentStore();

  const { currentLocation } = useLocationStore();
  const [isCreating, setIsCreating] = useState(false);
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (showMonitoringDrawer) {
      fetchMonitors();
      fetchMonitorAlerts();
    }
  }, [showMonitoringDrawer, fetchMonitors, fetchMonitorAlerts]);

  if (!showMonitoringDrawer) return null;

  const handleCreateMonitor = async () => {
    if (!currentLocation) return;
    setIsCreating(true);
    try {
      const name = customName.trim() || currentLocation.city || currentLocation.displayName || 'Current Corridor';
      const locToMonitor = { ...currentLocation, displayName: name };
      await agentService.createMonitor({
        location: locToMonitor,
        radiusKm: 25.0,
        signals: ['traffic', 'aqi', 'hazards'],
        active: true,
      });
      setCustomName('');
      await fetchMonitors();
    } catch (err) {
      console.error('Failed to create monitor:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteMonitor = async (id: string) => {
    try {
      await agentService.deleteMonitor(id);
      await fetchMonitors();
    } catch (err) {
      console.error('Failed to delete monitor:', err);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(17, 24, 39, 0.4)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={() => setShowMonitoringDrawer(false)}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          height: '100%',
          backgroundColor: '#FFFFFF',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-panel)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🔔</span>
            <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Corridor & Location Monitoring
            </h2>
          </div>

          <button
            onClick={() => setShowMonitoringDrawer(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Drawer Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '22px', backgroundColor: '#FFFFFF' }}>
          {/* Add Monitor Section */}
          <div
            style={{
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '14px',
              padding: '16px',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '8px' }}>
              + Monitor Active Location
            </div>

            {currentLocation ? (
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Target: <strong>{currentLocation.city || currentLocation.displayName}</strong>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Custom monitor name (optional)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    style={{
                      flex: 1,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleCreateMonitor}
                    disabled={isCreating}
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: isCreating ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: 'var(--shadow-xs)',
                    }}
                  >
                    {isCreating ? 'Adding...' : 'Add Watch'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Select a location on the map or search a city to create a monitoring subscription.
              </div>
            )}
          </div>

          {/* Active Subscriptions */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Active Monitored Locations ({activeMonitors.length})
            </div>

            {activeMonitors.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No active corridor monitors configured.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeMonitors.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {(m as any).name || m.location?.displayName || m.location?.city || 'Monitored Location'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Radius: {m.radiusKm}km · Signals: {(m.signals || (m as any).alertOn || []).join(', ')}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteMonitor(m.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#DC2626',
                        cursor: 'pointer',
                        fontSize: '14px',
                        padding: '4px',
                      }}
                      title="Remove Monitor"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Non-Intrusive Alerts Feed */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Recent Notification Alerts ({monitorAlerts.length})
            </div>

            {monitorAlerts.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No active threshold alerts triggered recently.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {monitorAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '12px', color: '#D97706' }}>
                        {alert.trigger || (alert as any).signal || 'Threshold Exceeded'}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {new Date(alert.triggeredAt || (alert as any).timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{alert.locationName}</strong>: {alert.currentState || (alert as any).description || 'Alert condition met'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
