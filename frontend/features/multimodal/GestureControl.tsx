'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import GestureCamera from './camera/GestureCamera';
import GestureIndicator from './GestureIndicator';
import { RecognizedGesture, GestureEvent } from './gestures/gestureDetector';
import { commandDispatcher } from '@/services/command/commandDispatcher';
import { useLanguage } from '@/context/LanguageContext';
import { ROUTES } from '@/lib/routes';

const MAIN_NAVIGATION_FLOW = [
  ROUTES.overview,
  ROUTES.updates,
  ROUTES.analytics,
  ROUTES.simulate,
  ROUTES.georag,
  ROUTES.crisisrag,
  ROUTES.aquarag,
  ROUTES.research,
];

export default function GestureControl() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();

  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [activeGesture, setActiveGesture] = useState<RecognizedGesture | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const gestureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleToggle = () => {
    setErrorMessage(null);
    setIsEnabled((prev) => !prev);
  };

  const handleCameraError = useCallback((error: string) => {
    setErrorMessage(error);
    setIsEnabled(false);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      setErrorMessage(null);
    }, 4500);
  }, []);

  const handleGesture = useCallback(
    (event: GestureEvent) => {
      setActiveGesture(event.gesture);
      if (event.pointer) {
        setPointer(event.pointer);
      }

      // Auto-clear gesture badge after 1.5s
      if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
      gestureTimeoutRef.current = setTimeout(() => {
        setActiveGesture(null);
      }, 1500);

      // Execute gesture action
      switch (event.gesture) {
        case 'SWIPE_RIGHT': {
          const currentIndex = MAIN_NAVIGATION_FLOW.indexOf(pathname as any);
          const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % MAIN_NAVIGATION_FLOW.length : 0;
          router.push(MAIN_NAVIGATION_FLOW[nextIndex]);
          commandDispatcher.dispatch({ type: 'NEXT_PAGE' });
          break;
        }
        case 'SWIPE_LEFT': {
          const currentIndex = MAIN_NAVIGATION_FLOW.indexOf(pathname as any);
          const prevIndex =
            currentIndex > 0 ? currentIndex - 1 : MAIN_NAVIGATION_FLOW.length - 1;
          router.push(MAIN_NAVIGATION_FLOW[prevIndex]);
          commandDispatcher.dispatch({ type: 'PREVIOUS_PAGE' });
          break;
        }
        case 'PINCH': {
          if (event.pointer) {
            const clientX = event.pointer.x * window.innerWidth;
            const clientY = event.pointer.y * window.innerHeight;
            const targetEl = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
            if (targetEl) {
              targetEl.click();
            }
          }
          break;
        }
        case 'THUMBS_UP': {
          commandDispatcher.dispatch({ type: 'CONFIRM' });
          break;
        }
        case 'HOLD_OPEN': {
          // Pause interaction temporarily
          setIsEnabled(false);
          break;
        }
        default:
          break;
      }
    },
    [pathname, router]
  );

  return (
    <>
      {/* Hand Control Toggle Button in TopBar */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isEnabled ? 'Disable Hand Control' : 'Enable Hand Control'}
        aria-pressed={isEnabled}
        title={
          isEnabled
            ? 'Hand Control: Active (Click to disable)'
            : 'Hand Control: Inactive (Click to enable camera gestures)'
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '36px',
          padding: '0 12px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: isEnabled ? 'var(--hand-control-on-bg)' : 'var(--hand-control-off-bg)',
          border: isEnabled ? '1px solid var(--hand-control-on-border)' : '1px solid var(--hand-control-off-border)',
          color: isEnabled ? 'var(--hand-control-on-text)' : 'var(--hand-control-off-text)',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: isEnabled ? '0 0 12px rgba(59, 130, 246, 0.20)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (!isEnabled) {
            e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isEnabled) {
            e.currentTarget.style.backgroundColor = 'var(--hand-control-off-bg)';
            e.currentTarget.style.color = 'var(--hand-control-off-text)';
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 11V6a2 2 0 0 0-4 0v5" />
          <path d="M14 10V4a2 2 0 0 0-4 0v7" />
          <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.83L7 15" />
        </svg>
        <span>{t('multimodal.handControl', 'Hand Control')}</span>
        <span
          style={{
            fontSize: '9.5px',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: isEnabled ? 'var(--button)' : 'var(--border-subtle)',
            color: isEnabled ? 'var(--button-foreground)' : 'var(--hand-control-off-text)',
            fontWeight: 800,
          }}
        >
          {isEnabled ? 'ON' : 'OFF'}
        </span>
      </button>

      {/* Camera and Landmark Processing Engine */}
      <GestureCamera
        isActive={isEnabled}
        onGesture={handleGesture}
        onError={handleCameraError}
        showPreview={false}
      />

      {/* Floating HUD Indicator */}
      <GestureIndicator
        isEnabled={isEnabled}
        activeGesture={activeGesture}
        pointer={pointer}
        errorMessage={errorMessage}
      />
    </>
  );
}
