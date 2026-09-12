'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { locationService } from '@/services/locationService';
import { IntelligenceRadiusKm, ResolvedLocation } from '@shared/types';

export default function TopBar() {
  const {
    currentLocation,
    setCurrentLocation,
    selectedRadiusKm,
    setSelectedRadiusKm,
    mode,
    setMode,
    isResolvingLocation,
    setIsResolvingLocation,
  } = useLocationStore();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ResolvedLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await locationService.searchLocation(query);
      setSuggestions(results);
      setIsSearching(false);
      setShowDropdown(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Request location on first load if null
  useEffect(() => {
    if (!currentLocation) {
      handleLocateMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLocateMe = async () => {
    setIsResolvingLocation(true);
    try {
      const loc = await locationService.requestDeviceLocation();
      setCurrentLocation(loc);
    } catch (err) {
      console.warn('Geolocation unavailable or denied:', err);
      // Do NOT hardcode Bengaluru. Remain null so user is prompted to search for a location.
    } finally {
      setIsResolvingLocation(false);
    }
  };

  const handleSelectLocation = (loc: ResolvedLocation) => {
    setCurrentLocation(loc);
    setQuery('');
    setShowDropdown(false);
  };

  const radii: IntelligenceRadiusKm[] = [5, 10, 25, 50, 100, 250];

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        gap: '16px',
        zIndex: 40,
        boxShadow: 'var(--shadow-sm)',
        flexShrink: 0,
      }}
    >
      {/* Search & Location Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', maxWidth: '540px' }} ref={searchRef}>
        <div style={{ position: 'relative', width: '100%' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-app)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              padding: '0 12px',
              height: '40px',
              gap: '8px',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder={currentLocation ? `Search city, address, or coords (Now: ${currentLocation.city})` : 'Search your city, address, or coords worldwide...'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowDropdown(true);
              }}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: '13px',
                color: 'var(--text-primary)',
              }}
            />
            {isSearching && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Searching...</span>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '46px',
                left: 0,
                right: 0,
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-panel)',
                padding: '6px 0',
                zIndex: 100,
                maxHeight: '280px',
                overflowY: 'auto',
              }}
            >
              {suggestions.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectLocation(item)}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-app)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.city}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.displayName}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GPS Locate Button */}
        <button
          onClick={handleLocateMe}
          disabled={isResolvingLocation}
          title="Detect Current GPS Location"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '0 12px',
            height: '40px',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
          </svg>
          {isResolvingLocation ? 'Detecting...' : 'My Location'}
        </button>
      </div>

      {/* Center: Radial Intelligence Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-app)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          padding: '3px',
          gap: '2px',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', padding: '0 8px' }}>
          RADIUS
        </span>
        {radii.map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRadiusKm(r)}
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--radius-xs)',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: selectedRadiusKm === r ? 'var(--bg-surface)' : 'transparent',
              color: selectedRadiusKm === r ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: selectedRadiusKm === r ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {r} km
          </button>
        ))}
      </div>

      {/* Right: Primary Operating Mode Toggle & Provenance */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Mode Toggle */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-app)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            padding: '3px',
          }}
        >
          <button
            onClick={() => setMode('explore')}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-xs)',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: mode === 'explore' ? 'var(--accent-primary)' : 'transparent',
              color: mode === 'explore' ? '#FFFFFF' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            EXPLORE AROUND ME
          </button>
          <button
            onClick={() => setMode('journey')}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-xs)',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: mode === 'journey' ? 'var(--accent-blue)' : 'transparent',
              color: mode === 'journey' ? '#FFFFFF' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            PLAN A JOURNEY
          </button>
        </div>

        {/* Data Source Indicator */}
        <div
          title="Data Provenance: Live Signals Synchronized (Open-Meteo, USGS, Google Maps, Municipal feeds)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--accent-primary-light)',
            border: '1px solid rgba(19, 184, 135, 0.3)',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--accent-primary)',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-primary)',
            }}
          />
          LIVE DATA
        </div>
      </div>
    </header>
  );
}
