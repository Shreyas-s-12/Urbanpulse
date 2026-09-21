/**
 * UrbanPulse Map Overlay Manager
 * Controls placement, spacing, and collision handling for all custom elements
 * sitting over the Google Map. The map canvas remains the dominant surface.
 */

'use client';

import React from 'react';
import { MAP_SAFE_AREAS } from './overlaySafeArea';

interface MapOverlayManagerProps {
  topBar?: React.ReactNode;
  topLeft?: React.ReactNode;
  topCenter?: React.ReactNode;
  topRight?: React.ReactNode;
  bottomLeft?: React.ReactNode;
  bottomRight?: React.ReactNode;
  isStreetViewActive?: boolean;
  isMobile?: boolean;
  children?: React.ReactNode;
}

export default function MapOverlayManager({
  topBar,
  topLeft,
  topCenter,
  topRight,
  bottomLeft,
  bottomRight,
  isStreetViewActive = false,
  isMobile = false,
  children,
}: MapOverlayManagerProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 25,
      }}
      aria-label="Map Overlays"
    >
      {/* 1. Top Strip: Intelligence Heatmap Toolbar (Docked cleanly below header) */}
      {topBar && (
        <div
          style={{
            ...MAP_SAFE_AREAS.HEATMAP_TOOLBAR,
            pointerEvents: 'auto',
          }}
        >
          {topBar}
        </div>
      )}

      {/* 2. Top-Center: Temporary Map Prompts (e.g. MapLocationPicker) */}
      {topCenter && (
        <div
          style={{
            ...MAP_SAFE_AREAS.MAP_SELECTION_PROMPT,
            pointerEvents: 'auto',
          }}
        >
          {topCenter}
        </div>
      )}

      {/* 3. Top-Left: Local Intelligence Card (Hidden or collapsed during Street View) */}
      {!isStreetViewActive && topLeft && (
        <div
          style={{
            ...MAP_SAFE_AREAS.LOCAL_INTELLIGENCE,
            // When top toolbar is active, shift down slightly to provide clean breathing room
            top: '16px',
            pointerEvents: 'auto',
          }}
        >
          {topLeft}
        </div>
      )}

      {/* 4. Top-Right: Map Controls & Events Near You Panel */}
      {topRight && (
        <div
          style={{
            position: 'absolute',
            top: '0',
            right: '0',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {topRight}
        </div>
      )}

      {/* 5. Bottom-Left: Location Telemetry & Situation Briefing Card */}
      {!isStreetViewActive && bottomLeft && (
        <div
          style={{
            ...MAP_SAFE_AREAS.LOCATION_HUD,
            pointerEvents: 'auto',
          }}
        >
          {bottomLeft}
        </div>
      )}

      {/* 6. Bottom-Right: Stacked Legends (Heatmap + Live Traffic) */}
      {!isStreetViewActive && bottomRight && (
        <div
          style={{
            ...MAP_SAFE_AREAS.MAP_LEGEND,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'flex-end',
            pointerEvents: 'auto',
          }}
        >
          {bottomRight}
        </div>
      )}

      {/* Pass through any additional unmanaged overlay children */}
      {children}
    </div>
  );
}
