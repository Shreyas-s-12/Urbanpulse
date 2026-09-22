'use client';

import React, { useState } from 'react';
import {
  PinIcon,
  StarIcon,
  CloseIcon,
  MessageSquareIcon,
  CarIcon,
  CompassIcon,
  InfoIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  StreetViewIcon,
} from '@/components/common/Icons';

export interface SelectedPlaceDetail {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  userRatingsTotal?: number;
  photos?: string[];
  types?: string[];
  googleUrl?: string;
  utcOffsetMinutes?: number;
  website?: string;
  formattedPhoneNumber?: string;
  viewport?: any;
}

interface PlaceDetailCardProps {
  place: SelectedPlaceDetail | null;
  onClose: () => void;
  onAskAgent?: (place: SelectedPlaceDetail) => void;
  onExploreTraffic?: (place: SelectedPlaceDetail) => void;
  onNearbyActivities?: (place: SelectedPlaceDetail) => void;
  onStreetView?: (place: SelectedPlaceDetail) => void;
}

export default function PlaceDetailCard({
  place,
  onClose,
  onAskAgent,
  onExploreTraffic,
  onNearbyActivities,
  onStreetView,
}: PlaceDetailCardProps) {
  const [imgError, setImgError] = useState(false);
  const [showKnowMore, setShowKnowMore] = useState(false);
  const [showActivitiesDrawer, setShowActivitiesDrawer] = useState(false);
  const [nearbyList, setNearbyList] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  if (!place) return null;

  const displayTypes = (place.types || [])
    .filter((t) => !['point_of_interest', 'establishment'].includes(t))
    .slice(0, 3)
    .map((t) => t.replace(/_/g, ' '));

  const hasPhoto = place.photos && place.photos.length > 0 && !imgError;

  const handleToggleActivities = () => {
    if (!showActivitiesDrawer && nearbyList.length === 0) {
      const placesLib = (window as any).google?.maps?.places;
      if (placesLib && typeof window !== 'undefined') {
        setLoadingActivities(true);
        try {
          const dummyDiv = document.createElement('div');
          const service = new placesLib.PlacesService(dummyDiv);
          service.nearbySearch(
            {
              location: new (window as any).google.maps.LatLng(place.latitude, place.longitude),
              radius: 2500,
              type: ['tourist_attraction', 'point_of_interest', 'museum', 'park', 'cafe', 'restaurant'],
            },
            (results: any, status: any) => {
              setLoadingActivities(false);
              if (status === placesLib.PlacesServiceStatus.OK && Array.isArray(results)) {
                setNearbyList(results.slice(0, 5));
              }
            }
          );
        } catch (e) {
          setLoadingActivities(false);
        }
      }
    }
    setShowActivitiesDrawer(!showActivitiesDrawer);
    onNearbyActivities?.(place);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '64px',
        left: '16px',
        width: '320px',
        maxWidth: 'calc(100% - 32px)',
        backgroundColor: 'var(--overlay-bg)',
        backdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-panel)',
        zIndex: 35,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* Photos Preview Banner if available */}
      {hasPhoto && (
        <div
          style={{
            width: '100%',
            height: '110px',
            position: 'relative',
            backgroundColor: 'var(--bg-surface-secondary)',
            overflow: 'hidden',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={place.photos![0]}
            alt={place.name}
            loading="lazy"
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(15,23,42,0.6) 0%, transparent 60%)',
            }}
          />
          <span
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '10px',
              fontSize: '10px',
              fontWeight: 700,
              color: '#FFFFFF',
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              padding: '2px 6px',
              borderRadius: '4px',
              letterSpacing: '0.4px',
            }}
          >
            GOOGLE PLACES VERIFIED
          </span>
        </div>
      )}

      {/* Header & Close */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: 0,
                lineHeight: 1.25,
              }}
            >
              {place.name}
            </h3>
            {place.rating !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                <StarIcon size={13} color="#F59E0B" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {place.rating.toFixed(1)}
                </span>
                {place.userRatingsTotal && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    ({place.userRatingsTotal.toLocaleString()})
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close place card"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
          >
            <CloseIcon size={15} />
          </button>
        </div>

        {/* Address */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', marginTop: '2px' }}>
          <PinIcon size={12} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
            {place.address}
          </span>
        </div>

        {/* Category Badges */}
        {displayTypes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
            {displayTypes.map((t, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '9.5px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onAskAgent?.(place)}
            style={{
              flex: '1 1 auto',
              height: '30px',
              borderRadius: '6px',
              backgroundColor: 'var(--accent-primary)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              transition: 'background-color 0.15s ease',
              padding: '0 8px',
              whiteSpace: 'nowrap',
            }}
          >
            <MessageSquareIcon size={12} color="#FFFFFF" />
            <span>Ask Agent</span>
          </button>

          {onExploreTraffic && (
            <button
              type="button"
              onClick={() => onExploreTraffic(place)}
              title="View live traffic on map"
              style={{
                height: '30px',
                padding: '0 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              <CarIcon size={12} color="var(--accent-primary)" />
              <span>Traffic</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleActivities}
            title="Explore nearby activities"
            style={{
              height: '30px',
              padding: '0 8px',
              borderRadius: '6px',
              backgroundColor: showActivitiesDrawer ? 'var(--accent-primary-light, #EFF6FF)' : 'var(--bg-app)',
              color: showActivitiesDrawer ? 'var(--accent-primary, #2563EB)' : 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            <CompassIcon size={12} color="var(--accent-primary)" />
            <span>Activities</span>
          </button>

          {onStreetView && (
            <button
              type="button"
              onClick={() => onStreetView(place)}
              title="Open Google Street View"
              style={{
                height: '30px',
                padding: '0 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              <StreetViewIcon size={12} color="var(--accent-primary)" />
              <span>Street View</span>
            </button>
          )}
        </div>

        {/* Real Google Places Nearby Activities Drawer */}
        {showActivitiesDrawer && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              VERIFIED NEARBY ACTIVITIES
            </span>

            {loadingActivities && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Finding nearby places...</span>
            )}

            {!loadingActivities && nearbyList.length === 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No verified nearby places found.</span>
            )}

            {nearbyList.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  padding: '4px 0',
                  borderBottom: idx < nearbyList.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </div>
                  {item.rating && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Rating: {item.rating} / 5
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (item.geometry?.location) {
                      onAskAgent?.({
                        placeId: item.place_id || '',
                        name: item.name,
                        address: item.vicinity || '',
                        latitude: item.geometry.location.lat(),
                        longitude: item.geometry.location.lng(),
                        rating: item.rating,
                        types: item.types || [],
                      });
                    }
                  }}
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Ask
                </button>
              </div>
            ))}
          </div>
        )}


        {/* Know More contextual toggle */}
        <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
          <button
            type="button"
            onClick={() => setShowKnowMore(!showKnowMore)}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px 0',
              fontSize: '10.5px',
              fontWeight: 600,
              color: 'var(--accent-primary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <InfoIcon size={11} color="var(--accent-primary)" />
            <span>{showKnowMore ? 'Hide place details' : 'Know more'}</span>
            <ChevronDownIcon
              size={11}
              style={{
                transform: showKnowMore ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>

          {showKnowMore && (
            <div
              style={{
                marginTop: '6px',
                padding: '8px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Coordinates: </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
                </span>
              </div>
              {place.placeId && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Place ID: </span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '10px' }}>
                    {place.placeId}
                  </span>
                </div>
              )}
              {place.formattedPhoneNumber && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Phone: </span>
                  <span style={{ color: 'var(--text-primary)' }}>{place.formattedPhoneNumber}</span>
                </div>
              )}
              <div style={{ marginTop: '4px' }}>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + place.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    color: 'var(--accent-primary)',
                    textDecoration: 'none',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <ExternalLinkIcon size={10} color="var(--accent-primary)" />
                  <span>View on Google Maps</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
