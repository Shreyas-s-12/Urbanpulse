'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';
import { useLocationStore } from '@/stores/useLocationStore';
import { RawDeviceLocation } from '@shared/types';
import { locationService } from '@/services/locationService';
import LocationSearchDrawer from '@/components/location/LocationSearchDrawer';
import { useResearchStore } from '@/stores/useResearchStore';

export default function TopBar() {
  const { isResearchModeOpen, toggleResearchMode } = useResearchStore();
  const {
    currentLocation,
    currentDeviceLocation,
    locationAccuracyState,
    activeLocationMode,
    isResolvingLocation,
    setIsResolvingLocation,
    setSearchDrawerOpen,
  } = useLocationStore();

  const gpsAccuracyMeters = currentDeviceLocation?.accuracyMeters;

  // Explicit on-demand location detection via locationService
  const handleLocateMe = async () => {
    try {
      await locationService.requestDeviceLocation();
    } catch (err) {
      console.warn('[TopBar] Location acquisition error handled safely:', err);
    }
  };

  const isLocating = isResolvingLocation || locationAccuracyState === 'LOCATING' || locationAccuracyState === 'IMPROVING';
  const isReady = activeLocationMode === 'DEVICE' && (locationAccuracyState === 'READY' || locationAccuracyState === 'LOCKED' || locationAccuracyState === 'FOUND');
  const isApprox = activeLocationMode === 'DEVICE' && locationAccuracyState === 'APPROXIMATE';
  const isDenied = locationAccuracyState === 'DENIED';
  const isTimeout = locationAccuracyState === 'TIMEOUT';
  const isUnavailable = locationAccuracyState === 'UNAVAILABLE';
  const isError = locationAccuracyState === 'ERROR';

  return (
    <header
      style={{
        height: '58px',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-5)',
        gap: 'var(--space-4)',
        zIndex: 40,
        flexShrink: 0,
      }}
    >
      {/* Left: Brand & Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: '1', maxWidth: '580px' }}>
        <Link
          href="/"
          title="UrbanPulse Home"
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
            transition: 'opacity 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <UrbanPulseLogo size="sm" showWordmark={true} priority />
        </Link>

        {/* Search City, Address or Place Trigger */}
        <div
          style={{ position: 'relative', width: '100%', cursor: 'pointer' }}
          onClick={() => setSearchDrawerOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSearchDrawerOpen(true);
            }
          }}
          title="Search city, address, street or place"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-app)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              padding: '0 12px',
              height: '38px',
              gap: '8px',
              transition: 'border-color 0.15s ease',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', fontSize: '13px' }}>
              <span style={{ color: currentLocation ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentLocation
                  ? `${currentLocation.city || currentLocation.displayName}`
                  : 'Search city, address or place'}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: activeLocationMode === 'DEVICE' ? '#2563EB' : '#475569',
                  backgroundColor: activeLocationMode === 'DEVICE' ? '#EFF6FF' : '#F1F5F9',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  letterSpacing: '0.4px',
                  flexShrink: 0,
                }}
              >
                {activeLocationMode === 'DEVICE' ? 'DEVICE' : activeLocationMode === 'SEARCH' ? 'SEARCH' : activeLocationMode === 'MAP_CLICK' ? 'MAP PIN' : 'LOCATION'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: [ ◎ My Location ] | [ Intelligence Heatmap ] | [ Live Data ] */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* [ ◎ My Location ] Button */}
        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          data-testid="my-location-button"
          aria-label="Use my current location"
          title={
            isLocating
              ? 'Acquiring device GPS position...'
              : isReady && gpsAccuracyMeters
              ? `Location found within ±${Math.round(gpsAccuracyMeters)}m`
              : isDenied
              ? 'Location access is blocked in your browser. Click to try again.'
              : isTimeout
              ? 'Location request timed out. Click to try again.'
              : isUnavailable
              ? "Your device couldn't provide a location right now. Click to try again."
              : isError
              ? 'Location error. Click to try again.'
              : 'Detect my exact device location'
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: isReady
              ? 'rgba(16, 185, 129, 0.08)'
              : isApprox
              ? 'rgba(245, 158, 11, 0.08)'
              : isDenied || isUnavailable || isTimeout || isError
              ? 'rgba(239, 68, 68, 0.06)'
              : 'var(--bg-app)',
            border: isReady
              ? '1px solid rgba(16, 185, 129, 0.35)'
              : isApprox
              ? '1px solid rgba(245, 158, 11, 0.35)'
              : isDenied || isUnavailable || isTimeout || isError
              ? '1px solid rgba(239, 68, 68, 0.3)'
              : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0 12px',
            height: '38px',
            fontSize: '12px',
            fontWeight: 500,
            color: isReady
              ? '#10B981'
              : isApprox
              ? '#F59E0B'
              : isDenied || isUnavailable || isTimeout || isError
              ? '#EF4444'
              : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            cursor: isLocating ? 'wait' : 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {isLocating ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 2a10 10 0 0 1 10 10"></path>
              </svg>
              <span>Locating...</span>
            </>
          ) : isReady ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <circle cx="12" cy="12" r="3" fill="#10B981"></circle>
              </svg>
              <span>Location Found {gpsAccuracyMeters ? `(±${Math.round(gpsAccuracyMeters)}m)` : ''}</span>
            </>
          ) : isApprox ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <circle cx="12" cy="12" r="3" fill="#F59E0B"></circle>
              </svg>
              <span>Approximate Location {gpsAccuracyMeters ? `(±${Math.round(gpsAccuracyMeters)}m)` : ''}</span>
            </>
          ) : isDenied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>Location access is blocked • Try Again</span>
            </>
          ) : isTimeout ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>Location timed out • Try Again</span>
            </>
          ) : isUnavailable || isError ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>Location unavailable • Try Again</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <circle cx="12" cy="12" r="3" fill="var(--accent-primary)"></circle>
              </svg>
              <span>My Location</span>
            </>
          )}
        </button>

        {/* [ Choose on Map ] Fallback Action Button when Location is Blocked or Unavailable (Sections 3, 20) */}
        {(isDenied || isUnavailable || isTimeout) && (
          <button
            onClick={() => {
              useLocationStore.getState().setIsChoosingOnMap(true);
            }}
            data-testid="choose-on-map-button"
            title="Pick a location manually on the map"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: 'rgba(37, 99, 235, 0.08)',
              border: '1px solid rgba(37, 99, 235, 0.35)',
              borderRadius: 'var(--radius-md)',
              padding: '0 10px',
              height: '38px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#2563EB',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>Choose on Map</span>
          </button>
        )}



        {/* Radius Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--bg-app)', padding: '2px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Radius:</span>
          <select
            value={useLocationStore((s) => s.selectedRadiusKm)}
            onChange={(e) => useLocationStore.getState().setSelectedRadiusKm(Number(e.target.value) as any)}
            aria-label="Intelligence surveillance radius"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              outline: 'none',
              padding: '4px 2px',
            }}
          >
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
            <option value={100}>100 km</option>
            <option value={250}>250 km</option>
          </select>
        </div>

        {/* [ Live Data ] Provenance Indicator */}
        <div
          title="Data Provenance: Live Signals Synchronized (Open-Meteo, USGS, Google Maps, Municipal feeds)"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 10px',
            height: '34px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--accent-primary-light)',
            border: '1px solid rgba(37, 99, 235, 0.2)',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--accent-primary)',
            letterSpacing: '0.3px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-primary)',
              boxShadow: '0 0 6px rgba(37, 99, 235, 0.6)',
            }}
          />
          LIVE DATA
        </div>

        {/* [ Research Mode ] Workbench Toggle Button */}
        <button
          type="button"
          onClick={() => toggleResearchMode()}
          title={isResearchModeOpen ? 'Close Research Mode Workbench' : 'Open Research Mode Workbench (Multimodal Intelligence)'}
          aria-label="Toggle Research Mode Workbench"
          aria-pressed={isResearchModeOpen}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 12px',
            height: '34px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: isResearchModeOpen ? '#1E293B' : 'var(--bg-surface)',
            border: isResearchModeOpen ? '1px solid #3B82F6' : '1px solid var(--border-subtle)',
            fontSize: '11.5px',
            fontWeight: 700,
            color: isResearchModeOpen ? '#60A5FA' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: isResearchModeOpen ? '0 2px 8px rgba(30, 41, 59, 0.25)' : 'var(--shadow-xs)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 18h8"></path>
            <path d="M3 22h18"></path>
            <path d="M14 22a7 7 0 1 0-14 0"></path>
            <path d="M9 14h2"></path>
            <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"></path>
            <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"></path>
          </svg>
          <span>Research Mode</span>
          {isResearchModeOpen && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#60A5FA',
                boxShadow: '0 0 6px #60A5FA',
              }}
            />
          )}
        </button>
      </div>

      {/* Location Search Drawer Modal */}
      <LocationSearchDrawer />
    </header>
  );
}
