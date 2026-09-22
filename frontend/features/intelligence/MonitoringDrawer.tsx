'use client';

import React, { useEffect, useState } from 'react';
import { useAgentStore } from '@/stores/useAgentStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { agentService } from '@/services/agentService';
import { BellIcon, TrashIcon, CloseIcon } from '@/components/common/Icons';

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
          backgroundColor: 'var(--bg-panel, #101620)',
          borderLeft: '1px solid var(--border-subtle, #1B2531)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BellIcon size={20} color="var(--accent-primary)" />
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

        {/* Drawer Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '22px', backgroundColor: 'var(--bg-panel, #101620)' }}>
          {/* Add Monitor Section */}
          <div
            style={{
              backgroundColor: 'var(--bg-card, #111821)',
              border: '1px solid var(--border-subtle, #1B2531)',
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
                      backgroundColor: 'var(--bg-input, #0D141D)',
                      border: '1px solid var(--border, #263241)',
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
                      backgroundColor: 'var(--bg-card, #111821)',
                      border: '1px solid var(--border-subtle, #1B2531)',
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
                        color: '#F87171',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Remove Monitor"
                    >
                      <TrashIcon size={14} color="#F87171" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alert Center Feed with Lifecycle Controls */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Alert Center & Lifecycle ({monitorAlerts.length})
            </div>

            {monitorAlerts.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No active corridor threshold alerts triggered recently.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {monitorAlerts.map((alert) => {
                  const status = (alert as any).status || 'ACTIVE';
                  const isAck = status === 'ACKNOWLEDGED';
                  const isRes = status === 'RESOLVED';

                  return (
                    <div
                      key={alert.id}
                      style={{
                        backgroundColor: isRes ? 'var(--bg-elevated, #141B26)' : 'var(--bg-card, #111821)',
                        border: isRes ? '1px solid var(--border-subtle, #1B2531)' : isAck ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(245, 158, 11, 0.35)',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        opacity: isRes ? 0.7 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '12px', color: isRes ? 'var(--text-muted)' : isAck ? '#60A5FA' : '#FBBF24' }}>
                            {alert.trigger || (alert as any).signal || 'Threshold Exceeded'}
                          </span>
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: isRes ? 'var(--bg-card, #111821)' : isAck ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: isRes ? 'var(--text-muted)' : isAck ? '#60A5FA' : '#FBBF24',
                            }}
                          >
                            {status}
                          </span>
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {new Date(alert.triggeredAt || (alert as any).timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{alert.locationName}</strong>: {alert.currentState || (alert as any).description || 'Alert condition met'}
                      </div>

                      {/* Lifecycle Action Buttons */}
                      {!isRes && (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {!isAck && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await agentService.updateAlertStatus(alert.id, 'ACKNOWLEDGED');
                                  await fetchMonitorAlerts();
                                } catch (e) {
                                  console.warn('Failed to acknowledge alert:', e);
                                }
                              }}
                              style={{
                                padding: '3px 8px',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                borderRadius: '4px',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                color: '#60A5FA',
                                cursor: 'pointer',
                              }}
                            >
                              Acknowledge
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await agentService.updateAlertStatus(alert.id, 'RESOLVED');
                                await fetchMonitorAlerts();
                              } catch (e) {
                                console.warn('Failed to resolve alert:', e);
                              }
                            }}
                            style={{
                              padding: '3px 8px',
                              fontSize: '10.5px',
                              fontWeight: 600,
                              borderRadius: '4px',
                              border: '1px solid var(--border, #263241)',
                              backgroundColor: 'var(--bg-elevated, #141B26)',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            Mark Resolved
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
