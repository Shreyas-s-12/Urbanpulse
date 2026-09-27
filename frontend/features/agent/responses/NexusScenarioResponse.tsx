'use client';

import React from 'react';
import { NexusStructuredResponse } from '@shared/types';

interface NexusScenarioResponseProps {
  response: NexusStructuredResponse;
  data?: any;
}

const BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'HISTORICAL EVIDENCE': { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  'MODEL-DERIVED PREDICTION': { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  'CURRENT OBSERVATION': { bg: '#DCFCE7', text: '#166534', border: '#86EFAC' },
  'ASSUMPTION': { bg: '#F3E8FF', text: '#6B21A8', border: '#D8B4FE' },
  'INSUFFICIENT DATA': { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB' },
};

export const NexusScenarioResponse: React.FC<NexusScenarioResponseProps> = ({ response, data }) => {
  const meta = (response.metadata || data?.scenario || data || {}) as any;
  const reportSections = meta.reportSections || {};
  const scenBlock = reportSections.SCENARIO || meta.scenarioDefinition || {};
  const locBlock = reportSections.LOCATION || meta.location || {};
  const histBlock = reportSections.HISTORICAL_EVIDENCE || meta.historicalComparison || {};
  const geoBlock = reportSections.GEOSPATIAL_SUSCEPTIBILITY || meta.geospatialSusceptibility || {};
  const predBlock = reportSections.MODEL_DERIVED_PREDICTION || {};
  const confBlock = reportSections.CONFIDENCE || meta.confidenceReport || {};
  const uncBlock = reportSections.UNCERTAINTY_AND_LIMITATIONS || meta.uncertaintyAndLimitations || {};
  const fourFactors: any[] = meta.fourKeyFactors || reportSections.FOUR_KEY_FACTORS || [];
  const affectedAreas: any[] = meta.affectedAreas || reportSections.AFFECTED_LOCATIONS || [];
  const affectedRoads: any[] = meta.affectedRoads || reportSections.AFFECTED_INFRASTRUCTURE?.affectedRoads || [];
  const assumptions: string[] = meta.assumptions || [];
  const dataSources: any[] = meta.dataSources || reportSections.DATA_SOURCES || response.sources || [];

  const scenarioDisplay =
    scenBlock.displayName ||
    scenBlock.scenarioType ||
    meta.canonicalScenarioCategory ||
    'Scenario Analysis';
  const intensityDisplay =
    scenBlock.displayIntensity ||
    (scenBlock.intensity != null ? `${scenBlock.intensity} ${scenBlock.unit || ''}`.trim() : 'Unspecified (Baseline Susceptibility Mode)');
  const durationDisplay =
    scenBlock.duration ||
    scenBlock.displayDuration ||
    (scenBlock.durationHours != null ? `${scenBlock.durationHours} hours` : 'Unspecified');
  const locationDisplay =
    locBlock.city ||
    locBlock.displayName ||
    scenBlock.location ||
    'Active Location';
  const targetYear = scenBlock.targetYear;
  const confidenceLevel = confBlock.overallConfidence || meta.confidenceLevel || 'MEDIUM';
  const confidencePct = Math.round(((confBlock.overallConfidenceScore ?? meta.confidence ?? 0.72) as number) * 100);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        fontSize: '12.5px',
        backgroundColor: 'var(--assistant-card-bg)',
        border: '1px solid var(--assistant-card-border)',
        borderRadius: '12px',
        padding: '12px 14px',
        boxShadow: 'var(--card-shadow)',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Top Banner: SCENARIO ANALYSIS */}
      <div
        style={{
          padding: '6px 10px',
          borderRadius: '6px',
          backgroundColor: 'var(--badge-info-bg, #EFF6FF)',
          border: '1px solid var(--badge-info-border, #BFDBFE)',
          color: 'var(--badge-info-text, #1D4ED8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          fontSize: '11px',
          fontWeight: 800,
          flexWrap: 'wrap',
        }}
      >
        <span>SCENARIO ANALYSIS — EVIDENCE-GROUNDED</span>
        <span
          style={{
            padding: '1px 6px',
            borderRadius: '4px',
            backgroundColor: 'var(--status-warning-bg)',
            color: 'var(--status-warning-text)',
            border: '1px solid var(--status-warning-border)',
            fontSize: '10px',
          }}
        >
          CONFIDENCE: {confidenceLevel} ({confidencePct}%)
        </span>
      </div>

      {/* Structured Scenario Header Grid (Section 14) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px 10px',
          padding: '8px 10px',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-surface-secondary)',
          border: '1px solid var(--border-subtle)',
          fontSize: '11.5px',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', display: 'block' }}>Scenario</span>
          <strong style={{ color: 'var(--text-primary)' }}>{scenarioDisplay}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', display: 'block' }}>Location</span>
          <strong style={{ color: 'var(--text-primary)' }}>{locationDisplay}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', display: 'block' }}>Intensity</span>
          <strong style={{ color: 'var(--text-primary)' }}>{intensityDisplay}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', display: 'block' }}>
            {targetYear ? `Duration / Target Year` : 'Duration'}
          </span>
          <strong style={{ color: 'var(--text-primary)' }}>
            {durationDisplay}
            {targetYear ? ` (Year: ${targetYear})` : ''}
          </strong>
        </div>
      </div>

      {/* 1. HISTORICAL EVIDENCE */}
      {histBlock.statements && histBlock.statements.length > 0 && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-surface-secondary)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#1E40AF' }}>HISTORICAL EVIDENCE</span>
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: BADGE_COLORS['HISTORICAL EVIDENCE'].bg,
                color: BADGE_COLORS['HISTORICAL EVIDENCE'].text,
                border: `1px solid ${BADGE_COLORS['HISTORICAL EVIDENCE'].border}`,
              }}
            >
              ERA5 / ARCHIVE
            </span>
          </div>
          {histBlock.statements.map((st: any, idx: number) => (
            <p key={idx} style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {st.statement || st}
            </p>
          ))}
        </div>
      )}

      {/* 2. GEOSPATIAL SUSCEPTIBILITY */}
      {geoBlock.statements && geoBlock.statements.length > 0 && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-surface-secondary)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#166534' }}>GEOSPATIAL SUSCEPTIBILITY</span>
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: BADGE_COLORS['CURRENT OBSERVATION'].bg,
                color: BADGE_COLORS['CURRENT OBSERVATION'].text,
                border: `1px solid ${BADGE_COLORS['CURRENT OBSERVATION'].border}`,
              }}
            >
              CURRENT DATA (DEM / OSM)
            </span>
          </div>
          {geoBlock.statements.map((st: any, idx: number) => (
            <p key={idx} style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {st.statement || st}
            </p>
          ))}
        </div>
      )}

      {/* 3. POTENTIAL IMPACT & 4 KEY FACTORS (MODEL-DERIVED PREDICTION) */}
      <div
        style={{
          padding: '8px 10px',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-surface-secondary)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#92400E' }}>POTENTIAL IMPACT & 4-FACTOR MODEL</span>
          <span
            style={{
              fontSize: '9.5px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: BADGE_COLORS['MODEL-DERIVED PREDICTION'].bg,
              color: BADGE_COLORS['MODEL-DERIVED PREDICTION'].text,
              border: `1px solid ${BADGE_COLORS['MODEL-DERIVED PREDICTION'].border}`,
            }}
          >
            MODEL-DERIVED PREDICTION
          </span>
        </div>

        {predBlock.statements &&
          predBlock.statements.map((st: any, idx: number) => (
            <p key={idx} style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {st.statement || st}
            </p>
          ))}

        {fourFactors.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
            {fourFactors.map((f: any, idx: number) => (
              <div
                key={idx}
                style={{
                  fontSize: '11px',
                  padding: '4px 6px',
                  borderRadius: '5px',
                  backgroundColor: 'var(--assistant-card-bg)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <strong>
                  {idx + 1}. {f.factorName}:
                </strong>{' '}
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{f.status}</span>
                {f.score != null ? ` (${f.score}/100)` : ''} —{' '}
                <span style={{ color: 'var(--text-secondary)' }}>{f.explanation}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. AFFECTED AREAS & AFFECTED ROADS */}
      {(affectedAreas.length > 0 || affectedRoads.length > 0) && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-surface-secondary)',
            border: '1px solid var(--border-subtle)',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
            AFFECTED AREAS & INFRASTRUCTURE CORRIDORS
          </span>
          {affectedAreas.map((a: any, idx: number) => (
            <div key={idx} style={{ color: 'var(--text-secondary)' }}>
              • <strong>{a.label}</strong> ({a.severity}): {a.impact}
            </div>
          ))}
          {affectedRoads.map((r: any, idx: number) => (
            <div key={idx} style={{ color: 'var(--text-secondary)' }}>
              • <strong>{r.roadName}</strong> ({r.roadClass}): {r.predictedImpact}
            </div>
          ))}
        </div>
      )}

      {/* 5. ASSUMPTIONS & UNCERTAINTY */}
      {(assumptions.length > 0 || uncBlock.predictionUncertainty) && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-surface-secondary)',
            border: '1px solid var(--border-subtle)',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#6B21A8' }}>ASSUMPTIONS & UNCERTAINTY</span>
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: BADGE_COLORS['ASSUMPTION'].bg,
                color: BADGE_COLORS['ASSUMPTION'].text,
                border: `1px solid ${BADGE_COLORS['ASSUMPTION'].border}`,
              }}
            >
              ASSUMPTION
            </span>
          </div>
          {assumptions.slice(0, 2).map((a: string, i: number) => (
            <div key={i} style={{ color: 'var(--text-secondary)' }}>
              • {a}
            </div>
          ))}
          {confBlock.rationale && (
            <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>{confBlock.rationale}</div>
          )}
        </div>
      )}

      {/* 6. DATA SOURCES FOOTER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '10px',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '4px',
          flexWrap: 'wrap',
          gap: '4px',
        }}
      >
        <span>
          Data Sources:{' '}
          {dataSources.length > 0
            ? dataSources.map((s: any) => s.name || s.source).slice(0, 3).join(' • ')
            : 'Open-Meteo ERA5 • Copernicus DEM • OpenStreetMap'}
        </span>
      </div>
    </div>
  );
};

export default NexusScenarioResponse;
