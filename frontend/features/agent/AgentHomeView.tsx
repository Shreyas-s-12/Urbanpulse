'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAgentStore } from '@/stores/useAgentStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useNearbyEvents } from '@/hooks/useNearbyEvents';
import { locationService } from '@/services/locationService';
import GoogleMapView from '@/components/map/GoogleMapView';
import AskTheMapOverlay from '@/components/map/AskTheMapOverlay';
import ForecastPanel from '@/features/forecast/ForecastPanel';
import LiveUpdatesDrawer from '@/features/updates/LiveUpdatesDrawer';
import WhatChangedModal from '@/features/intelligence/WhatChangedModal';
import ScoreExplainabilityModal from '@/features/intelligence/ScoreExplainabilityModal';
import AnomalyAlertModal from '@/features/intelligence/AnomalyAlertModal';
import ScenarioSimulatorModal from '@/features/intelligence/ScenarioSimulatorModal';
import CityComparisonModal from '@/features/intelligence/CityComparisonModal';
import MonitoringDrawer from '@/features/intelligence/MonitoringDrawer';
import RiskRadarModal from '@/features/intelligence/RiskRadarModal';
import MissionModal from '@/features/intelligence/MissionModal';
import MarkdownRenderer from '@/components/common/MarkdownRenderer';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';
import PulseWireRail from '@/features/pulsewire/PulseWireRail';
import { usePulseWireStore } from '@/stores/usePulseWireStore';
import { SelectedPlaceDetail } from '@/components/map/PlaceDetailCard';
import { agentService } from '@/services/agentService';

const NexusHoloOrb = dynamic(() => import('@/components/3d/NexusHoloOrb'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'radial-gradient(circle, #3B82F6 0%, #1D4ED8 100%)',
        opacity: 0.8,
      }}
    />
  ),
});
import {
  PinIcon,
  HistoryClockIcon,
  TargetScoreIcon,
  AlertTriangleIcon,
  FlaskIcon,
  ScalesIcon,
  BellIcon,
  MessageSquareIcon,
  ExpandIcon,
  CollapseIcon,
  RadioIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  InfoIcon,
  ExternalLinkIcon,
  CompassIcon,
  ShieldCheckIcon,
} from '@/components/common/Icons';

const SUGGESTED_PROMPTS = [
  'What changed in Tokyo in the last 24h?',
  'Why is the UrbanPulse score in London 82?',
  'Are there any anomalies in Paris right now?',
  'Simulate heavy rainfall in Bangalore',
  'Compare air quality in Delhi and Mumbai',
  '7-day forecast for Tokyo',
  'Current traffic in Mysore',
  'Live updates in San Francisco',
];

interface NexusMessageItemProps {
  msg: import('@/stores/useAgentStore').AgentChatMessage;
  isUser: boolean;
}

function NexusMessageItem({ msg, isUser }: NexusMessageItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if message has supporting intelligence data (sources, confidence, location, telemetry)
  const hasSupportingData =
    !isUser &&
    Boolean(
      (msg.sources && msg.sources.length > 0) ||
      msg.confidence !== undefined ||
      msg.location ||
      msg.data?.traffic ||
      msg.data?.weather ||
      msg.data?.airQuality ||
      msg.data?.activities
    );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: '4px',
        width: '100%',
      }}
    >
      <div
        style={{
          maxWidth: isUser ? '85%' : '92%',
          backgroundColor: isUser ? 'var(--accent-primary)' : 'var(--bg-app)',
          color: isUser ? '#FFFFFF' : 'var(--text-primary)',
          padding: isUser ? '10px 14px' : '12px 14px',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          fontSize: '13px',
          lineHeight: 1.5,
          border: isUser ? 'none' : '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xs)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <MarkdownRenderer content={msg.content} isUser={isUser} />

        {/* Know More contextual action toggle */}
        {hasSupportingData && (
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '6px',
                backgroundColor: isExpanded ? 'var(--accent-primary-light, #EFF6FF)' : 'var(--bg-surface)',
                color: isExpanded ? 'var(--accent-primary, #2563EB)' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <InfoIcon size={12} color="var(--accent-primary)" />
              <span>{isExpanded ? 'Hide Details' : 'Know more'}</span>
              <ChevronDownIcon
                size={11}
                style={{
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                }}
              />
            </button>

            {msg.confidence !== undefined && (
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                Confidence: {Math.round(msg.confidence * 100)}%
              </span>
            )}
          </div>
        )}

        {/* Nexus Details Panel */}
        {hasSupportingData && isExpanded && (
          <div
            style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* Sources & Freshness */}
            {msg.sources && msg.sources.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  VERIFIED SOURCES & FRESHNESS
                </span>
                {msg.sources.map((src, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: src.freshness === 'LIVE' ? '#10B981' : '#F59E0B',
                        flexShrink: 0,
                      }}
                    />
                    <span>
                      <strong style={{ color: 'var(--text-primary)' }}>{src.type}</strong>: {src.detail} ({src.source})
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Location Provenance */}
            {msg.location && (
              <div
                style={{
                  marginTop: '4px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  fontSize: '11px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                  <PinIcon size={12} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {msg.location.name || msg.location.city || msg.location.displayName}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                    ({msg.location.latitude.toFixed(4)}, {msg.location.longitude.toFixed(4)})
                  </span>
                </div>

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    (msg.location.name || msg.location.city || '') + ' ' + (msg.location.address || '')
                  )}`}
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
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    flexShrink: 0,
                  }}
                >
                  <ExternalLinkIcon size={10} color="var(--accent-primary)" />
                  <span>Map</span>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentHomeView() {
  const {
    messages,
    activeLocation,
    activeLayers,
    aqiOverlayData,
    toolActivities,
    isProcessing,
    mapCenter,
    mapZoom,
    isMapExpanded,
    setIsMapExpanded,
    toggleMapExpanded,
    sendMessage,
    setActiveLocation,
    setLayer,
    setShowChangesModal,
    setShowScoreModal,
    setShowAnomaliesModal,
    setShowScenarioModal,
    setShowComparisonModal,
    setShowRiskModal,
    setShowMonitoringDrawer,
    showMissionModal,
    setShowMissionModal,
    activeSmartRoutes,
    activeFilter,
    setActiveFilter,
    activeRisk,
  } = useAgentStore();

  const { currentLocation, selectedRadiusKm, setSelectedMapPoint } = useLocationStore();
  const [inputQuery, setInputQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const displayLoc = activeLocation || currentLocation;


  // Nearby events for the active agent location
  const { events } = useNearbyEvents(
    displayLoc?.latitude || null,
    displayLoc?.longitude || null,
    selectedRadiusKm
  );

  // Auto-scroll chat to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolActivities]);

  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null);

  // Quick Action Scroller Ref and Navigation Arrows State
  const quickActionScrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollBounds = () => {
    const el = quickActionScrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  };

  useEffect(() => {
    const el = quickActionScrollerRef.current;
    if (!el) return;

    updateScrollBounds();

    const handleScroll = () => {
      updateScrollBounds();
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateScrollBounds();
      });
      resizeObserver.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  const scrollQuickActions = (direction: 'left' | 'right') => {
    const el = quickActionScrollerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(el.clientWidth * 0.65, 140);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleQuickScore = async () => {
    if (!displayLoc || displayLoc.latitude == null || displayLoc.longitude == null) {
      setShowScoreModal(true);
      return;
    }
    setQuickActionLoading('score');
    try {
      const lat = displayLoc.latitude;
      const lng = displayLoc.longitude;
      const city = displayLoc.city || displayLoc.displayName;
      const countryCode = displayLoc.countryCode || undefined;
      const scoreData = await agentService.getScore(lat, lng, city, countryCode);
      useAgentStore.setState({ activeScore: scoreData, showScoreModal: true });
    } catch (e) {
      console.warn('Score action error, opening modal:', e);
      setShowScoreModal(true);
    } finally {
      setQuickActionLoading(null);
    }
  };

  const handleQuickChanges = async () => {
    if (!displayLoc || displayLoc.latitude == null || displayLoc.longitude == null) {
      setShowChangesModal(true);
      return;
    }
    setQuickActionLoading('changes');
    try {
      const lat = displayLoc.latitude;
      const lng = displayLoc.longitude;
      const city = displayLoc.city || displayLoc.displayName;
      const changesData = await agentService.getChanges(lat, lng, '24h', city);
      useAgentStore.setState({ activeChanges: changesData, showChangesModal: true });
    } catch (e) {
      console.warn('Changes action error, opening modal:', e);
      setShowChangesModal(true);
    } finally {
      setQuickActionLoading(null);
    }
  };

  const handleQuickAnomalies = async () => {
    if (!displayLoc || displayLoc.latitude == null || displayLoc.longitude == null) {
      setShowAnomaliesModal(true);
      return;
    }
    setQuickActionLoading('anomalies');
    try {
      const lat = displayLoc.latitude;
      const lng = displayLoc.longitude;
      const city = displayLoc.city || displayLoc.displayName;
      const anomData = await agentService.getAnomalies(lat, lng, city);
      useAgentStore.setState({ activeAnomalies: anomData, showAnomaliesModal: true });
    } catch (e) {
      console.warn('Anomalies action error, opening modal:', e);
      setShowAnomaliesModal(true);
    } finally {
      setQuickActionLoading(null);
    }
  };

  const handleQuickSimulate = () => {
    setShowScenarioModal(true);
  };

  const handleQuickCompare = () => {
    setShowComparisonModal(true);
  };

  const handleQuickRisk = async () => {
    if (!displayLoc || displayLoc.latitude == null || displayLoc.longitude == null) {
      setShowRiskModal(true);
      return;
    }
    setQuickActionLoading('risk');
    try {
      const lat = displayLoc.latitude;
      const lng = displayLoc.longitude;
      const city = displayLoc.city || displayLoc.displayName || undefined;
      const countryCode = displayLoc.countryCode || undefined;
      const riskData = await agentService.getRiskReport(lat, lng, selectedRadiusKm || 50, city, countryCode);
      useAgentStore.setState({ activeRisk: riskData, showRiskModal: true });
    } catch (e) {
      console.warn('Risk action error, opening modal:', e);
      setShowRiskModal(true);
    } finally {
      setQuickActionLoading(null);
    }
  };

  const handleSelectPoi = (place: SelectedPlaceDetail) => {
    const newLoc: any = {
      type: 'PLACE',
      placeId: place.placeId,
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      city: place.name,
      displayName: place.address ? `${place.name} — ${place.address}` : place.name,
      country: displayLoc?.country || null,
      countryCode: displayLoc?.countryCode || null,
      isUserLocation: false,
    };
    setActiveLocation(newLoc);
    useAgentStore.getState().setSelectedMapEntity({
      type: 'POI',
      id: place.placeId,
      name: place.name,
      coordinates: { latitude: place.latitude, longitude: place.longitude },
      meta: { address: place.address, rating: place.rating },
    });
    setSelectedMapPoint({
      latitude: place.latitude,
      longitude: place.longitude,
      label: place.name,
      city: place.name,
    });
  };

  const handleAskAgentPoi = (place: SelectedPlaceDetail) => {
    handleSelectPoi(place);
    handleSend(`What are the live conditions, status, and traffic around ${place.name}?`);
  };

  const handleNearbyActivitiesPoi = (place: SelectedPlaceDetail) => {
    handleSelectPoi(place);
    handleSend(`What verified activities, attractions, and places to visit are near ${place.name}?`);
  };

  const handleSend = (text: string) => {
    if (!text.trim() || isProcessing) return;
    const lower = text.toLowerCase();

    // Trigger PulseWire intelligence if query involves fresh news / what's happening
    if (lower.includes('happening') || lower.includes('news') || lower.includes('headline') || lower.includes('update')) {
      const pulseStore = usePulseWireStore.getState();
      if (!pulseStore.isOpen) {
        pulseStore.setIsOpen(true);
      }
      if (lower.includes('world') || lower.includes('global')) {
        pulseStore.fetchNews({ scope: 'GLOBAL' });
      } else if (lower.includes('india') || lower.includes('country') || lower.includes('national')) {
        pulseStore.fetchNews({ scope: 'COUNTRY', country: 'India', countryCode: 'IN' });
      } else if (lower.includes('karnataka')) {
        pulseStore.fetchNews({ scope: 'STATE', state: 'Karnataka', countryCode: 'IN' });
      } else if (lower.includes('mysuru') || lower.includes('mysore')) {
        pulseStore.fetchNews({ scope: 'CITY', city: 'Mysuru', countryCode: 'IN' });
      } else if (lower.includes('bengaluru') || lower.includes('bangalore')) {
        pulseStore.fetchNews({ scope: 'CITY', city: 'Bengaluru', countryCode: 'IN' });
      } else if (lower.includes('delhi')) {
        pulseStore.fetchNews({ scope: 'CITY', city: 'Delhi', countryCode: 'IN' });
      } else if (displayLoc?.city) {
        pulseStore.fetchNews({ scope: 'CITY', city: displayLoc.city, countryCode: displayLoc.countryCode || undefined });
      }
    }

    sendMessage(text);
    setInputQuery('');
  };

  const handleMapClick = async (coords: { latitude: number; longitude: number }) => {
    try {
      const resolved = await locationService.reverseGeocode(coords.latitude, coords.longitude);
      setActiveLocation(resolved);
      useAgentStore.getState().setSelectedMapEntity({
        type: 'COORDINATE',
        coordinates: coords,
        name: resolved.city || resolved.displayName,
      });
      setSelectedMapPoint({
        latitude: coords.latitude,
        longitude: coords.longitude,
        label: resolved.displayName || resolved.city || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
        city: resolved.city || undefined,
        country: resolved.country || undefined,
      });
      sendMessage(`What's the status around ${resolved.city || resolved.displayName}?`);
    } catch (e) {
      console.warn('Map click reverse geocode error:', e);
      useAgentStore.getState().setSelectedMapEntity({
        type: 'COORDINATE',
        coordinates: coords,
        name: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
      });
      setSelectedMapPoint({
        latitude: coords.latitude,
        longitude: coords.longitude,
        label: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
      });
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--bg-app)',
        overflow: 'hidden',
      }}
    >
      {/* PulseWire Live World Intelligence Column */}
      <PulseWireRail />

      {/* Conversational Agent Console */}
      <ErrorBoundary fallbackTitle="Agent Console Unavailable">
        <div
          className="chat-shell"
          style={{
            width: isMapExpanded ? '0px' : 'clamp(340px, calc((100vh - 58px) * 9 / 16), 440px)',
            minWidth: 0,
            aspectRatio: '9 / 16',
            maxHeight: 'calc(100vh - 58px)',
            minHeight: 0,
            height: '100%',
            flexShrink: 0,
            display: isMapExpanded ? 'none' : 'flex',
            flexDirection: 'column',
            backgroundColor: '#FFFFFF',
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.90)), url("/images/Chat Background.png")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            borderRight: '1px solid var(--border-subtle)',
            zIndex: 20,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
        {/* Agent Header */}
        <div
          style={{
            height: '56px',
            padding: '0 var(--space-4)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <UrbanPulseLogo size={26} />
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                UrbanPulse Agent
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1 }}>
                Conversational Location Intelligence
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {displayLoc && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--accent-primary-light)',
                  color: 'var(--accent-primary)',
                  fontWeight: 700,
                  maxWidth: '120px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title={displayLoc.displayName}
              >
                <PinIcon size={12} color="var(--accent-primary)" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayLoc.city || displayLoc.displayName}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Master Intelligence Quick Navigation Row */}
        <div
          className="quick-action-viewport"
          style={{
            position: 'relative',
            minWidth: 0,
            width: '100%',
            backgroundColor: 'var(--bg-subtle)',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* Left Scroll Control Overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: '36px',
              background: 'linear-gradient(to right, rgba(248, 250, 252, 0.98) 50%, rgba(248, 250, 252, 0))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              paddingLeft: '4px',
              zIndex: 5,
              pointerEvents: 'none',
              opacity: canScrollLeft ? 1 : 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scrollQuickActions('left')}
                aria-label="Scroll actions left"
                style={{
                  pointerEvents: 'auto',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'border-color 0.15s ease, background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--accent-primary-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                <ChevronLeftIcon size={14} color="var(--text-primary)" />
              </button>
            )}
          </div>

          {/* Right Scroll Control Overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: '36px',
              background: 'linear-gradient(to left, rgba(248, 250, 252, 0.98) 50%, rgba(248, 250, 252, 0))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: '4px',
              zIndex: 5,
              pointerEvents: 'none',
              opacity: canScrollRight ? 1 : 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            {canScrollRight && (
              <button
                type="button"
                onClick={() => scrollQuickActions('right')}
                aria-label="Scroll actions right"
                style={{
                  pointerEvents: 'auto',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-xs)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'border-color 0.15s ease, background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.backgroundColor = 'var(--accent-primary-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
              >
                <ChevronRightIcon size={14} color="var(--text-primary)" />
              </button>
            )}
          </div>

          {/* QuickActionScroller */}
          <div
            ref={quickActionScrollerRef}
            className="quick-action-scroller"
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              gap: '8px',
              overflowX: 'auto',
              overflowY: 'hidden',
              minWidth: 0,
              paddingLeft: '10px',
              paddingRight: '10px',
              paddingTop: '8px',
              paddingBottom: '8px',
              scrollbarWidth: 'none',
              boxSizing: 'border-box',
            }}
          >
            <button
              type="button"
              onClick={handleQuickChanges}
              disabled={quickActionLoading === 'changes'}
              style={{
                height: '32px',
                padding: '0 12px',
                fontSize: '11.5px',
                fontWeight: 600,
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: quickActionLoading === 'changes' ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flex: '0 0 auto',
                whiteSpace: 'nowrap',
                transition: 'border-color 0.15s ease',
              }}
            >
              <HistoryClockIcon size={13} color="var(--accent-primary)" />
              <span>{quickActionLoading === 'changes' ? 'Analyzing...' : 'Changes'}</span>
            </button>
            <button
              type="button"
              onClick={handleQuickScore}
              disabled={quickActionLoading === 'score'}
              style={{
                height: '32px',
                padding: '0 12px',
                fontSize: '11.5px',
                fontWeight: 600,
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: quickActionLoading === 'score' ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flex: '0 0 auto',
                whiteSpace: 'nowrap',
                transition: 'border-color 0.15s ease',
              }}
            >
              <TargetScoreIcon size={13} color="var(--accent-primary)" />
              <span>{quickActionLoading === 'score' ? 'Evaluating...' : 'Score'}</span>
            </button>
            <button
              type="button"
              onClick={handleQuickAnomalies}
              disabled={quickActionLoading === 'anomalies'}
              style={{
                height: '32px',
                padding: '0 12px',
                fontSize: '11.5px',
                fontWeight: 600,
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: quickActionLoading === 'anomalies' ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flex: '0 0 auto',
                whiteSpace: 'nowrap',
                transition: 'border-color 0.15s ease',
              }}
            >
              <AlertTriangleIcon size={13} color="#F59E0B" />
              <span>{quickActionLoading === 'anomalies' ? 'Scanning...' : 'Anomalies'}</span>
            </button>
            <button
              type="button"
              onClick={handleQuickSimulate}
              style={{
                height: '32px',
                padding: '0 12px',
                fontSize: '11.5px',
                fontWeight: 600,
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flex: '0 0 auto',
                whiteSpace: 'nowrap',
                transition: 'border-color 0.15s ease',
              }}
            >
              <FlaskIcon size={13} color="var(--accent-primary)" />
              <span>Simulate</span>
            </button>
            <button
              type="button"
              onClick={handleQuickCompare}
              style={{
                height: '32px',
                padding: '0 12px',
                fontSize: '11.5px',
                fontWeight: 600,
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flex: '0 0 auto',
                whiteSpace: 'nowrap',
                transition: 'border-color 0.15s ease',
              }}
            >
              <ScalesIcon size={13} color="var(--accent-primary)" />
              <span>Compare</span>
            </button>
            <button
              type="button"
              onClick={handleQuickRisk}
              disabled={quickActionLoading === 'risk'}
              style={{
                height: '32px',
                padding: '0 12px',
                fontSize: '11.5px',
                fontWeight: 600,
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: quickActionLoading === 'risk' ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flex: '0 0 auto',
                whiteSpace: 'nowrap',
                transition: 'border-color 0.15s ease',
              }}
            >
              <ShieldCheckIcon size={13} color="var(--accent-primary)" />
              <span>{quickActionLoading === 'risk' ? 'Evaluating...' : 'Risk Radar'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowMonitoringDrawer(true)}
              style={{
                height: '32px',
                padding: '0 12px',
                fontSize: '11.5px',
                fontWeight: 600,
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flex: '0 0 auto',
                whiteSpace: 'nowrap',
                transition: 'border-color 0.15s ease',
              }}
            >
              <BellIcon size={13} color="var(--accent-primary)" />
              <span>Monitor</span>
            </button>
            <button
              type="button"
              onClick={() => setShowMissionModal(true)}
              style={{
                height: '32px',
                padding: '0 12px',
                fontSize: '11.5px',
                fontWeight: 600,
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flex: '0 0 auto',
                whiteSpace: 'nowrap',
                transition: 'border-color 0.15s ease',
              }}
            >
              <CompassIcon size={13} color="var(--accent-primary)" />
              <span>Mission</span>
            </button>
          </div>
        </div>

        {/* Nexus Event Filter Bar (Phase 1) */}
        <div
          style={{
            padding: '6px 10px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
            FILTER:
          </span>
          {(['ALL', 'CRIME', 'WEATHER', 'TRAFFIC', 'HAZARD', 'MUNICIPAL', 'LIVE', 'RECENT', 'FORECAST', 'ALERTS'] as const).map((filterOpt) => {
            const isSelected = activeFilter === filterOpt;
            return (
              <button
                key={filterOpt}
                type="button"
                onClick={() => {
                  setActiveFilter(filterOpt);
                  if (filterOpt !== 'ALL') {
                    handleSend(`Show ${filterOpt.toLowerCase()} intelligence and events here`);
                  }
                }}
                style={{
                  height: '24px',
                  padding: '0 8px',
                  borderRadius: '12px',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  backgroundColor: isSelected ? 'var(--accent-primary-light)' : 'var(--bg-surface)',
                  color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                }}
              >
                {filterOpt}
              </button>
            );
          })}
        </div>

        {/* Chat History & Stream Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            minHeight: 0,
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                margin: 'auto 0',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-2) 0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                }}
              >
                <NexusHoloOrb size={72} />
                <UrbanPulseLogo size={32} />
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0, maxWidth: '290px' }}>
                Ask anything about any city on Earth. UrbanPulse Nexus analyzes live conditions and moves the map to show real traffic, weather, or air quality.
              </p>

              {/* Suggested Prompts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%', marginTop: 'var(--space-1)' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  TRY ASKING:
                </span>
                {SUGGESTED_PROMPTS.slice(0, 4).map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-app)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.backgroundColor = 'var(--accent-primary-light)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-app)';
                    }}
                  >
                    <MessageSquareIcon size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Render Message List */}
          {messages.map((msg) => (
            <NexusMessageItem key={msg.id} msg={msg} isUser={msg.sender === 'user'} />
          ))}

          {/* Activity Progress (Compact Non-Distracting Pills) */}
          {toolActivities.length > 0 && isProcessing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              {toolActivities.slice(-3).map((act, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    alignSelf: 'flex-start',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: act.status === 'IN_PROGRESS' ? 'var(--accent-primary)' : '#10B981',
                      animation: act.status === 'IN_PROGRESS' ? 'pulse 1.2s infinite' : 'none',
                    }}
                  />
                  <span>{act.step}</span>
                  {act.detail && <span style={{ color: 'var(--text-muted)' }}>• {act.detail}</span>}
                </div>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Suggested Prompt Chips */}
        {messages.length > 0 && (
          <div
            style={{
              padding: 'var(--space-2) var(--space-4)',
              display: 'flex',
              gap: 'var(--space-1)',
              overflowX: 'auto',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
              scrollbarWidth: 'none',
              flexShrink: 0,
            }}
          >
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                disabled={isProcessing}
                style={{
                  height: '26px',
                  fontSize: '11px',
                  padding: '0 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.color = 'var(--accent-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            flexShrink: 0,
          }}
        >
          <input
            type="text"
            placeholder="Ask about traffic, weather, air quality, or a city..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend(inputQuery);
            }}
            disabled={isProcessing}
            style={{
              flex: 1,
              height: '40px',
              padding: '0 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-app)',
              fontSize: '13px',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
          />
          <button
            onClick={() => handleSend(inputQuery)}
            disabled={isProcessing || !inputQuery.trim()}
            style={{
              height: '40px',
              padding: '0 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isProcessing ? 'var(--text-muted)' : 'var(--accent-primary)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s ease',
              flexShrink: 0,
            }}
          >
            {isProcessing ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </div>
      </ErrorBoundary>

      {/* RIGHT PANEL: Real Google Maps Engine */}
      <ErrorBoundary fallbackTitle="Map Engine Unavailable">
        <div style={{ flex: 1, height: '100%', position: 'relative', minWidth: 0 }}>
          {/* Floating trigger to restore agent when map is expanded */}
          {isMapExpanded && (
            <button
              type="button"
              onClick={() => setIsMapExpanded(false)}
              aria-label="Open Agent Console"
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                zIndex: 35,
                height: '36px',
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', boxShadow: '0 0 6px rgba(37, 99, 235, 0.6)' }} />
              <span>Open Agent Console</span>
            </button>
          )}

          <GoogleMapView
            center={
              mapCenter
                ? {
                    latitude: mapCenter.lat,
                    longitude: mapCenter.lng,
                    city: displayLoc?.city || null,
                    country: displayLoc?.country || null,
                    displayName: displayLoc?.displayName || '',
                    isUserLocation: false,
                  }
                : displayLoc
            }
            radiusKm={selectedRadiusKm}
            events={activeLayers.events ? events : []}
            layers={{
              traffic: activeLayers.traffic,
              aqi: activeLayers.aqi,
              boundary: activeLayers.boundary,
            }}
            trafficEnabled={activeLayers.traffic}
            aqiEnabled={activeLayers.aqi}
            aqiData={aqiOverlayData}
            zoomOverride={mapZoom}
            riskZones={activeRisk?.riskZones || []}
            activeFilter={activeFilter}
            routes={activeSmartRoutes?.candidateRoutes || []}
            activeRoute={
              activeSmartRoutes?.candidateRoutes?.find(
                (r: any) => r.category === activeSmartRoutes?.recommendedCategory
              ) || activeSmartRoutes?.candidateRoutes?.[0] || null
            }
            onMapClick={handleMapClick}
            onSelectPoi={handleSelectPoi}
            onAskAgentPoi={handleAskAgentPoi}
            onNearbyActivitiesPoi={handleNearbyActivitiesPoi}
            height="100%"
            statusBadgeLeft={isMapExpanded ? 188 : 16}
          />

          {/* Floating Layer Indicator Bar on Top-Right */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              height: '38px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(8px)',
              borderRadius: 'var(--radius-md)',
              padding: '0 var(--space-3)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              fontSize: '12px',
              color: 'var(--text-primary)',
              zIndex: 30,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={activeLayers.traffic}
                onChange={(e) => setLayer('traffic', e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 500 }}>Traffic</span>
              {activeLayers.traffic && (
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)', padding: '1px 5px', borderRadius: '4px' }}>
                  LIVE
                </span>
              )}
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={activeLayers.aqi}
                onChange={(e) => setLayer('aqi', e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 500 }}>AQI Layer</span>
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={activeLayers.events}
                onChange={(e) => setLayer('events', e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontWeight: 500 }}>Events ({events.length})</span>
            </label>

            <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-subtle)' }} />

            <button
              type="button"
              onClick={toggleMapExpanded}
              aria-label={isMapExpanded ? "Collapse Map" : "Expand Map"}
              title={isMapExpanded ? "Restore split Agent/Map view" : "Expand map across screen"}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                height: '26px',
                padding: '0 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isMapExpanded ? 'var(--accent-primary)' : 'var(--bg-app)',
                color: isMapExpanded ? '#FFFFFF' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {isMapExpanded ? (
                <>
                  <CollapseIcon size={12} color="currentColor" />
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <ExpandIcon size={12} color="currentColor" />
                  <span>Expand</span>
                </>
              )}
            </button>
          </div>

        {/* Active AQI Legend if AQI layer enabled */}
        {activeLayers.aqi && aqiOverlayData && (
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              right: '24px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(8px)',
              borderRadius: '8px',
              padding: '12px 16px',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              zIndex: 30,
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              AQI SCALE: {aqiOverlayData.scale}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800 }}>
              <span>Value: {aqiOverlayData.value}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#10B981' }}>({aqiOverlayData.category})</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Source: {aqiOverlayData.source}
            </div>
          </div>
        )}

        {/* Multi-Pillar Forecasting Drawer */}
        <ForecastPanel />

        {/* Live Updates & Civic RAG Drawer */}
        <LiveUpdatesDrawer />

        {/* Ask-the-Map Floating Quick-Action Overlay */}
        <AskTheMapOverlay />

        {/* Intelligence Modals & Drawers */}
        <WhatChangedModal />
        <ScoreExplainabilityModal />
        <AnomalyAlertModal />
        <ScenarioSimulatorModal />
        <CityComparisonModal />
        <MonitoringDrawer />
        <RiskRadarModal />
        <MissionModal />
      </div>
      </ErrorBoundary>
    </div>
  );
}
