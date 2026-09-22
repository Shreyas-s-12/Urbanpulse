'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { locationService } from '@/services/locationService';
import {
  locationSearchService,
  AutocompleteResultItem,
} from '@/services/location/locationSearchService';
import { SelectedSearchLocation, SavedFavoriteLocation } from '@shared/types';

export default function LocationSearchDrawer() {
  const {
    isSearchDrawerOpen,
    setSearchDrawerOpen,
    currentDeviceLocation,
    currentLocation,
    activeLocationMode,
    switchToDeviceLocation,
    setSelectedSearchLocation,
    setIsChoosingOnMap,
    recentLocations,
    clearRecentLocations,
    savedFavorites,
    addFavoriteLocation,
    removeFavoriteLocation,
    locationAccuracyState,
    gpsAccuracyMeters,
  } = useLocationStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AutocompleteResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const searchSeqRef = useRef<number>(0);

  // Focus input when opened
  useEffect(() => {
    if (isSearchDrawerOpen) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
      setSelectedIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isSearchDrawerOpen]);

  // Handle escape key and click outside
  useEffect(() => {
    if (!isSearchDrawerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchDrawerOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setSearchDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchDrawerOpen, setSearchDrawerOpen]);

  // Debounced autocomplete query with sequence protection against stale responses
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setResults([]);
      setIsSearching(false);
      setHasSearched(false);
      setSelectedIndex(-1);
      return;
    }

    setIsSearching(true);
    const currentSeq = ++searchSeqRef.current;

    const timer = setTimeout(async () => {
      try {
        const items = await locationSearchService.autocomplete(q, {
          latitude: currentDeviceLocation?.latitude ?? currentLocation?.latitude,
          longitude: currentDeviceLocation?.longitude ?? currentLocation?.longitude,
          countryCode: currentDeviceLocation?.addressMetadata?.countryCode ?? currentLocation?.countryCode ?? undefined,
        });
        if (currentSeq === searchSeqRef.current) {
          setResults(items);
          setIsSearching(false);
          setHasSearched(true);
          setSelectedIndex(-1);
        }
      } catch {
        if (currentSeq === searchSeqRef.current) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, currentDeviceLocation, currentLocation]);

  const handleSelectResult = async (item: AutocompleteResultItem) => {
    try {
      const details = await locationSearchService.getPlaceDetails(item.placeId);
      if (details) {
        setSelectedSearchLocation(details);
      }
    } catch (err) {
      console.warn('Failed to load place details:', err);
    }
  };

  const handleSelectRecentOrFavorite = (loc: SelectedSearchLocation) => {
    setSelectedSearchLocation(loc);
  };

  const handleUseCurrentLocation = async () => {
    if (currentDeviceLocation) {
      switchToDeviceLocation();
      setSearchDrawerOpen(false);
    } else {
      try {
        await locationService.requestDeviceLocation();
        switchToDeviceLocation();
        setSearchDrawerOpen(false);
      } catch (err) {
        console.warn('Could not acquire device location:', err);
      }
    }
  };

  const handleChooseOnMap = () => {
    setIsChoosingOnMap(true);
    setSearchDrawerOpen(false);
  };

  // Keyboard navigation
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectResult(results[selectedIndex]);
      } else if (results.length > 0) {
        handleSelectResult(results[0]);
      }
    }
  };

  if (!isSearchDrawerOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--overlay-backdrop)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '68px',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        ref={drawerRef}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: 'calc(85vh - 70px)',
          backgroundColor: 'var(--bg-panel)',
          color: 'var(--text-primary)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-panel)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-muted)' }}>
              WHERE TO?
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSearchDrawerOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close (Esc)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Search Input Box */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-input)',
              borderRadius: '12px',
              border: '1.5px solid var(--input-border)',
              padding: '0 14px',
              height: '46px',
              gap: '10px',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>

            <input
              ref={inputRef}
              type="text"
              placeholder="Search city, area, street or address"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: '14px',
                color: 'var(--text-primary)',
                fontWeight: 500,
              }}
            />

            {isSearching && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
                Searching...
              </span>
            )}

            {query && !isSearching && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  inputRef.current?.focus();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '2px',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Primary Equal Quick Actions (Section 66, 87, 88, 99) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            padding: '12px 20px',
            backgroundColor: 'var(--bg-subtle)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {/* Option 1: Use My Location */}
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-card)',
              border: activeLocationMode === 'DEVICE' ? '1.5px solid var(--accent-primary)' : '1px solid var(--border)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
                flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="8"></circle>
                <line x1="12" y1="2" x2="12" y2="4"></line>
                <line x1="12" y1="20" x2="12" y2="22"></line>
                <line x1="2" y1="12" x2="4" y2="12"></line>
                <line x1="20" y1="12" x2="22" y2="12"></line>
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Use my location
              </span>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                {gpsAccuracyMeters ? `±${Math.round(gpsAccuracyMeters)}m accuracy` : 'Device GPS position'}
              </span>
            </div>
          </button>

          {/* Option 2: Choose on map */}
          <button
            type="button"
            onClick={handleChooseOnMap}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-surface-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Choose on map
              </span>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                Tap or click any exact spot
              </span>
            </div>
          </button>
        </div>

        {/* Scrollable Results & History Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {/* Query Active: Render Autocomplete Results */}
          {query.trim().length >= 2 ? (
            <div>
              {results.length > 0 ? (
                <div>
                  <div style={{ padding: '6px 20px 4px', fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                    SEARCH RESULTS
                  </div>
                  {results.map((item, idx) => (
                    <button
                      key={item.placeId || idx}
                      type="button"
                      onClick={() => handleSelectResult(item)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 20px',
                        background: selectedIndex === idx ? 'var(--bg-card-hover)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            flexShrink: 0,
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                          </svg>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.primaryText}
                          </span>
                          {item.secondaryText && (
                            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                              {item.secondaryText}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Category Badge */}
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: 'var(--text-secondary)',
                          backgroundColor: 'var(--bg-surface-secondary)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          letterSpacing: '0.4px',
                          flexShrink: 0,
                        }}
                      >
                        {item.categoryType}
                      </span>
                    </button>
                  ))}
                </div>
              ) : hasSearched && !isSearching ? (
                /* Location Not Found State (Section 91) */
                <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--status-critical-bg)',
                      color: 'var(--status-critical-text)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Location not found
                  </h4>
                  <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-muted)', maxWidth: '340px', marginInline: 'auto' }}>
                    We could not resolve &ldquo;{query}&rdquo;. Check spelling, try a broader area, or choose a point on the map.
                  </p>
                  <button
                    type="button"
                    onClick={handleChooseOnMap}
                    style={{
                      backgroundColor: 'var(--badge-info-bg)',
                      color: 'var(--badge-info-text)',
                      border: '1px solid var(--badge-info-border)',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      Choose on map instead
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            /* Query Empty: Render Favorites and Recent Searches */
            <div>
              {/* Saved Places (Section 76) */}
              {savedFavorites.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ padding: '6px 20px 4px', fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                    SAVED PLACES
                  </div>
                  {savedFavorites.map((fav) => (
                    <button
                      key={fav.id}
                      type="button"
                      onClick={() =>
                        handleSelectRecentOrFavorite({
                          latitude: fav.latitude,
                          longitude: fav.longitude,
                          displayName: fav.displayName,
                          formattedAddress: fav.formattedAddress,
                          placeId: fav.placeId,
                          categoryType: fav.categoryType,
                          source: 'SEARCH',
                        })
                      }
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 20px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent-primary-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent-primary)',
                            flexShrink: 0,
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                          </svg>
                        </div>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                            {fav.customName || fav.label}
                          </span>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            {fav.displayName}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFavoriteLocation(fav.id);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        title="Remove saved place"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </button>
                  ))}
                </div>
              )}

              {/* Recent Searches (Section 75) */}
              {recentLocations.length > 0 && (
                <div>
                  <div
                    style={{
                      padding: '6px 20px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                      RECENT SEARCHES
                    </span>
                    <button
                      type="button"
                      onClick={clearRecentLocations}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  {recentLocations.map((rec, idx) => (
                    <button
                      key={rec.placeId || idx}
                      type="button"
                      onClick={() => handleSelectRecentOrFavorite(rec)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 20px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--bg-card)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {rec.displayName}
                        </span>
                        {rec.formattedAddress && (
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            {rec.formattedAddress}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Empty state when no recents or favorites */}
              {savedFavorites.length === 0 && recentLocations.length === 0 && (
                <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Type a city, neighborhood, or street above, or choose a point on the map.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
