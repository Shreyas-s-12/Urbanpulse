'use client';

import React, { useState } from 'react';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';
import {
  NexusRankingResponse,
  NexusComparisonResponse,
  NexusConditionResponse,
  NexusExplanationResponse,
  NexusForecastResponse,
  NexusScenarioResponse,
} from '@/features/agent/responses';
import NexusLocationClarification from './NexusLocationClarification';
import { PinIcon, ChevronDownIcon } from '@/components/common/Icons';
import { useAgentStore, AgentChatMessage } from '@/stores/useAgentStore';

interface NexusAssistantMessageProps {
  msg: AgentChatMessage;
}

export default function NexusAssistantMessage({ msg }: NexusAssistantMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Detect location clarification pattern
  const isClarification =
    msg.intent === 'CLARIFICATION' ||
    msg.content?.toLowerCase().includes("couldn't identify the specific location") ||
    msg.content?.toLowerCase().includes('please name a city, address') ||
    msg.content?.toLowerCase().includes('location clarification');

  const hasSupportingData = Boolean(
    (msg.sources && msg.sources.length > 0) ||
    msg.confidence !== undefined ||
    msg.location
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        maxWidth: '100%',
        background: 'transparent',
        border: 'none',
        padding: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Location Clarification State */}
      {isClarification ? (
        <NexusLocationClarification content={msg.content} confidence={msg.confidence} />
      ) : /* 2. Structured Responses */
      msg.structuredResponse?.type === 'CURRENT_STATUS' ? (
        <NexusConditionResponse response={msg.structuredResponse} data={msg.data} />
      ) : msg.structuredResponse?.type === 'RANKING' ? (
        <NexusRankingResponse response={msg.structuredResponse} rawRanking={msg.data?.ranking} />
      ) : (msg.data?.ranking && !msg.structuredResponse) ? (
        <NexusRankingResponse
          response={{
            type: 'RANKING',
            title: `Top ${msg.data.ranking.results?.length || 10} ${msg.data.ranking.metric} in ${msg.data.ranking.scope}`,
            summary: msg.data.ranking.rankingMetric || '',
            results: msg.data.ranking.results,
            metadata: msg.data.ranking,
            sources: [{ name: msg.data.ranking.source }],
          }}
          rawRanking={msg.data.ranking}
        />
      ) : msg.structuredResponse?.type === 'COMPARISON' ? (
        <NexusComparisonResponse response={msg.structuredResponse} rawComparison={msg.data?.cityComparison || msg.data?.comparison} />
      ) : (msg.data?.cityComparison && !msg.structuredResponse) ? (
        <NexusComparisonResponse
          response={{
            type: 'COMPARISON',
            title: 'City Comparison',
            summary: msg.data.cityComparison.verdict || '',
            metadata: { cityComparison: msg.data.cityComparison },
            sources: [{ name: 'UrbanPulse Multi-City Engine' }],
          }}
          rawComparison={msg.data.cityComparison}
        />
      ) : msg.structuredResponse?.type === 'EXPLANATION' ? (
        <NexusExplanationResponse response={msg.structuredResponse} data={msg.data} />
      ) : msg.structuredResponse?.type === 'FORECAST' ? (
        <NexusForecastResponse response={msg.structuredResponse} data={msg.data} />
      ) : msg.structuredResponse?.type === 'SCENARIO' ? (
        <NexusScenarioResponse response={msg.structuredResponse} data={msg.data} />
      ) : (
        /* 3. Conversational Markdown Response Card */
        <div
          style={{
            width: '100%',
            backgroundColor: 'var(--assistant-card-bg, #FFFFFF)',
            border: '1px solid var(--assistant-card-border, #E2E7EF)',
            borderRadius: '12px',
            padding: '12px 14px',
            fontSize: '13px',
            lineHeight: 1.45,
            color: 'var(--text-primary, #172033)',
            boxShadow: 'var(--card-shadow, 0 2px 8px rgba(15, 23, 42, 0.05))',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <MarkdownRenderer content={msg.content} isUser={false} />

          {/* Compact Source / Confidence Row with Know More */}
          {hasSupportingData && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '10.5px',
                color: 'var(--text-muted, #7B8798)',
                paddingTop: '6px',
                borderTop: '1px solid var(--border-subtle, #EDF0F4)',
                marginTop: '4px',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {msg.sources && msg.sources.length > 0 && (
                  <span>
                    Source: <strong style={{ color: 'var(--text-secondary, #566174)' }}>{msg.sources[0]?.source || 'Verified Provider'}</strong>
                  </span>
                )}
                {msg.sources && msg.sources.length > 0 && msg.confidence !== undefined && <span>•</span>}
                {msg.confidence !== undefined && (
                  <span>
                    Confidence: <strong style={{ color: 'var(--text-secondary, #566174)' }}>{Math.round(msg.confidence * 100)}%</strong>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: 'var(--accent-primary, #2563EB)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                <span>{isExpanded ? 'Hide' : 'Know more'}</span>
                <ChevronDownIcon
                  size={10}
                  style={{
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                  }}
                />
              </button>
            </div>
          )}

          {/* Expanded Provenance / Coordinates Panel */}
          {hasSupportingData && isExpanded && (
            <div
              style={{
                marginTop: '4px',
                padding: '8px 10px',
                borderRadius: '6px',
                backgroundColor: 'var(--nested-metric-bg, #F8FAFC)',
                border: '1px solid var(--nested-metric-border, #E8EDF3)',
                fontSize: '11px',
                color: 'var(--text-secondary, #566174)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                animation: 'fadeIn 0.15s ease-out',
              }}
            >
              {msg.sources && msg.sources.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted, #7B8798)', textTransform: 'uppercase' }}>
                    VERIFIED SOURCES:
                  </span>
                  {msg.sources.map((src, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                      <span>{src.type || 'Source'}: {src.detail || src.source}</span>
                    </div>
                  ))}
                </div>
              )}

              {msg.location && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                    <PinIcon size={11} color="var(--accent-primary, #2563EB)" />
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {msg.location.name || msg.location.city || msg.location.displayName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (msg.location?.latitude && msg.location?.longitude) {
                        const locName = msg.location.displayName || msg.location.name || msg.location.city || 'Selected Location';
                        useAgentStore.getState().setActiveLocation({
                          displayName: locName,
                          name: locName,
                          city: msg.location.city || locName,
                          state: msg.location.state || '',
                          country: msg.location.country || '',
                          latitude: msg.location.latitude,
                          longitude: msg.location.longitude,
                          isUserLocation: false,
                          source: 'SEARCH',
                        });
                      }
                    }}
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--accent-primary, #2563EB)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--weather-summary-bg, #EFF6FF)',
                      border: '1px solid var(--weather-summary-border, #BFDBFE)',
                      cursor: 'pointer',
                    }}
                  >
                    Focus Map
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
