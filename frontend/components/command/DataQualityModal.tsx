'use client';

import React, { useState, useEffect } from 'react';
import { ProviderHealthItem, DataQualityDomain } from '@/types/command';
import { commandService } from '@/services/commandService';

interface DataQualityModalProps {
  latitude: number;
  longitude: number;
  onClose: () => void;
}

export default function DataQualityModal({ latitude, longitude, onClose }: DataQualityModalProps) {
  const [providers, setProviders] = useState<ProviderHealthItem[]>([]);
  const [domains, setDomains] = useState<DataQualityDomain[]>([]);
  const [observability, setObservability] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [provRes, qualRes, obsRes] = await Promise.all([
          commandService.getProviderHealth(),
          commandService.getDataQuality(latitude, longitude),
          commandService.getObservability(),
        ]);
        setProviders(provRes.providers || []);
        setDomains(qualRes.domains || []);
        setObservability(obsRes);
      } catch (err) {
        console.error('Failed to load quality metrics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [latitude, longitude]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          width: '780px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F9FAFB',
          }}
        >
          <div>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>
              SYSTEM OBSERVABILITY & DATA INTEGRITY
            </span>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '2px 0 0 0' }}>
              Provider Health & Domain Quality Center
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6B7280' }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>
            Polling upstream provider telemetry…
          </div>
        ) : (
          <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Observability Stats */}
            {observability && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>REQUEST COUNT</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                    {observability.telemetry.requestCount}
                  </div>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>CACHE HIT RATE</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#16A34A' }}>
                    {observability.telemetry.cacheHitRatePercent}%
                  </div>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>AVG LATENCY</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0284C7' }}>
                    {observability.telemetry.averageLatencyMs} ms
                  </div>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>ERROR RATE</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                    {observability.telemetry.errorRatePercent}%
                  </div>
                </div>
              </div>
            )}

            {/* Upstream Providers Table */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase' }}>
                UPSTREAM PROVIDER TELEMETRY STATUS
              </span>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E5E7EB', textAlign: 'left', color: '#6B7280' }}>
                    <th style={{ padding: '6px 8px' }}>Provider</th>
                    <th style={{ padding: '6px 8px' }}>Category</th>
                    <th style={{ padding: '6px 8px' }}>Status</th>
                    <th style={{ padding: '6px 8px' }}>Latency</th>
                    <th style={{ padding: '6px 8px' }}>Freshness</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '8px', fontWeight: 600, color: '#111827' }}>{p.name}</td>
                      <td style={{ padding: '8px', color: '#6B7280', fontSize: '11px' }}>{p.category}</td>
                      <td style={{ padding: '8px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: p.status === 'HEALTHY' ? '#DEF7EC' : '#FDE8E8',
                            color: p.status === 'HEALTHY' ? '#03543F' : '#9B1C1C',
                          }}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px', color: '#374151' }}>{p.latencyMs} ms</td>
                      <td style={{ padding: '8px', color: '#6B7280' }}>{p.freshnessMinutes}m ago</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Domain Quality Table */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase' }}>
                DOMAIN COVERAGE & CONFIDENCE INDICES
              </span>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E5E7EB', textAlign: 'left', color: '#6B7280' }}>
                    <th style={{ padding: '6px 8px' }}>Domain</th>
                    <th style={{ padding: '6px 8px' }}>Coverage</th>
                    <th style={{ padding: '6px 8px' }}>Confidence</th>
                    <th style={{ padding: '6px 8px' }}>Provider</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((d, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '8px', fontWeight: 600, color: '#111827' }}>{d.domain}</td>
                      <td style={{ padding: '8px', color: '#16A34A', fontWeight: 700 }}>{d.coveragePercent}%</td>
                      <td style={{ padding: '8px', color: '#2563EB', fontWeight: 700 }}>
                        {Math.round(d.confidence * 100)}%
                      </td>
                      <td style={{ padding: '8px', color: '#6B7280', fontSize: '11px' }}>{d.provider}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
