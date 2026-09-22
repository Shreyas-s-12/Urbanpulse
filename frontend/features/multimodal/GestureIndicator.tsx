'use client';

import React from 'react';
import { RecognizedGesture } from './gestures/gestureDetector';
import { useLanguage } from '@/context/LanguageContext';

interface GestureIndicatorProps {
  isEnabled: boolean;
  activeGesture: RecognizedGesture | null;
  pointer: { x: number; y: number } | null;
  errorMessage: string | null;
}

export default function GestureIndicator({
  isEnabled,
  activeGesture,
  pointer,
  errorMessage,
}: GestureIndicatorProps) {
  const { t } = useLanguage();

  if (!isEnabled && !errorMessage) return null;

  return (
    <>
      {/* Visual HUD Toast Indicator */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          top: '68px',
          right: '24px',
          zIndex: 9990,
          backgroundColor: errorMessage
            ? 'var(--badge-danger-bg)'
            : activeGesture && activeGesture !== 'NONE'
            ? 'var(--badge-info-bg)'
            : 'var(--overlay-bg)',
          color: errorMessage
            ? 'var(--badge-danger-text)'
            : activeGesture && activeGesture !== 'NONE'
            ? 'var(--badge-info-text)'
            : 'var(--text-primary)',
          border: errorMessage
            ? '1px solid var(--badge-danger-border)'
            : activeGesture && activeGesture !== 'NONE'
            ? '1px solid var(--badge-info-border)'
            : '1px solid var(--border-subtle)',
          borderRadius: '9999px',
          padding: '6px 14px',
          fontSize: '11.5px',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: 'var(--shadow-md)',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
          letterSpacing: '0.4px',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: errorMessage
              ? '#EF4444'
              : activeGesture && activeGesture !== 'NONE'
              ? '#2563EB'
              : '#10B981',
            boxShadow: `0 0 6px ${
              errorMessage
                ? '#EF4444'
                : activeGesture && activeGesture !== 'NONE'
                ? '#2563EB'
                : '#10B981'
            }`,
          }}
        />
        <span>
          {errorMessage
            ? errorMessage
            : activeGesture && activeGesture !== 'NONE'
            ? `${t('multimodal.gestureDetected', 'Gesture detected')}: ${activeGesture}`
            : t('multimodal.handControlOn', 'HAND CONTROL ON')}
        </span>
      </div>

      {/* Floating Virtual Hand Pointer Dot (Visible when pointing) */}
      {isEnabled && pointer && activeGesture === 'POINT' && (
        <div
          style={{
            position: 'fixed',
            left: `${pointer.x * 100}vw`,
            top: `${pointer.y * 100}vh`,
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: 'rgba(37, 99, 235, 0.75)',
            border: '2px solid #FFFFFF',
            boxShadow: '0 0 10px rgba(37, 99, 235, 0.6)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 9999,
            transition: 'left 0.05s linear, top 0.05s linear',
          }}
        />
      )}
    </>
  );
}
