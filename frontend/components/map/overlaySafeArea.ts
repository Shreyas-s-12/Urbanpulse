/**
 * UrbanPulse Map Overlay Safe Area System
 * Standardized, collision-aware zoning for all floating map controls and panels.
 * Enforces strict physical separation between Google Controls, Events Near You,
 * Local Intelligence, Location HUD, and Heatmap/Traffic legends.
 */

import React from 'react';

export const MAP_Z_INDEX = {
  BASE_MAP: 10,
  GOOGLE_MAP_NATIVE: 20,
  MAP_OVERLAY_BASE: 25,
  MAP_CARDS: 30,
  MAP_INTERACTIVE: 35,
  MODAL: 40,
  TOAST_PROMPT: 50,
} as const;

export const MAP_SAFE_VARIABLES = {
  safeTop: 'var(--map-safe-top, 16px)',
  safeRight: 'var(--map-safe-right, 16px)',
  safeBottom: 'var(--map-safe-bottom, 20px)',
  safeLeft: 'var(--map-safe-left, 16px)',
  overlayGap: 'var(--map-overlay-gap, 8px)',
} as const;

export interface OverlayZoneStyle {
  position: 'absolute';
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  width?: string;
  maxWidth?: string;
  maxHeight?: string;
  zIndex: number;
  pointerEvents?: 'auto' | 'none';
}

export const MAP_SAFE_AREAS = {
  // Top Strip: Intelligence Heatmap Toolbar (Docked cleanly below header)
  HEATMAP_TOOLBAR: {
    position: 'absolute',
    top: '10px',
    left: '16px',
    right: '16px',
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: MAP_Z_INDEX.MAP_INTERACTIVE,
  } as const,

  // Zone 1: Camera & Map Type Controls (2D, Road/Sat/Hybrid/Terrain, Street View)
  MAP_CONTROLS: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    zIndex: MAP_Z_INDEX.GOOGLE_MAP_NATIVE,
  } as const,

  // Zone 2: Events Near You Panel (Placed strictly below Zone 1 controls with guaranteed vertical separation from bottom-right legends)
  EVENTS_PANEL: {
    position: 'absolute',
    top: '62px',
    right: '16px',
    width: '320px',
    maxHeight: 'calc(100vh - 380px)',
    overflowY: 'auto',
    zIndex: MAP_Z_INDEX.MAP_CARDS,
  } as const,

  // Mobile Events Sheet (Anchored to bottom drawer without covering map controls)
  EVENTS_PANEL_MOBILE: {
    position: 'absolute',
    bottom: '16px',
    left: '12px',
    right: '12px',
    width: 'auto',
    maxHeight: '40vh',
    zIndex: MAP_Z_INDEX.MODAL,
  } as const,

  // Zone 3: Local Intelligence Card (Top Left - strictly clears bottom-left HUD)
  LOCAL_INTELLIGENCE: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    width: '320px',
    maxHeight: 'calc(100vh - 360px)',
    overflowY: 'auto',
    zIndex: MAP_Z_INDEX.MAP_CARDS,
  } as const,

  // Zone 4: Location Telemetry HUD / Location Briefing (Bottom Left)
  LOCATION_HUD: {
    position: 'absolute',
    bottom: '20px',
    left: '16px',
    width: '320px',
    maxWidth: '340px',
    maxHeight: '260px',
    zIndex: MAP_Z_INDEX.MAP_CARDS,
  } as const,

  // Zone 5: Unified Map & Heatmap Legend (Bottom Right - stacked with 8px gap)
  MAP_LEGEND: {
    position: 'absolute',
    bottom: '20px',
    right: '16px',
    maxWidth: '280px',
    maxHeight: '280px',
    overflowY: 'auto',
    zIndex: MAP_Z_INDEX.MAP_CARDS,
  } as const,

  // Zone 6: Dev-only Diagnostics HUD (Bottom Center, never colliding with bottom-right legends)
  DEBUG_HUD: {
    position: 'absolute',
    bottom: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: MAP_Z_INDEX.MAP_INTERACTIVE,
  } as const,

  // Zone 7: Temporary Map Click Prompts & Modals (Top Center)
  MAP_SELECTION_PROMPT: {
    position: 'absolute',
    top: '70px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: MAP_Z_INDEX.TOAST_PROMPT,
  } as const,

  // Zone 8: Intelligence Legend Sheet (Bottom Center or Bottom Right with guaranteed vertical clearance)
  INTELLIGENCE_LEGEND: {
    position: 'absolute',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: MAP_Z_INDEX.MAP_CARDS,
  } as const,

  // Mobile Bottom Sheet Zone
  INTELLIGENCE_LEGEND_MOBILE: {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    right: '12px',
    zIndex: MAP_Z_INDEX.MODAL,
  } as const,
};

/**
 * Returns safe styling for the Events Near You panel dynamically
 * factoring in Street View activity and viewport width.
 */
export function getEventsPanelSafeStyle(isStreetViewActive: boolean, isMobile: boolean): React.CSSProperties {
  if (isStreetViewActive) {
    return { display: 'none' };
  }

  if (isMobile) {
    return {
      ...MAP_SAFE_AREAS.EVENTS_PANEL_MOBILE,
      backgroundColor: 'var(--bg-surface)',
      borderRadius: 'var(--radius-md, 12px)',
      boxShadow: 'var(--shadow-lg, 0 10px 25px -5px rgba(0, 0, 0, 0.1))',
      border: '1px solid var(--border-subtle, #E2E8F0)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      pointerEvents: 'auto',
    };
  }

  return {
    ...MAP_SAFE_AREAS.EVENTS_PANEL,
    pointerEvents: 'auto',
  };
}
