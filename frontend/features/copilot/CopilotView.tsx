'use client';

import React, { useState } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { useNearbyEvents } from '@/hooks/useNearbyEvents';
import { copilotService } from '@/services/copilotService';
import { CopilotMessage } from '@shared/types';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';

export default function CopilotView() {
  const { currentLocation, selectedRadiusKm } = useLocationStore();

  const centerLat = currentLocation ? currentLocation.latitude : null;
  const centerLon = currentLocation ? currentLocation.longitude : null;
  const cityName = currentLocation?.city || (currentLocation ? 'Coordinates Selected' : 'Current Location');

  const { events } = useNearbyEvents(centerLat, centerLon, selectedRadiusKm);

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'COPILOT-INIT',
      sender: 'copilot',
      content: `Hello. I am **UrbanPulse Copilot**, your real-time spatial and civic intelligence partner for **${cityName}** (${selectedRadiusKm} km radius). I synthesize live sensor telemetry, 24-hour event trends, traffic hazard intersections, and municipal safety guidance. How can I assist your situational awareness today?`,
      timestamp: new Date().toISOString(),
      suggestedActions: [
        'What happened around me today?',
        'Why is my route slower?',
        'Are there any earthquakes nearby?',
        'Is there any flood or storm risk?',
      ],
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async (text: string) => {
    const q = text.trim();
    if (!q || isSending) return;

    const userMsg: CopilotMessage = {
      id: `USER-${Date.now()}`,
      sender: 'user',
      content: q,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsSending(true);

    try {
      const activeLoc = currentLocation || {
        latitude: centerLat || 0,
        longitude: centerLon || 0,
        city: cityName,
        country: null,
        displayName: cityName,
        isUserLocation: false,
      };

      const copilotReply = await copilotService.queryCopilot(
        q,
        activeLoc,
        events,
        selectedRadiusKm
      );

      setMessages((prev) => [...prev, copilotReply]);
    } catch (err) {
      console.warn('Failed to get copilot reply:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxWidth: '1020px',
        margin: '0 auto',
        width: '100%',
        padding: '24px',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', boxShadow: '0 0 8px #13B887' }} />
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
              UrbanPulse Copilot
            </h1>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Contextual reasoning over Live Signals • 24h Incident History • Route Corridors • Municipal Knowledge
          </p>
        </div>
        <span
          style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--accent-primary-light)',
            color: 'var(--accent-primary)',
            fontWeight: 700,
          }}
        >
          {cityName} • {selectedRadiusKm} km active radius
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
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
                  maxWidth: '82%',
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

                {/* Cited Live Signals */}
                {msg.citedLiveSignals && msg.citedLiveSignals.length > 0 && (
                  <div
                    style={{
                      marginTop: '12px',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      CITED LIVE SIGNALS & PROVENANCE:
                    </span>
                    {msg.citedLiveSignals.map((cite, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          gap: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />
                        <strong>[{cite.type}]</strong> via {cite.source}: {cite.detail}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Suggested Action Chips */}
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {msg.suggestedActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(action)}
                      style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--bg-app)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--accent-blue)',
                        fontWeight: 600,
                        transition: 'all 0.1s ease',
                      }}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Input Box */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          placeholder="Ask Copilot about route hazards, 24h events, weather, or earthquakes..."
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend(inputQuery);
          }}
          style={{
            flex: 1,
            padding: '12px 18px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            fontSize: '13px',
            color: 'var(--text-primary)',
            outline: 'none',
            boxShadow: 'var(--shadow-sm)',
          }}
        />
        <button
          onClick={() => handleSend(inputQuery)}
          style={{
            padding: '0 24px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--accent-primary)',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 700,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
