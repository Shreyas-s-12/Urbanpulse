'use client';

import React, { useState } from 'react';
import { IncidentDossier, LifecycleState } from '@/types/command';
import { commandService } from '@/services/commandService';

interface IncidentCommandPanelProps {
  dossier: IncidentDossier | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function IncidentCommandPanel({
  dossier,
  onClose,
  onRefresh,
}: IncidentCommandPanelProps) {
  const [transitioning, setTransitioning] = useState(false);

  if (!dossier) return null;

  const handleStateChange = async (newState: LifecycleState) => {
    try {
      setTransitioning(true);
      await commandService.updateIncidentState(
        dossier.incidentId,
        newState,
        `Operational transition to ${newState} via Incident Command Mode`
      );
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to transition incident state:', err);
    } finally {
      setTransitioning(false);
    }
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'OBSERVED':
        return { bg: '#DBEAFE', text: '#1E40AF' };
      case 'INFERRED':
        return { bg: '#FEF3C7', text: '#92400E' };
      case 'FORECAST':
        return { bg: '#F3E8FF', text: '#6B21A8' };
      default:
        return { bg: '#F3F4F6', text: '#374151' };
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderLeft: '1px solid #E5E7EB',
        width: '420px',
        overflowY: 'auto',
        boxShadow: '-2px 0 6px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #E5E7EB',
          backgroundColor: '#F9FAFB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>
            INCIDENT COMMAND MODE — {dossier.lifecycleState}
          </span>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '2px 0 0 0' }}>
            {dossier.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            color: '#6B7280',
            cursor: 'pointer',
            padding: '2px 6px',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Spatial Impact KPI Cards */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', marginBottom: '8px' }}>
            SPATIAL IMPACT ANALYSIS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>AFFECTED AREA</span>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                {dossier.spatialImpact.affectedAreaSqKm} <span style={{ fontSize: '11px', fontWeight: 500 }}>km²</span>
              </div>
              <span style={{ fontSize: '10px', color: '#94A3B8' }}>Radius: {dossier.spatialImpact.impactRadiusKm} km</span>
            </div>

            <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>TRANSIT DELAY</span>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#DC2626' }}>
                +{dossier.spatialImpact.transitDelayMinutes} <span style={{ fontSize: '11px', fontWeight: 500 }}>min</span>
              </div>
              <span style={{ fontSize: '10px', color: '#94A3B8' }}>State: {dossier.spatialImpact.trafficStatus}</span>
            </div>

            <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>AFFECTED ROADS</span>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                {dossier.spatialImpact.affectedRoadsCount}
              </div>
              <span style={{ fontSize: '10px', color: '#94A3B8' }}>Intersecting corridors</span>
            </div>

            <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>AFFECTED POIs</span>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                {dossier.spatialImpact.affectedPoisCount}
              </div>
              <span style={{ fontSize: '10px', color: '#94A3B8' }}>Civic facilities in buffer</span>
            </div>
          </div>
        </div>

        {/* Lifecycle Transitions */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', marginBottom: '8px' }}>
            OPERATIONAL LIFECYCLE
          </div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {(['CONFIRMED', 'ESCALATING', 'ACTIVE', 'STABILIZING', 'RESOLVED'] as LifecycleState[]).map((st) => {
              const isCurr = dossier.lifecycleState === st;
              return (
                <button
                  key={st}
                  disabled={transitioning || isCurr}
                  onClick={() => handleStateChange(st)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: isCurr ? 'default' : 'pointer',
                    border: isCurr ? '1px solid #2563EB' : '1px solid #D1D5DB',
                    backgroundColor: isCurr ? '#2563EB' : '#FFFFFF',
                    color: isCurr ? '#FFFFFF' : '#374151',
                    opacity: transitioning ? 0.6 : 1,
                  }}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cascading Failure Chain */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', marginBottom: '8px' }}>
            CASCADE FAILURE CHAIN
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {dossier.cascadeChain.map((step) => {
              const badge = getStageBadge(step.stage);
              return (
                <div
                  key={step.stageIndex}
                  style={{
                    padding: '8px 10px',
                    backgroundColor: '#F9FAFB',
                    borderRadius: '6px',
                    border: '1px solid #E5E7EB',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: '3px',
                        backgroundColor: badge.bg,
                        color: badge.text,
                      }}
                    >
                      {step.stage}
                    </span>
                    <span style={{ fontSize: '10px', color: '#6B7280' }}>Conf: {Math.round(step.confidence * 100)}%</span>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#111827' }}>{step.title}</div>
                  <div style={{ fontSize: '10px', color: '#4B5563', marginTop: '2px' }}>{step.detail}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Infrastructure Dependencies */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', marginBottom: '8px' }}>
            INFRASTRUCTURE DEPENDENCIES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {dossier.infrastructureDependencies.map((dep, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '6px',
                  border: '1px solid #E5E7EB',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#1F2937' }}>{dep.name}</span>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: dep.status === 'CONGESTED' ? '#DC2626' : '#2563EB' }}>
                    {dep.status}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>{dep.relation}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Actions */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', marginBottom: '8px' }}>
            RECOMMENDED ACTIONS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {dossier.recommendedActions.map((act) => (
              <div
                key={act.optionId}
                style={{
                  padding: '10px',
                  backgroundColor: '#EFF6FF',
                  borderRadius: '6px',
                  border: '1px solid #BFDBFE',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E40AF' }}>{act.title}</div>
                <div style={{ fontSize: '11px', color: '#1E3A8A', margin: '3px 0' }}>{act.description}</div>
                <div style={{ fontSize: '10px', color: '#047857', fontWeight: 600 }}>Benefit: {act.benefit}</div>
                <div style={{ fontSize: '10px', color: '#B45309', fontWeight: 500 }}>Trade-off: {act.tradeOff}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
