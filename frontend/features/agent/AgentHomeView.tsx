'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAgentStore } from '@/stores/useAgentStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useNearbyEvents } from '@/hooks/useNearbyEvents';
import { locationService } from '@/services/locationService';
import GoogleMapView from '@/components/map/GoogleMapView';
import ForecastPanel from '@/features/forecast/ForecastPanel';
import LiveUpdatesDrawer from '@/features/updates/LiveUpdatesDrawer';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';

const SUGGESTED_PROMPTS = [
  '7-day forecast for Tokyo',
  '30-day outlook for London',
  'Live updates in San Francisco',
  'Current traffic in Mysore',
  'Weather in New York',
  'Air quality in Delhi',
  'Overall rating for Bangalore',
  'Compare air quality in Delhi and Mumbai',
];

export default function AgentHomeView() {
  const {
    messages,
    activeLocation,
    activeLayers,
    aqiOverlayData,
    toolActivities,
    isProcessing,
    mapCenter,
    mapZoom,
    sendMessage,
    setActiveLocation,
    setLayer,
  } = useAgentStore();

  const { currentLocation, selectedRadiusKm } = useLocationStore();
  const [inputQuery, setInputQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const displayLoc = activeLocation || currentLocation;

  // Nearby events for the active agent location
  const { events } = useNearbyEvents(
    displayLoc?.latitude || null,
    displayLoc?.longitude || null,
    selectedRadiusKm
  );

  // Auto-scroll chat to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolActivities]);

  const handleSend = (text: string) => {
    if (!text.trim() || isProcessing) return;
    sendMessage(text);
    setInputQuery('');
  };

  const handleMapClick = async (coords: { latitude: number; longitude: number }) => {
    try {
      const resolved = await locationService.reverseGeocode(coords.latitude, coords.longitude);
      setActiveLocation(resolved);
      sendMessage(`What's the status around ${resolved.city || resolved.displayName}?`);
    } catch (e) {
      console.warn('Map click reverse geocode error:', e);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--bg-app)',
        overflow: 'hidden',
      }}
    >
      {/* LEFT PANEL: Conversational Agent Console */}
      <div
        style={{
          width: '460px',
          minWidth: '380px',
          maxWidth: '520px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 20,
        }}
      >
        {/* Agent Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#13B887',
                boxShadow: '0 0 10px #13B887',
              }}
            />
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                UrbanPulse Agent
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Conversational Location Intelligence
              </span>
            </div>
          </div>

          {displayLoc && (
            <span
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-primary-light)',
                color: 'var(--accent-primary)',
                fontWeight: 700,
                maxWidth: '160px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={displayLoc.displayName}
            >
              📍 {displayLoc.city || displayLoc.displayName}
            </span>
          )}
        </div>

        {/* Chat History & Stream Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                margin: 'auto 0',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                padding: '20px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(19, 184, 135, 0.1)',
                  color: '#13B887',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Ask anything about any city on Earth. UrbanPulse analyzes live conditions and moves the map to show real traffic, weather, or air quality.
              </p>

              {/* Suggested Prompts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  TRY ASKING:
                </span>
                {SUGGESTED_PROMPTS.slice(0, 4).map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt)}
                    style={{
                      padding: '10px 14px',
                      fontSize: '12px',
                      fontWeight: 500,
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.backgroundColor = 'var(--accent-primary-light)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-app)';
                    }}
                  >
                    💬 {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Render Message List */}
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    maxWidth: '92%',
                    backgroundColor: isUser ? 'var(--accent-blue)' : 'var(--bg-surface)',
                    color: isUser ? '#FFFFFF' : 'var(--text-primary)',
                    padding: '14px 18px',
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    fontSize: '13px',
                    lineHeight: 1.55,
                    border: isUser ? 'none' : '1px solid var(--border-subtle)',
                    boxShadow: isUser ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
                  }}
                >
                  <MarkdownRenderer content={msg.content} isUser={isUser} />

                  {/* Sources Provenance */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div
                      style={{
                        marginTop: '12px',
                        paddingTop: '10px',
                        borderTop: isUser ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: isUser ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        VERIFIED SOURCES & FRESHNESS:
                      </span>
                      {msg.sources.map((src, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: isUser ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)',
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: src.freshness === 'LIVE' ? '#10B981' : '#F59E0B',
                              flexShrink: 0,
                            }}
                          />
                          <span>
                            <strong style={{ color: isUser ? '#FFFFFF' : 'var(--text-primary)' }}>{src.type}</strong>: {src.detail} ({src.source})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Activity Progress (Compact Non-Distracting Pills) */}
          {toolActivities.length > 0 && isProcessing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              {toolActivities.slice(-3).map((act, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    alignSelf: 'flex-start',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: act.status === 'IN_PROGRESS' ? 'var(--accent-blue)' : '#10B981',
                      animation: act.status === 'IN_PROGRESS' ? 'pulse 1.2s infinite' : 'none',
                    }}
                  />
                  <span>{act.step}</span>
                  {act.detail && <span style={{ color: 'var(--text-muted)' }}>• {act.detail}</span>}
                </div>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Suggested Prompt Chips */}
        {messages.length > 0 && (
          <div
            style={{
              padding: '8px 16px',
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                disabled={isProcessing}
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            gap: '10px',
          }}
        >
          <input
            type="text"
            placeholder="Ask about traffic, weather, air quality, or a city..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend(inputQuery);
            }}
            disabled={isProcessing}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-app)',
              fontSize: '13px',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <button
            onClick={() => handleSend(inputQuery)}
            disabled={isProcessing || !inputQuery.trim()}
            style={{
              padding: '0 20px',
              borderRadius: '8px',
              backgroundColor: isProcessing ? 'var(--text-muted)' : '#13B887',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            {isProcessing ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </div>

      {/* RIGHT PANEL: Real Google Maps Engine */}
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <GoogleMapView
          center={
            mapCenter
              ? {
                  latitude: mapCenter.lat,
                  longitude: mapCenter.lng,
                  city: displayLoc?.city || null,
                  country: displayLoc?.country || null,
                  displayName: displayLoc?.displayName || '',
                  isUserLocation: false,
                }
              : displayLoc
          }
          radiusKm={selectedRadiusKm}
          events={activeLayers.events ? events : []}
          layers={{
            traffic: activeLayers.traffic,
            aqi: activeLayers.aqi,
            boundary: activeLayers.boundary,
          }}
          trafficEnabled={activeLayers.traffic}
          aqiEnabled={activeLayers.aqi}
          aqiData={aqiOverlayData}
          zoomOverride={mapZoom}
          onMapClick={handleMapClick}
          height="100%"
        />

        {/* Floating Layer Indicator Bar on Top-Right */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            backgroundColor: 'rgba(17, 22, 27, 0.9)',
            backdropFilter: 'blur(8px)',
            borderRadius: '8px',
            padding: '8px 14px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontSize: '12px',
            color: '#FFFFFF',
            zIndex: 30,
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={activeLayers.traffic}
              onChange={(e) => setLayer('traffic', e.target.checked)}
            />
            <span>Traffic</span>
            {activeLayers.traffic && (
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#10B981', backgroundColor: 'rgba(16,185,129,0.2)', padding: '2px 5px', borderRadius: '4px' }}>
                LIVE
              </span>
            )}
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={activeLayers.aqi}
              onChange={(e) => setLayer('aqi', e.target.checked)}
            />
            <span>AQI Layer</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={activeLayers.events}
              onChange={(e) => setLayer('events', e.target.checked)}
            />
            <span>Events ({events.length})</span>
          </label>
        </div>

        {/* Active AQI Legend if AQI layer enabled */}
        {activeLayers.aqi && aqiOverlayData && (
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              right: '24px',
              backgroundColor: 'rgba(17, 22, 27, 0.92)',
              backdropFilter: 'blur(8px)',
              borderRadius: '8px',
              padding: '12px 16px',
              border: '1px solid var(--border-subtle)',
              color: '#FFFFFF',
              zIndex: 30,
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              AQI SCALE: {aqiOverlayData.scale}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800 }}>
              <span>Value: {aqiOverlayData.value}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#10B981' }}>({aqiOverlayData.category})</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Source: {aqiOverlayData.source}
            </div>
          </div>
        )}

        {/* Multi-Pillar Forecasting Drawer */}
        <ForecastPanel />

        {/* Live Updates & Civic RAG Drawer */}
        <LiveUpdatesDrawer />
      </div>
    </div>
  );
}
