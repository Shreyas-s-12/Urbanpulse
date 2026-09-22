'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useLocationStore } from '@/stores/useLocationStore';
import { useNearbyEvents } from '@/hooks/useNearbyEvents';
import { copilotService } from '@/services/copilotService';
import { CopilotMessage } from '@shared/types';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { PinIcon } from '@/components/common/Icons';
import VoiceControl from '@/features/multimodal/voice/VoiceControl';
import { useLanguage } from '@/context/LanguageContext';

const NexusHoloOrb = dynamic(() => import('@/components/3d/NexusHoloOrb'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'radial-gradient(circle, #3B82F6 0%, #1D4ED8 100%)',
        opacity: 0.8,
      }}
    />
  ),
});

export default function CopilotView() {
  const { t } = useLanguage();
  const { currentLocation, selectedRadiusKm } = useLocationStore();

  const centerLat = currentLocation ? currentLocation.latitude : null;
  const centerLon = currentLocation ? currentLocation.longitude : null;
  const cityName = currentLocation?.city || (currentLocation ? 'Coordinates Selected' : 'Current Location');

  const { events } = useNearbyEvents(centerLat, centerLon, selectedRadiusKm);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'NEXUS-INIT',
      sender: 'copilot',
      content: `Hello. I am **UrbanPulse Nexus**, your real-time spatial and civic intelligence layer for **${cityName}** (${selectedRadiusKm} km radius). I synthesize live sensor telemetry, 24-hour incident history, traffic disruption corridors, and municipal safety guidance. How can I assist your situational awareness today?`,
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

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
      console.warn('[Nexus] Failed to query intelligence:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ErrorBoundary fallbackTitle="UrbanPulse Nexus Unavailable">
      <div
        style={{
          flex: 1,
          height: '100%',
          backgroundColor: 'var(--bg-app)',
          backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(37, 99, 235, 0.05) 0%, transparent 80%)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '12px',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* Responsive Centered Chat Shell */}
        <div
          className="chat-shell"
          style={{
            width: 'clamp(360px, 90vw, 640px)',
            height: '100%',
            maxHeight: 'calc(100vh - 80px)',
            backgroundColor: 'var(--bg-panel)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Header */}
          <div
            style={{
              height: '60px',
              padding: '0 var(--space-4)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-header)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <NexusHoloOrb size={34} />
              <div>
                <h1 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                  UrbanPulse Nexus
                </h1>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1 }}>
                  Spatial Intelligence & Decision Layer
                </p>
              </div>
            </div>

            <span
              style={{
                fontSize: '11.5px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--badge-info-bg)',
                color: 'var(--badge-info-text)',
                border: '1px solid var(--badge-info-border)',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                maxWidth: '180px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={cityName}
            >
              <PinIcon size={12} color="currentColor" />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cityName}</span>
            </span>
          </div>

          {/* Messages Scroll Area */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              padding: '16px',
              overflowY: 'auto',
              backgroundColor: 'var(--conversation-bg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxSizing: 'border-box',
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
                    gap: '4px',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      maxWidth: isUser ? '88%' : '100%',
                      width: isUser ? 'fit-content' : '100%',
                      backgroundColor: isUser ? 'var(--button)' : 'var(--assistant-card-bg)',
                      color: isUser ? 'var(--button-foreground)' : 'var(--text-primary)',
                      padding: isUser ? '10px 14px' : '12px 14px',
                      borderRadius: isUser ? '14px 14px 4px 14px' : '12px',
                      fontSize: '13px',
                      lineHeight: 1.45,
                      border: isUser ? 'none' : '1px solid var(--assistant-card-border)',
                      boxShadow: isUser ? 'none' : 'var(--card-shadow)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <MarkdownRenderer content={msg.content} isUser={isUser} />

                    {/* Citations List */}
                    {msg.citedLiveSignals && msg.citedLiveSignals.length > 0 && (
                      <div
                        style={{
                          marginTop: '10px',
                          paddingTop: '8px',
                          borderTop: isUser ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: isUser ? 'var(--button-foreground)' : 'var(--text-muted)' }}>
                          PROVENANCE:
                        </span>
                        {msg.citedLiveSignals.map((cite, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: '11px',
                              color: isUser ? 'var(--button-foreground)' : 'var(--text-secondary)',
                              display: 'flex',
                              gap: '6px',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: isUser ? 'var(--button-foreground)' : 'var(--accent-primary)' }} />
                            <span><strong>[{cite.type}]</strong> {cite.detail} ({cite.source})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Suggested Action Chips */}
                  {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {msg.suggestedActions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(action)}
                          style={{
                            fontSize: '11.5px',
                            height: '32px',
                            padding: '0 12px',
                            borderRadius: '16px',
                            backgroundColor: 'var(--assistant-card-bg)',
                            border: '1px solid var(--assistant-card-border)',
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent-primary)';
                            e.currentTarget.style.backgroundColor = 'var(--accent-primary-light)';
                            e.currentTarget.style.color = 'var(--accent-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--assistant-card-border)';
                            e.currentTarget.style.backgroundColor = 'var(--assistant-card-bg)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
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
            <div ref={messagesEndRef} />
          </div>

          {/* Fixed Bottom Input Composer */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border)',
              backgroundColor: 'var(--bg-panel)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            <input
              type="text"
              placeholder={t('nexus.placeholder', 'Ask about traffic, weather, air quality, or a city...')}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend(inputQuery);
              }}
              style={{
                flex: 1,
                height: '46px',
                padding: '0 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--input-border)',
                backgroundColor: 'var(--bg-input)',
                fontSize: '13.5px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'all 0.15s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.boxShadow = 'var(--focus-ring)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--input-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <VoiceControl
              onTranscript={(text) => setInputQuery(text)}
              onSendQuery={(text) => handleSend(text)}
              disabled={isSending}
            />
            <button
              onClick={() => handleSend(inputQuery)}
              disabled={isSending || !inputQuery.trim()}
              style={{
                height: '46px',
                padding: '0 20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isSending || !inputQuery.trim() ? 'var(--text-disabled)' : 'var(--button)',
                color: 'var(--button-foreground)',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: isSending || !inputQuery.trim() ? 'not-allowed' : 'pointer',
                border: 'none',
                transition: 'background-color 0.15s ease',
                flexShrink: 0,
              }}
            >
              {isSending ? t('nexus.thinking', 'Thinking...') : t('nexus.send', 'Send')}
            </button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
