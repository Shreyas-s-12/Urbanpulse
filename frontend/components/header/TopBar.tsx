'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';
import { useLocationStore } from '@/stores/useLocationStore';
import { RawDeviceLocation } from '@shared/types';
import { locationService } from '@/services/locationService';
import LocationSearchDrawer from '@/components/location/LocationSearchDrawer';

export default function TopBar() {
  const {
    currentLocation,
    currentDeviceLocation,
    activeLocationMode,
    locationAccuracyState,
    gpsAccuracyMeters,
    setLocationAccuracyState,
    isResolvingLocation,
    setIsResolvingLocation,
    setSearchDrawerOpen,
    isHeatmapActive,
    toggleHeatmap,
  } = useLocationStore();

  // Initial detection on mount if no location set
  useEffect(() => {
    if (!currentLocation && !currentDeviceLocation) {
      handleLocateMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLocateMe = async () => {
    setIsResolvingLocation(true);
    setLocationAccuracyState('LOCATING');
    const seq = useLocationStore.getState().getNextSequenceNumber();

    try {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser.');
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const rawDev: RawDeviceLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy || 15,
            timestamp: pos.timestamp || Date.now(),
            source: 'BROWSER_GEOLOCATION',
          };

          const finalState = pos.coords.accuracy <= 75 ? 'LOCKED' : 'APPROXIMATE';
          useLocationStore.getState().validateAndSetDeviceLocation(rawDev, finalState, seq);

          // Asynchronously enrich with address context without overriding raw coords
          try {
            const meta = await locationService.reverseGeocodeMetadata(pos.coords.latitude, pos.coords.longitude);
            if (meta) {
              useLocationStore.getState().updateDeviceAddressMetadata(meta);
            }
          } catch {}

          setIsResolvingLocation(false);
        },
        (err) => {
          console.warn('Geolocation error:', err);
          setLocationAccuracyState('UNAVAILABLE');
          setIsResolvingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } catch (err) {
      console.warn('Geolocation unavailable:', err);
      setLocationAccuracyState('UNAVAILABLE');
      setIsResolvingLocation(false);
    }
  };

  const isLocating = isResolvingLocation || locationAccuracyState === 'LOCATING';
  const isLocked = activeLocationMode === 'DEVICE' && locationAccuracyState === 'LOCKED';
  const isApprox = activeLocationMode === 'DEVICE' && locationAccuracyState === 'APPROXIMATE';
  const isUnavailable = locationAccuracyState === 'UNAVAILABLE';

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
            flexShrink: 0,
            transition: 'opacity 0.15s ease',
            paddingRight: 'var(--space-1)',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* [ ◎ My Location ] Button */}
        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          aria-label="Use my current location"
          title={
            isLocating
              ? 'Acquiring GPS fix...'
              : isLocked && gpsAccuracyMeters
              ? `GPS locked within ±${Math.round(gpsAccuracyMeters)}m`
              : isUnavailable
              ? "Couldn't determine your location. Click to try again."
              : 'Detect my exact device location'
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: isLocked
              ? 'rgba(16, 185, 129, 0.08)'
              : isApprox
              ? 'rgba(245, 158, 11, 0.08)'
              : isUnavailable
              ? 'rgba(239, 68, 68, 0.06)'
              : 'var(--bg-app)',
            border: isLocked
              ? '1px solid rgba(16, 185, 129, 0.35)'
              : isApprox
              ? '1px solid rgba(245, 158, 11, 0.35)'
              : isUnavailable
              ? '1px solid rgba(239, 68, 68, 0.3)'
              : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0 12px',
            height: '38px',
            fontSize: '12px',
            fontWeight: 500,
            color: isLocked
              ? '#10B981'
              : isApprox
              ? '#F59E0B'
              : isUnavailable
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
          ) : isLocked ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <circle cx="12" cy="12" r="3" fill="#10B981"></circle>
              </svg>
              <span>My Location {gpsAccuracyMeters ? `(±${Math.round(gpsAccuracyMeters)}m)` : ''}</span>
            </>
          ) : isApprox ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <circle cx="12" cy="12" r="3" fill="#F59E0B"></circle>
              </svg>
              <span>Approx {gpsAccuracyMeters ? `±${Math.round(gpsAccuracyMeters)}m` : ''}</span>
            </>
          ) : isUnavailable ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>Location unavailable • Try again</span>
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

        {/* [ Intelligence Heatmap ] Toggle Button (Section 5, 7) */}
        <button
          onClick={toggleHeatmap}
          title="Toggle Intelligence Heatmap (Independent of GPS/Location permissions)"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: isHeatmapActive ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-app)',
            border: isHeatmapActive ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0 12px',
            height: '38px',
            fontSize: '12px',
            fontWeight: 600,
            color: isHeatmapActive ? '#D97706' : 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          <span>Intelligence Heatmap</span>
          <span
            style={{
              fontSize: '9.5px',
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: '4px',
              backgroundColor: isHeatmapActive ? '#D97706' : 'var(--border-subtle)',
              color: isHeatmapActive ? '#FFFFFF' : 'var(--text-muted)',
              letterSpacing: '0.4px',
            }}
          >
            {isHeatmapActive ? 'ON' : 'OFF'}
          </span>
        </button>

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
      </div>

      {/* Location Search Drawer Modal */}
      <LocationSearchDrawer />
    </header>
  );
}
