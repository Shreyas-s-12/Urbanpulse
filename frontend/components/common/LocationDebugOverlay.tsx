'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLocationStore, haversineDistanceMeters } from '@/stores/useLocationStore';
import { locationService, getAccuracyTier } from '@/services/locationService';
import { RawDeviceLocation } from '@shared/types';
import { MAP_SAFE_AREAS } from '@/components/map/overlaySafeArea';

export default function LocationDebugOverlay() {
  const {
    currentLocation,
    currentDeviceLocation,
    activeLocationMode,
    activeSource,
    locationAccuracyState,
    gpsAccuracyMeters,
    gpsTimestamp,
    locationSequenceNumber,
    overrideBlockCount,
    isLiveTracking,
    setIsLiveTracking,
    validateAndSetDeviceLocation,
    switchToDeviceLocation,
    setLocationAccuracyState,
    setIsResolvingLocation,
  } = useLocationStore();

  const [isOpen, setIsOpen] = useState(false);
  const [ageSeconds, setAgeSeconds] = useState<number>(0);
  const liveTrackingStopRef = useRef<(() => void) | null>(null);

  // Update fix age in real time
  useEffect(() => {
    const interval = setInterval(() => {
      if (gpsTimestamp) {
        setAgeSeconds(Math.max(0, Math.floor((Date.now() - gpsTimestamp) / 1000)));
      } else {
        setAgeSeconds(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [gpsTimestamp]);

  // Clean up live tracking on unmount
  useEffect(() => {
    return () => {
      if (liveTrackingStopRef.current) {
        liveTrackingStopRef.current();
        liveTrackingStopRef.current = null;
      }
    };
  }, []);



  // Show in dev mode or if window is in local test
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) return null;

  // Telemetry Calculations
  const deviceLat = currentDeviceLocation?.latitude ?? null;
  const deviceLon = currentDeviceLocation?.longitude ?? null;
  const mapLat = currentLocation?.latitude ?? null;
  const mapLon = currentLocation?.longitude ?? null;

  // Actual map instance and marker coordinates
  const gmap = typeof window !== 'undefined' ? (window as any).__UP_GMAP_INSTANCE__ : null;
  const userMarker = typeof window !== 'undefined' ? (window as any).__UP_USER_MARKER__ : null;

  const gmapCenter = gmap?.getCenter?.();
  const actualMapLat = gmapCenter ? gmapCenter.lat() : mapLat;
  const actualMapLon = gmapCenter ? gmapCenter.lng() : mapLon;

  const markerPos = userMarker?.getPosition?.();
  const actualMarkerLat = markerPos ? markerPos.lat() : (activeLocationMode === 'DEVICE' ? deviceLat : mapLat);
  const actualMarkerLon = markerPos ? markerPos.lng() : (activeLocationMode === 'DEVICE' ? deviceLon : mapLon);

  const revGeoCoord = currentDeviceLocation?.addressMetadata?.reverseGeocodeCoordinate;
  const formattedAddress = currentDeviceLocation?.addressMetadata?.formattedAddress || currentLocation?.displayName || 'None';

  // Distance calculations
  const rawToFinalDist =
    deviceLat !== null && deviceLon !== null && mapLat !== null && mapLon !== null
      ? haversineDistanceMeters(deviceLat, deviceLon, mapLat, mapLon)
      : null;

  const finalToMapDist =
    mapLat !== null && mapLon !== null && actualMapLat !== null && actualMapLon !== null
      ? haversineDistanceMeters(mapLat, mapLon, actualMapLat, actualMapLon)
      : null;

  const finalToMarkerDist =
    mapLat !== null && mapLon !== null && actualMarkerLat !== null && actualMarkerLon !== null
      ? haversineDistanceMeters(mapLat, mapLon, actualMarkerLat, actualMarkerLon)
      : null;

  const currentTier = gpsAccuracyMeters !== null ? getAccuracyTier(gpsAccuracyMeters) : 'UNKNOWN';

  const tierColor =
    currentTier === 'EXCELLENT'
      ? '#10B981'
      : currentTier === 'GOOD'
      ? '#3B82F6'
      : currentTier === 'MODERATE'
      ? '#F59E0B'
      : currentTier === 'LOW'
      ? '#EA580C'
      : '#EF4444';

  const handleToggleLiveTracking = () => {
    if (isLiveTracking) {
      if (liveTrackingStopRef.current) {
        liveTrackingStopRef.current();
        liveTrackingStopRef.current = null;
      }
      setIsLiveTracking(false);
    } else {
      const stop = locationService.startLiveTracking((loc: RawDeviceLocation) => {
        validateAndSetDeviceLocation(loc, 'LOCKED');
      });
      liveTrackingStopRef.current = stop;
      setIsLiveTracking(true);
      switchToDeviceLocation();
    }
  };

  const handleSimulateAccuracyTier = (acc: number) => {
    if (!currentDeviceLocation) {
      alert('Please acquire GPS location first before simulating accuracy variance.');
      return;
    }
    const simulated: RawDeviceLocation = {
      ...currentDeviceLocation,
      accuracyMeters: acc,
      timestamp: Date.now(),
    };
    validateAndSetDeviceLocation(simulated, acc <= 75 ? 'LOCKED' : 'APPROXIMATE');
  };

  const handleLiveAcquire = async () => {
    setIsResolvingLocation(true);
    setLocationAccuracyState('LOCATING');
    try {
      const loc = await locationService.requestDeviceLocation({
        onRawAcquired: (raw) => {
          validateAndSetDeviceLocation(raw, 'IMPROVING');
        },
        onProgress: (st) => setLocationAccuracyState(st),
      });
      const finalState = loc.accuracyTier === 'EXCELLENT' || loc.accuracyTier === 'GOOD' ? 'LOCKED' : 'APPROXIMATE';
      validateAndSetDeviceLocation(
        {
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracyMeters: loc.accuracy ?? 15,
          timestamp: loc.timestamp || Date.now(),
          source: 'BROWSER_GEOLOCATION',
        },
        finalState
      );
      switchToDeviceLocation();
    } catch (e) {
      console.warn('Live acquire failed:', e);
      setLocationAccuracyState('UNAVAILABLE');
    } finally {
      setIsResolvingLocation(false);
    }
  };

  return (
    <aside
      aria-label="Location Diagnostics"
      style={{
        position: 'fixed',
        bottom: MAP_SAFE_AREAS.DEBUG_HUD.bottom,
        left: MAP_SAFE_AREAS.DEBUG_HUD.left,
        transform: MAP_SAFE_AREAS.DEBUG_HUD.transform,
        zIndex: MAP_SAFE_AREAS.DEBUG_HUD.zIndex,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      }}

    >
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--overlay-bg)',
            color: 'var(--text-primary)',
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--control-shadow)',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: tierColor,
              display: 'inline-block',
            }}
          />
          <span>
            GPS HUD:{' '}
            <strong style={{ color: tierColor }}>
              {gpsAccuracyMeters ? `±${Math.round(gpsAccuracyMeters)}m` : 'NO FIX'}
            </strong>{' '}
            [{activeLocationMode}]
          </span>
        </button>
      ) : (
        <div
          style={{
            width: '380px',
            backgroundColor: 'var(--bg-panel)',
            color: 'var(--text-primary)',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-panel)',
            padding: '14px',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700, letterSpacing: '0.5px', color: '#60A5FA' }}>
                RULE 35 ACCURACY DIAGNOSTICS HUD
              </span>
              {isLiveTracking && (
                <span
                  style={{
                    fontSize: '9px',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    backgroundColor: '#10B981',
                    color: '#000',
                    fontWeight: 700,
                  }}
                >
                  LIVE TRACKING
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0 4px',
              }}
              aria-label="Close"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Telemetry Grid (Exact Rule 35 & Section 34 specifications) */}
          <div style={{ display: 'grid', gridTemplateColumns: '145px 1fr', gap: '5px', lineHeight: '1.4' }}>
            <span style={{ color: 'var(--text-secondary)' }}>PERMISSION:</span>
            <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
              {(typeof window !== 'undefined' && (window as any).__UP_LOCATION_STORE__?.getState()?.permissionStatus) || 'unknown'}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>SUPPORTED:</span>
            <span style={{ color: typeof window !== 'undefined' && 'geolocation' in navigator ? 'var(--status-good-text)' : 'var(--status-critical-text)' }}>
              {typeof window !== 'undefined' && 'geolocation' in navigator ? 'YES' : 'NO'}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>SECURE CONTEXT:</span>
            <span style={{ color: typeof window !== 'undefined' && window.isSecureContext ? 'var(--status-good-text)' : 'var(--status-critical-text)' }}>
              {typeof window !== 'undefined' && window.isSecureContext ? 'YES' : 'NO'}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>MAP / MARKER READY:</span>
            <span style={{ color: gmap ? 'var(--status-good-text)' : 'var(--status-warning-text)' }}>
              Map: {gmap ? 'YES' : 'NO'} | Marker: {userMarker ? 'YES' : 'NO'}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>RAW (DEVICE) LAT/LNG:</span>
            <span style={{ fontWeight: 600, color: 'var(--cyan)', wordBreak: 'break-all' }}>
              {deviceLat !== null && deviceLon !== null
                ? `${deviceLat.toFixed(6)}, ${deviceLon.toFixed(6)}`
                : 'NOT ACQUIRED'}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>FINAL (STORE) LAT/LNG:</span>
            <span style={{ wordBreak: 'break-all', color: 'var(--text-primary)' }}>
              {mapLat !== null && mapLon !== null
                ? `${mapLat.toFixed(6)}, ${mapLon.toFixed(6)}`
                : 'NOT SET'}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>MAP CENTER LAT/LNG:</span>
            <span style={{ wordBreak: 'break-all', color: 'var(--badge-info-text)' }}>
              {actualMapLat !== null && actualMapLon !== null
                ? `${actualMapLat.toFixed(6)}, ${actualMapLon.toFixed(6)}`
                : 'NOT SET'}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>MARKER LAT/LNG:</span>
            <span style={{ wordBreak: 'break-all', color: 'var(--status-good-text)' }}>
              {actualMarkerLat !== null && actualMarkerLon !== null
                ? `${actualMarkerLat.toFixed(6)}, ${actualMarkerLon.toFixed(6)}`
                : 'NO MARKER'}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>RAW → FINAL DIST:</span>
            <span style={{ fontWeight: 700, color: rawToFinalDist !== null && rawToFinalDist < 0.05 ? 'var(--status-good-text)' : 'var(--status-warning-text)' }}>
              {rawToFinalDist !== null ? `${rawToFinalDist.toFixed(3)} m` : 'N/A'}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>FINAL → MAP DIST:</span>
            <span style={{ fontWeight: 700, color: finalToMapDist !== null && finalToMapDist < 0.05 ? 'var(--status-good-text)' : 'var(--status-warning-text)' }}>
              {finalToMapDist !== null ? `${finalToMapDist.toFixed(3)} m` : 'N/A'}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>FINAL → MARKER DIST:</span>
            <span style={{ fontWeight: 700, color: finalToMarkerDist !== null && finalToMarkerDist < 0.05 ? 'var(--status-good-text)' : 'var(--status-critical-text)' }}>
              {finalToMarkerDist !== null ? `${finalToMarkerDist.toFixed(3)} m` : 'N/A'}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>REVERSE GEOCODE:</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={formattedAddress}>
              {formattedAddress}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>REV GEO COORD:</span>
            <span style={{ wordBreak: 'break-all', color: 'var(--status-warning-text)' }}>
              {revGeoCoord ? `${revGeoCoord.latitude.toFixed(6)}, ${revGeoCoord.longitude.toFixed(6)}` : 'None (No drift)'}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>ACTIVE MODE:</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
              {activeLocationMode} ({activeSource})
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>ACCURACY / TIER:</span>
            <span style={{ fontWeight: 700, color: tierColor }}>
              {gpsAccuracyMeters ? `±${gpsAccuracyMeters.toFixed(1)}m (${currentTier})` : 'N/A'}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>FIX AGE / STATUS:</span>
            <span style={{ color: ageSeconds > 60 ? 'var(--status-critical-text)' : 'var(--text-primary)' }}>
              {ageSeconds}s ({locationAccuracyState})
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>SEQUENCE / BLOCKS:</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Seq #{locationSequenceNumber} | Blocked: {overrideBlockCount}
            </span>
          </div>

          {/* Quick Actions & Live Tracking */}
          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                onClick={handleToggleLiveTracking}
                style={{
                  backgroundColor: isLiveTracking ? 'var(--status-critical-text)' : 'var(--status-good-text)',
                  border: 'none',
                  color: 'var(--button-foreground)',
                  borderRadius: '4px',
                  padding: '6px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isLiveTracking ? 'Stop Live GPS Track' : 'Start Live GPS Track'}
              </button>

              <button
                onClick={handleLiveAcquire}
                style={{
                  backgroundColor: 'var(--button)',
                  border: 'none',
                  color: 'var(--button-foreground)',
                  borderRadius: '4px',
                  padding: '6px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Locate Me (One-Shot)
              </button>
            </div>

            {/* Simulated Accuracy Levels for Verification */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Test Tiers:</span>
              <button
                onClick={() => handleSimulateAccuracyTier(12)}
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--status-good-border)',
                  color: 'var(--status-good-text)',
                  borderRadius: '3px',
                  padding: '3px 6px',
                  fontSize: '9px',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                12m (High)
              </button>
              <button
                onClick={() => handleSimulateAccuracyTier(50)}
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--badge-info-border)',
                  color: 'var(--badge-info-text)',
                  borderRadius: '3px',
                  padding: '3px 6px',
                  fontSize: '9px',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                50m (Good)
              </button>
              <button
                onClick={() => handleSimulateAccuracyTier(200)}
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--status-warning-border)',
                  color: 'var(--status-warning-text)',
                  borderRadius: '3px',
                  padding: '3px 6px',
                  fontSize: '9px',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                200m (Approx)
              </button>
              <button
                onClick={() => handleSimulateAccuracyTier(600)}
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--status-critical-border)',
                  color: 'var(--status-critical-text)',
                  borderRadius: '3px',
                  padding: '3px 6px',
                  fontSize: '9px',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                600m (Low)
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
