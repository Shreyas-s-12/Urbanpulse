'use client';

import React, { useRef, useEffect, useState } from 'react';
import { CloseIcon, ExpandIcon, CollapseIcon, StreetViewIcon } from '@/components/common/Icons';

interface StreetViewPanelProps {
  latitude: number;
  longitude: number;
  placeName?: string;
  onClose: () => void;
  isMobile?: boolean;
}

export default function StreetViewPanel({
  latitude,
  longitude,
  placeName,
  onClose,
  isMobile = false,
}: StreetViewPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [panoLocationName, setPanoLocationName] = useState<string>('');

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setAvailable(null);

    const checkAndInitStreetView = async () => {
      const gmaps = (window as any).google?.maps;
      if (!gmaps) {
        if (!isCancelled) {
          setAvailable(false);
          setLoading(false);
        }
        return;
      }

      try {
        const svService = new gmaps.StreetViewService();
        // Check for panorama within 100m radius of target coordinates
        svService.getPanorama(
          {
            location: { lat: latitude, lng: longitude },
            radius: 100,
            preference: gmaps.StreetViewPreference?.NEAREST || 'nearest',
          },
          (data: any, status: any) => {
            if (isCancelled) return;

            if (status === gmaps.StreetViewStatus.OK && data && data.location?.latLng) {
              setAvailable(true);
              setPanoLocationName(data.location.description || data.location.shortDescription || '');

              // Mount panorama
              if (containerRef.current) {
                try {
                  const pano = new gmaps.StreetViewPanorama(containerRef.current, {
                    position: data.location.latLng,
                    pov: { heading: 165, pitch: 0 },
                    zoom: 1,
                    addressControl: false,
                    fullscreenControl: false,
                    motionTracking: false,
                    motionTrackingControl: false,
                    enableCloseButton: false,
                  });
                  panoramaRef.current = pano;
                } catch (err) {
                  console.warn('[StreetViewPanel] Mount error:', err);
                  setAvailable(false);
                }
              }
            } else {
              setAvailable(false);
            }
            setLoading(false);
          }
        );
      } catch (err) {
        console.warn('[StreetViewPanel] Service check failed:', err);
        if (!isCancelled) {
          setAvailable(false);
          setLoading(false);
        }
      }
    };

    checkAndInitStreetView();

    return () => {
      isCancelled = true;
      if (panoramaRef.current) {
        try {
          panoramaRef.current.setVisible(false);
        } catch (e) {}
        panoramaRef.current = null;
      }
    };
  }, [latitude, longitude]);

  return (
    <div
      style={{
        position: 'absolute',
        ...(isMobile
          ? {
              bottom: 0,
              left: 0,
              right: 0,
              height: isExpanded ? '85%' : '50%',
              borderRadius: '16px 16px 0 0',
            }
          : {
              top: '16px',
              right: '16px',
              bottom: '16px',
              width: isExpanded ? '600px' : '400px',
              maxWidth: 'calc(100% - 32px)',
              borderRadius: '12px',
            }),
        zIndex: 40,
        backgroundColor: '#0F172A',
        border: '1px solid var(--border-subtle, #334155)',
        boxShadow: 'var(--shadow-panel, 0 10px 30px rgba(0, 0, 0, 0.25))',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          height: '44px',
          padding: '0 14px',
          backgroundColor: '#1E293B',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#F8FAFC',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <StreetViewIcon size={16} color="var(--accent-primary, #38BDF8)" />
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700 }}>
              {placeName ? `Street View: ${placeName}` : 'Street View Panorama'}
            </span>
            {panoLocationName && (
              <span style={{ fontSize: '10.5px', color: '#94A3B8', marginLeft: '6px' }}>
                ({panoLocationName})
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {!isMobile && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
              title={isExpanded ? 'Collapse panel' : 'Expand panel'}
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
              }}
            >
              {isExpanded ? <CollapseIcon size={14} color="#CBD5E1" /> : <ExpandIcon size={14} color="#CBD5E1" />}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Street View"
            title="Close Street View"
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
          >
            <CloseIcon size={16} color="#CBD5E1" />
          </button>
        </div>
      </div>

      {/* Street View Body Canvas Container */}
      <div style={{ position: 'relative', flex: 1, width: '100%', height: '100%', minHeight: '200px' }}>
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            display: available ? 'block' : 'none',
          }}
        />

        {/* Loading Spinner */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              backgroundColor: '#0F172A',
              color: '#94A3B8',
              fontSize: '12px',
            }}
          >
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: '2px solid var(--accent-primary, #38BDF8)',
                borderTopColor: 'transparent',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span>Checking Street View availability...</span>
          </div>
        )}

        {/* Honest Unavailable State */}
        {!loading && available === false && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '24px',
              textAlign: 'center',
              backgroundColor: '#0F172A',
              color: '#CBD5E1',
            }}
          >
            <StreetViewIcon size={32} color="#64748B" />
            <div style={{ fontSize: '13px', fontWeight: 700 }}>Street View imagery unavailable for this location.</div>
            <div style={{ fontSize: '11.5px', color: '#94A3B8', maxWidth: '300px', lineHeight: 1.4 }}>
              Google Street View panoramic 360° coverage has not been recorded within 100 meters of these coordinates.
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                marginTop: '8px',
                padding: '6px 14px',
                borderRadius: '6px',
                backgroundColor: 'var(--accent-primary, #2563EB)',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Return to Map
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
