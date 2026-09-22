'use client';

import React, { useState } from 'react';
import EvidenceCitationCard, { EvidenceCitation } from './EvidenceCitationCard';

interface RAGQueryInterfaceProps {
  module: 'georag' | 'crisisrag' | 'aquarag';
  suggestedQueries: string[];
  latitude: number;
  longitude: number;
  locationName: string;
  cityName: string;
}

export default function RAGQueryInterface({
  module,
  suggestedQueries,
  latitude,
  longitude,
  locationName,
  cityName,
}: RAGQueryInterfaceProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<{
    answer: string;
    evidence: EvidenceCitation[];
    confidence: number;
    temporalClassification?: string;
    limitations?: string;
  } | null>(null);

  const handleSearch = async (queryText?: string) => {
    const activeQuery = queryText || query;
    if (!activeQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${baseUrl}/api/v1/${module}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: activeQuery,
          latitude,
          longitude,
          locationName,
          cityName,
        }),
      });

      if (!res.ok) {
        throw new Error(`Query returned status ${res.status}`);
      }

      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve domain intelligence');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        padding: '20px',
        boxShadow: 'var(--card-shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Grounded Inquiry Engine
        </div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
          Ask Domain Intelligence
        </div>
      </div>

      {/* Suggested Query Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {suggestedQueries.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setQuery(q);
              handleSearch(q);
            }}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '6px 11px',
              fontSize: '11.5px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary-light)';
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.color = 'var(--accent-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        style={{ display: 'flex', gap: '8px' }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Enter an investigative inquiry for ${cityName}…`}
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--input-border)',
            fontSize: '13px',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: 'var(--button)',
            color: 'var(--button-foreground)',
            border: 'none',
            borderRadius: '6px',
            padding: '9px 18px',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 3px rgba(37, 99, 235, 0.3)',
          }}
        >
          {loading ? 'Retrieving Evidence…' : 'Investigate'}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div
          style={{
            backgroundColor: 'var(--badge-danger-bg)',
            border: '1px solid var(--badge-danger-border)',
            borderRadius: '6px',
            padding: '10px 14px',
            color: 'var(--badge-danger-text)',
            fontSize: '12px',
          }}
        >
          {error}
        </div>
      )}

      {/* Structured Result Display */}
      {response && (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            marginTop: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
              Synthesized Domain Analysis
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {response.temporalClassification && (
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--badge-neutral-bg)',
                    color: 'var(--badge-neutral-text)',
                    border: '1px solid var(--badge-neutral-border)',
                  }}
                >
                  {response.temporalClassification.replace(/_/g, ' ')}
                </span>
              )}
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                Confidence {Math.round(response.confidence * 100)}%
              </span>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.55 }}>
            {response.answer}
          </p>

          {/* Citations Grid */}
          {response.evidence && response.evidence.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Attributed Grounded Citations
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                {response.evidence.map((c, i) => (
                  <EvidenceCitationCard key={i} citation={c} />
                ))}
              </div>
            </div>
          )}

          {response.limitations && (
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontStyle: 'normal' }}>
              Limitation: {response.limitations}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
