'use client';

import React, { useState, useEffect } from 'react';
import { ReplayTimelineResponse, ReplayFrame } from '@/types/command';

interface ReplayTimelineBarProps {
  timelineData: ReplayTimelineResponse | null;
  selectedWindow: string;
  onSelectWindow: (w: string) => void;
  activeFrameIndex: number;
  onSelectFrame: (idx: number) => void;
}

export default function ReplayTimelineBar({
  timelineData,
  selectedWindow,
  onSelectWindow,
  activeFrameIndex,
  onSelectFrame,
}: ReplayTimelineBarProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let timer: any;
    if (isPlaying && timelineData && timelineData.timeline.length > 0) {
      timer = setInterval(() => {
        if (activeFrameIndex >= timelineData.timeline.length - 1) {
          setIsPlaying(false);
        } else {
          onSelectFrame(activeFrameIndex + 1);
        }
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [isPlaying, timelineData, activeFrameIndex, onSelectFrame]);

  if (!timelineData) return null;

  const currentFrame: ReplayFrame | undefined = timelineData.timeline[activeFrameIndex];

  const getWatermarkBadge = (wm?: string) => {
    switch (wm) {
      case 'HISTORICAL':
        return { bg: '#FEF3C7', text: '#92400E', label: 'HISTORICAL OBSERVATION' };
      case 'CURRENT':
        return { bg: '#DEF7EC', text: '#03543F', label: 'CURRENT LIVE TELEMETRY' };
      case 'FORECAST':
        return { bg: '#E1EFFE', text: '#1E429F', label: 'PREDICTIVE FORECAST' };
      case 'SIMULATION':
        return { bg: '#FDE8E8', text: '#9B1C1C', label: 'SYNTHETIC SCENARIO' };
      default:
        return { bg: '#F3F4F6', text: '#374151', label: 'TELEMETRY' };
    }
  };

  const badge = getWatermarkBadge(currentFrame?.watermark);

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E5E7EB',
        boxShadow: '0 -2px 6px rgba(0,0,0,0.03)',
        padding: '10px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 20,
      }}
    >
      {/* Top Controls Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Play / Pause button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isPlaying ? 'Pause' : 'Play Replay'}
          </button>

          {/* Window Selectors */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {['24H', '7D', '30D'].map((w) => {
              const isSel = selectedWindow === w;
              return (
                <button
                  key={w}
                  onClick={() => {
                    setIsPlaying(false);
                    onSelectWindow(w);
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: isSel ? '1px solid #2563EB' : '1px solid #D1D5DB',
                    backgroundColor: isSel ? '#EFF6FF' : '#FFFFFF',
                    color: isSel ? '#1D4ED8' : '#4B5563',
                  }}
                >
                  {w}
                </button>
              );
            })}
          </div>

          {/* Watermark Flag (MANDATORY per spec) */}
          <span
            style={{
              fontSize: '10px',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '4px',
              backgroundColor: badge.bg,
              color: badge.text,
              letterSpacing: '0.5px',
            }}
          >
            {badge.label}
          </span>
        </div>

        {/* Current Scrubber Timestamp Detail */}
        {currentFrame && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#4B5563' }}>
            <span>
              Time: <strong>{currentFrame.displayTime}</strong>
            </span>
            <span>
              Traffic: <strong>{currentFrame.conditions.trafficStatus} (+{currentFrame.conditions.delayMinutes}m)</strong>
            </span>
            <span>
              Weather: <strong>{currentFrame.conditions.temperatureC}°C, {currentFrame.conditions.precipitationMm}mm rain</strong>
            </span>
            <span>
              Active Events: <strong>{currentFrame.activeEventsCount}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Scrub Track */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600 }}>T0</span>
        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
          {timelineData.timeline.map((frame, i) => {
            const isSelected = i === activeFrameIndex;
            return (
              <div
                key={frame.stepIndex}
                onClick={() => {
                  setIsPlaying(false);
                  onSelectFrame(i);
                }}
                style={{
                  flex: 1,
                  height: '8px',
                  borderRadius: '3px',
                  backgroundColor: isSelected ? '#2563EB' : (i < activeFrameIndex ? '#93C5FD' : '#E2E8F0'),
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                title={`${frame.displayTime} (${frame.watermark})`}
              />
            );
          })}
        </div>
        <span style={{ fontSize: '10px', color: '#2563EB', fontWeight: 700 }}>NOW</span>
      </div>
    </div>
  );
}
