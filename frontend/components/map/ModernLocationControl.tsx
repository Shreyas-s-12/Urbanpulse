'use client';

import React, { useState } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { locationService } from '@/services/locationService';
import ModernLocationCard from './ModernLocationCard';

interface ModernLocationControlProps {
  onCenterMap: (coords: { latitude: number; longitude: number }) => void;
}

export default function ModernLocationControl({ onCenterMap }: ModernLocationControlProps) {
  const {
    currentDeviceLocation,
    mapFollowMode,
    setMapFollowMode,
    gpsAccuracyMeters,
    locationAccuracyState,
    switchToDeviceLocation,
  } = useLocationStore();

  const [showDetailsCard, setShowDetailsCard] = useState(false);

  const isLocating = locationAccuracyState === 'LOCATING' || locationAccuracyState === 'IMPROVING';
  const isFollowing = mapFollowMode === 'LOCKED_ON_USER';
  const accMeters = gpsAccuracyMeters ? Math.round(gpsAccuracyMeters) : null;

  const handleClick = async () => {
    if (currentDeviceLocation) {
      switchToDeviceLocation();
      onCenterMap({
        latitude: currentDeviceLocation.latitude,
        longitude: currentDeviceLocation.longitude,
      });

      if (isFollowing) {
        setMapFollowMode('EXPLORE');
      } else {
        setMapFollowMode('LOCKED_ON_USER');
      }
    } else {
      try {
        const loc = await locationService.requestDeviceLocation();
        switchToDeviceLocation();
        onCenterMap({
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
        setMapFollowMode('LOCKED_ON_USER');
      } catch (err) {
        console.warn('Acquisition error:', err);
      }
    }
  };

  const handleCenterOnMe = () => {
    if (currentDeviceLocation) {
      switchToDeviceLocation();
      onCenterMap({
        latitude: currentDeviceLocation.latitude,
        longitude: currentDeviceLocation.longitude,
      });
      setMapFollowMode('LOCKED_ON_USER');
    }
  };

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 34,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          pointerEvents: 'auto',
        }}
      >
        {/* Location Quality Chip (Section 17) */}
        {accMeters !== null && (
          <button
            type="button"
            onClick={() => setShowDetailsCard((prev) => !prev)}
            style={{
              height: '32px',
              padding: '0 10px',
              borderRadius: '16px',
              backgroundColor: 'var(--overlay-bg)',
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
              color: accMeters <= 25 ? '#059669' : accMeters <= 75 ? 'var(--accent-primary)' : '#D97706',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
            title="Click to view location quality and details"
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: accMeters <= 25 ? '#10B981' : accMeters <= 75 ? '#3B82F6' : '#F59E0B',
              }}
            />
            <span>±{accMeters}m</span>
          </button>
        )}

        {/* Compact Modern Control [ ◎ ] (Section 16) */}
        <button
          type="button"
          onClick={handleClick}
          aria-label="Center on my location"
          title={isFollowing ? 'Following your device movement (Tap to release)' : 'Center map on your device'}
          style={{
            height: '34px',
            width: '34px',
            borderRadius: '50%',
            backgroundColor: isFollowing ? 'var(--button)' : 'var(--overlay-bg)',
            backdropFilter: 'blur(10px)',
            border: isFollowing ? '1px solid var(--button-hover)' : '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)',
            color: isFollowing ? 'var(--button-foreground)' : 'var(--accent-primary)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            transition: 'all 0.15s ease',
            position: 'relative',
          }}
        >
          {/* Minimal Modern 2026 Target Icon [ ◎ ] */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8" />
            <line x1="12" y1="2" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22" />
            <line x1="2" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22" y2="12" />
            <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
          </svg>

          {isLocating && (
            <span
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '2px solid #3B82F6',
                animation: 'ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite',
              }}
            />
          )}
        </button>
      </div>

      {showDetailsCard && (
        <ModernLocationCard
          onClose={() => setShowDetailsCard(false)}
          onCenterOnMe={handleCenterOnMe}
        />
      )}
    </>
  );
}
