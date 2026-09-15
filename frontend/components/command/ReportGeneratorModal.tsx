'use client';

import React, { useState, useEffect } from 'react';
import { ReportResponse } from '@/types/command';
import { commandService } from '@/services/commandService';

interface ReportGeneratorModalProps {
  latitude: number;
  longitude: number;
  cityName?: string;
  onClose: () => void;
}

export default function ReportGeneratorModal({
  latitude,
  longitude,
  cityName,
  onClose,
}: ReportGeneratorModalProps) {
  const [mode, setMode] = useState<'EXECUTIVE' | 'TECHNICAL'>('EXECUTIVE');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportResponse | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const res = await commandService.generateReport(
          latitude,
          longitude,
          30.0,
          cityName,
          mode
        );
        setReport(res);
      } catch (err) {
        console.error('Failed to generate report:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [latitude, longitude, cityName, mode]);

  const handleDownloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.reportId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
          width: '740px',
          maxHeight: '90vh',
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
              INTELLIGENCE REPORT GENERATOR
            </span>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '2px 0 0 0' }}>
              Situational Dossier — {cityName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6B7280' }}
          >
            ✕
          </button>
        </div>

        {/* Mode Selector & Action Bar */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setMode('EXECUTIVE')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                border: mode === 'EXECUTIVE' ? '1px solid #2563EB' : '1px solid #D1D5DB',
                backgroundColor: mode === 'EXECUTIVE' ? '#EFF6FF' : '#FFFFFF',
                color: mode === 'EXECUTIVE' ? '#1D4ED8' : '#4B5563',
              }}
            >
              Executive View
            </button>
            <button
              onClick={() => setMode('TECHNICAL')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                border: mode === 'TECHNICAL' ? '1px solid #2563EB' : '1px solid #D1D5DB',
                backgroundColor: mode === 'TECHNICAL' ? '#EFF6FF' : '#FFFFFF',
                color: mode === 'TECHNICAL' ? '#1D4ED8' : '#4B5563',
              }}
            >
              Technical View
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleDownloadJson}
              disabled={!report}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Export JSON
            </button>
            <button
              onClick={() => window.print()}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                color: '#374151',
                fontSize: '11px',
                fontWeight: 600,
                border: '1px solid #D1D5DB',
                cursor: 'pointer',
              }}
            >
              Print
            </button>
          </div>
        </div>

        {/* Report Content Body */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>
            Synthesizing intelligence report…
          </div>
        ) : report ? (
          <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Executive Summary */}
            <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                EXECUTIVE SUMMARY
              </span>
              <p style={{ fontSize: '13px', color: '#1E293B', lineHeight: '1.5', margin: '6px 0 0 0' }}>
                {report.executiveSummary}
              </p>
            </div>

            {/* Score & Status */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, padding: '12px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                <span style={{ fontSize: '10px', color: '#6B7280', fontWeight: 700 }}>OVERALL STATUS</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827', marginTop: '2px' }}>
                  {report.overallStatus}
                </div>
              </div>
              <div style={{ flex: 1, padding: '12px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                <span style={{ fontSize: '10px', color: '#6B7280', fontWeight: 700 }}>COMPOSITE SCORE</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#2563EB', marginTop: '2px' }}>
                  {report.compositeScore} / 100
                </div>
              </div>
              <div style={{ flex: 1, padding: '12px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                <span style={{ fontSize: '10px', color: '#6B7280', fontWeight: 700 }}>DATA CONFIDENCE</span>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#16A34A', marginTop: '2px' }}>
                  {Math.round(report.confidence * 100)}%
                </div>
              </div>
            </div>

            {/* Key Operational Recommendations */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase' }}>
                OPERATIONAL RECOMMENDATIONS
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {report.recommendations.map((r, idx) => (
                  <div key={idx} style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>{r.action}</span>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: r.priority === 'HIGH' ? '#FEE2E2' : '#EFF6FF',
                          color: r.priority === 'HIGH' ? '#991B1B' : '#1E40AF',
                        }}
                      >
                        {r.priority}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#4B5563', margin: '4px 0 0 0' }}>{r.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Lineage (if TECHNICAL mode) */}
            {mode === 'TECHNICAL' && report.technicalLineage && (
              <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                  TECHNICAL DATA LINEAGE & NORMALIZATION
                </span>
                <pre style={{ fontSize: '11px', color: '#0F172A', marginTop: '6px', overflowX: 'auto' }}>
                  {JSON.stringify(report.technicalLineage, null, 2)}
                </pre>
              </div>
            )}

            {/* Sources */}
            <div style={{ fontSize: '10px', color: '#9CA3AF' }}>
              <strong>Attributed Data Sources:</strong> {report.sources.join(' • ')}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
