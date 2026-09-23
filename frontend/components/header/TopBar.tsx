'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';
import { useLocationStore } from '@/stores/useLocationStore';
import { RawDeviceLocation } from '@shared/types';
import { locationService } from '@/services/locationService';
import LocationSearchDrawer from '@/components/location/LocationSearchDrawer';
import { useResearchStore } from '@/stores/useResearchStore';
import { ROUTES } from '@/lib/routes';
import LanguageSelector from '@/components/common/LanguageSelector';
import UserProfileMenu from '@/components/common/UserProfileMenu';
import { useLanguage } from '@/context/LanguageContext';

export default function TopBar() {
  const pathname = usePathname();
  const { t } = useLanguage();
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
      role="banner"
      style={{
        height: '64px',
        backgroundColor: 'var(--bg-header, #FFFFFF)',
        borderBottom: '1px solid var(--border, #E2E7EF)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 18px',
        gap: '12px',
        zIndex: 40,
        flexShrink: 0,
      }}
    >
      {/* Left: Brand & Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1', maxWidth: '480px' }}>
        <Link
          href={ROUTES.home}
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

        {/* Search City, Address or Place Trigger (Target: 40px height, 280-360px desktop width) */}
        <div
          style={{ position: 'relative', width: '100%', maxWidth: '340px', cursor: 'pointer' }}
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
              backgroundColor: 'var(--bg-input, #F9FAFC)',
              borderRadius: 'var(--radius-md, 8px)',
              border: '1px solid var(--border, #E2E7EF)',
              padding: '0 14px',
              height: '40px',
              gap: '10px',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-hover, #CBD5E1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border, #E2E7EF)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #7B8798)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', fontSize: '13.5px' }}>
              <span style={{ color: currentLocation ? 'var(--text-primary, #172033)' : 'var(--text-muted, #7B8798)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentLocation
                  ? `${currentLocation.city || currentLocation.displayName}`
                  : 'Search city, address or place'}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: activeLocationMode === 'DEVICE' ? 'var(--accent-primary, #2563EB)' : 'var(--text-muted, #7B8798)',
                  backgroundColor: activeLocationMode === 'DEVICE' ? 'var(--accent-primary-light, #EFF6FF)' : 'var(--bg-subtle, #F3F6FA)',
                  border: '1px solid var(--border-subtle, #EDF0F4)',
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

      {/* Center Navigation: Home, Updates, Analytics, Simulate */}
      <nav
        aria-label="Primary Navigation"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: 'var(--bg-subtle, #F9FAFC)',
          padding: '3px 4px',
          borderRadius: '8px',
          border: '1px solid var(--border, #E2E7EF)',
          height: '38px',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <Link
          href={ROUTES.home}
          style={{
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: pathname === ROUTES.overview || pathname === ROUTES.root ? 700 : 500,
            borderRadius: '6px',
            textDecoration: 'none',
            color: pathname === ROUTES.overview || pathname === ROUTES.root ? 'var(--accent-primary, #2563EB)' : 'var(--text-secondary, #566174)',
            backgroundColor: pathname === ROUTES.overview || pathname === ROUTES.root ? 'var(--accent-primary-light, #EFF6FF)' : 'transparent',
            boxShadow: 'none',
            transition: 'all 0.15s ease',
          }}
        >
          {t('nav.overview', 'Home')}
        </Link>
        <Link
          href={ROUTES.updates}
          style={{
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: pathname === ROUTES.updates || pathname === '/pulsewire' ? 700 : 500,
            borderRadius: '6px',
            textDecoration: 'none',
            color: pathname === ROUTES.updates || pathname === '/pulsewire' ? 'var(--accent-primary, #2563EB)' : 'var(--text-secondary, #566174)',
            backgroundColor: pathname === ROUTES.updates || pathname === '/pulsewire' ? 'var(--accent-primary-light, #EFF6FF)' : 'transparent',
            boxShadow: 'none',
            transition: 'all 0.15s ease',
          }}
        >
          {t('nav.updates', 'Updates')}
        </Link>
        <Link
          href={ROUTES.analytics}
          style={{
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: pathname === ROUTES.analytics || pathname === '/urban-condition' || pathname === '/intelligence' ? 700 : 500,
            borderRadius: '6px',
            textDecoration: 'none',
            color: pathname === ROUTES.analytics || pathname === '/urban-condition' || pathname === '/intelligence' ? 'var(--accent-primary, #2563EB)' : 'var(--text-secondary, #566174)',
            backgroundColor: pathname === ROUTES.analytics || pathname === '/urban-condition' || pathname === '/intelligence' ? 'var(--accent-primary-light, #EFF6FF)' : 'transparent',
            boxShadow: 'none',
            transition: 'all 0.15s ease',
          }}
        >
          {t('nav.analytics', 'Analytics')}
        </Link>
        <Link
          href={ROUTES.simulate}
          style={{
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: pathname === ROUTES.simulate || pathname === '/copilot' || pathname === '/agent' || pathname === '/scenario' ? 700 : 500,
            borderRadius: '6px',
            textDecoration: 'none',
            color: pathname === ROUTES.simulate || pathname === '/copilot' || pathname === '/agent' || pathname === '/scenario' ? 'var(--accent-primary, #2563EB)' : 'var(--text-secondary, #566174)',
            backgroundColor: pathname === ROUTES.simulate || pathname === '/copilot' || pathname === '/agent' || pathname === '/scenario' ? 'var(--accent-primary-light, #EFF6FF)' : 'transparent',
            boxShadow: 'none',
            transition: 'all 0.15s ease',
          }}
        >
          {t('nav.simulate', 'Simulate')}
        </Link>
      </nav>

      {/* Right: [ ◎ My Location ] | [ Radius ] | [ Live Data ] | [ Research Mode ] | Hand | Lang | Profile */}
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
              ? 'var(--badge-live-bg, #ECFDF5)'
              : isApprox
              ? 'var(--badge-approx-bg, #FFF7ED)'
              : isDenied || isUnavailable || isTimeout || isError
              ? 'var(--badge-hazard-bg, #FEF2F2)'
              : 'var(--bg-card, #FFFFFF)',
            border: isReady
              ? '1px solid var(--badge-live-border, #BBF7D0)'
              : isApprox
              ? '1px solid var(--badge-approx-border, #FED7AA)'
              : isDenied || isUnavailable || isTimeout || isError
              ? '1px solid var(--badge-hazard-border, #FECACA)'
              : '1px solid var(--border, #E2E7EF)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '0 12px',
            height: '36px',
            fontSize: '12px',
            fontWeight: 500,
            color: isReady
              ? 'var(--badge-live-text, #15803D)'
              : isApprox
              ? 'var(--badge-approx-text, #C2410C)'
              : isDenied || isUnavailable || isTimeout || isError
              ? 'var(--badge-hazard-text, #DC2626)'
              : 'var(--text-secondary, #566174)',
            whiteSpace: 'nowrap',
            cursor: isLocating ? 'wait' : 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {isLocating ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #2563EB)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 2a10 10 0 0 1 10 10"></path>
              </svg>
              <span>Locating...</span>
            </>
          ) : isReady ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-good, #15803D)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <circle cx="12" cy="12" r="3" fill="var(--status-good, #15803D)"></circle>
              </svg>
              <span>Location Found {gpsAccuracyMeters ? `(±${Math.round(gpsAccuracyMeters)}m)` : ''}</span>
            </>
          ) : isApprox ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--badge-approx-text, #C2410C)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <circle cx="12" cy="12" r="3" fill="var(--badge-approx-text, #C2410C)"></circle>
              </svg>
              <span>Approximate Location {gpsAccuracyMeters ? `(±${Math.round(gpsAccuracyMeters)}m)` : ''}</span>
            </>
          ) : isDenied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--badge-hazard-text, #DC2626)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>Location access is blocked • Try Again</span>
            </>
          ) : isTimeout ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--badge-hazard-text, #DC2626)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>Location timed out • Try Again</span>
            </>
          ) : isUnavailable || isError ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--badge-hazard-text, #DC2626)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>Location unavailable • Try Again</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #2563EB)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <circle cx="12" cy="12" r="3" fill="var(--accent-primary, #2563EB)"></circle>
              </svg>
              <span>My Location</span>
            </>
          )}
        </button>

        {/* [ Choose on Map ] Fallback Action Button when Location is Blocked or Unavailable */}
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
              backgroundColor: 'var(--accent-primary-light, #EFF6FF)',
              border: '1px solid var(--border-hover, #BFDBFE)',
              borderRadius: 'var(--radius-md, 8px)',
              padding: '0 10px',
              height: '36px',
              fontSize: '11.5px',
              fontWeight: 600,
              color: 'var(--accent-primary, #2563EB)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>Choose on Map</span>
          </button>
        )}

        {/* Radius Selector (36px height) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--bg-card, #FFFFFF)', padding: '0 8px', height: '36px', boxSizing: 'border-box', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border, #E2E7EF)' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #7B8798)' }}>Radius:</span>
          <select
            value={useLocationStore((s) => s.selectedRadiusKm)}
            onChange={(e) => useLocationStore.getState().setSelectedRadiusKm(Number(e.target.value) as any)}
            aria-label="Intelligence surveillance radius"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '11.5px',
              fontWeight: 700,
              color: 'var(--text-primary, #172033)',
              cursor: 'pointer',
              outline: 'none',
              padding: '2px',
            }}
          >
            <option value={5} style={{ backgroundColor: 'var(--bg-panel, #FFFFFF)', color: 'var(--text-primary, #172033)' }}>5 km</option>
            <option value={10} style={{ backgroundColor: 'var(--bg-panel, #FFFFFF)', color: 'var(--text-primary, #172033)' }}>10 km</option>
            <option value={25} style={{ backgroundColor: 'var(--bg-panel, #FFFFFF)', color: 'var(--text-primary, #172033)' }}>25 km</option>
            <option value={50} style={{ backgroundColor: 'var(--bg-panel, #FFFFFF)', color: 'var(--text-primary, #172033)' }}>50 km</option>
            <option value={100} style={{ backgroundColor: 'var(--bg-panel, #FFFFFF)', color: 'var(--text-primary, #172033)' }}>100 km</option>
            <option value={250} style={{ backgroundColor: 'var(--bg-panel, #FFFFFF)', color: 'var(--text-primary, #172033)' }}>250 km</option>
          </select>
        </div>

        {/* [ Live Data ] Provenance Indicator (36px height, semantic tokens) */}
        <div
          title="Data Provenance: Live Signals Synchronized (Open-Meteo, USGS, Google Maps, Municipal feeds)"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 10px',
            height: '36px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--badge-live-bg, #ECFDF5)',
            border: '1px solid var(--badge-live-border, #BBF7D0)',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--badge-live-text, #15803D)',
            letterSpacing: '0.3px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--status-good, #15803D)',
              boxShadow: '0 0 6px rgba(34, 197, 94, 0.5)',
            }}
          />
          LIVE DATA
        </div>

        {/* [ Research Mode ] Workbench Toggle Button (36px height) */}
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
            height: '36px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: isResearchModeOpen ? 'var(--accent-primary-light, #EFF6FF)' : 'var(--bg-card, #FFFFFF)',
            border: isResearchModeOpen ? '1px solid var(--accent-primary, #2563EB)' : '1px solid var(--border, #E2E7EF)',
            fontSize: '12px',
            fontWeight: 700,
            color: isResearchModeOpen ? 'var(--accent-primary, #2563EB)' : 'var(--text-secondary, #566174)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--shadow-xs)',
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
                backgroundColor: 'var(--accent-primary, #2563EB)',
                boxShadow: '0 0 6px var(--accent-primary, #2563EB)',
              }}
            />
          )}
        </button>

        {/* [ Language Selector ] Internationalization (EN / HI / KN) */}
        <LanguageSelector />

        {/* [ User Profile ] Session & Sign Out */}
        <UserProfileMenu />
      </div>

      {/* Location Search Drawer Modal */}
      <LocationSearchDrawer />
    </header>
  );
}
