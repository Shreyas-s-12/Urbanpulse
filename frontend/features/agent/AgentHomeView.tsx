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
import {
  NexusRankingResponse,
  NexusComparisonResponse,
  NexusConditionResponse,
  NexusExplanationResponse,
  NexusForecastResponse,
  NexusScenarioResponse,
} from '@/features/agent/responses';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import UrbanPulseLogo from '@/components/common/UrbanPulseLogo';
import PulseWireRail from '@/features/pulsewire/PulseWireRail';
import { usePulseWireStore } from '@/stores/usePulseWireStore';
import { SelectedPlaceDetail } from '@/components/map/PlaceDetailCard';
import { agentService } from '@/services/agentService';
import VoiceControl from '@/features/multimodal/voice/VoiceControl';
import { useLanguage } from '@/context/LanguageContext';

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

import {
  NexusHeader,
  NexusUserMessage,
  NexusAssistantMessage,
  NexusThinkingIndicator,
  NexusSuggestedPrompts,
  NexusComposer,
} from '@/features/agent/components';

export default function AgentHomeView() {
  const { t, speechLocale } = useLanguage();
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
            width: isMapExpanded ? '0px' : 'clamp(330px, 25vw, 380px)',
            minWidth: 0,
            height: '100%',
            flexShrink: 0,
            display: isMapExpanded ? 'none' : 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-panel)',
            borderRight: '1px solid var(--border)',
            zIndex: 20,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
        {/* Nexus Header (56-64px height) */}
        <NexusHeader locationName={displayLoc ? (displayLoc.city || displayLoc.displayName) : null} />

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
              background: 'linear-gradient(to right, var(--scroller-gradient-start) 50%, var(--scroller-gradient-end))',
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
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
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
                  e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
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
              background: 'linear-gradient(to left, var(--scroller-gradient-start) 50%, var(--scroller-gradient-end))',
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
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
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
                  e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
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
              <AlertTriangleIcon size={13} color="var(--status-warning-text)" />
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

        {/* Nexus Event Filter Bar */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--bg-subtle)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '10.5px', fontWeight: 750, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
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
                  height: '26px',
                  padding: '0 10px',
                  borderRadius: '13px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: isSelected ? '1px solid var(--button)' : '1px solid var(--border)',
                  backgroundColor: isSelected ? 'var(--button)' : 'var(--bg-card)',
                  color: isSelected ? 'var(--button-foreground)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {filterOpt}
              </button>
            );
          })}
        </div>

        {/* Chat History & Stream Area - ONLY scrollable region */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            backgroundColor: 'var(--conversation-bg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            minHeight: 0,
            boxSizing: 'border-box',
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
                gap: '14px',
                padding: '16px 8px',
                width: '100%',
                boxSizing: 'border-box',
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
                <NexusHoloOrb size={76} />
                <UrbanPulseLogo size={32} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>
                Ask anything about your city or location.
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, maxWidth: '290px' }}>
                UrbanPulse Nexus analyzes live geospatial signals, traffic bottlenecks, weather, and environmental safety in real time.
              </p>

              {/* Initial Suggested Prompts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '330px', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' }}>
                  TRY ASKING:
                </span>
                {SUGGESTED_PROMPTS.slice(0, 4).map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt)}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 12px',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      borderRadius: '8px',
                      backgroundColor: 'var(--assistant-card-bg)',
                      border: '1px solid var(--assistant-card-border)',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.backgroundColor = 'var(--accent-primary-light)';
                      e.currentTarget.style.color = 'var(--accent-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--assistant-card-border)';
                      e.currentTarget.style.backgroundColor = 'var(--assistant-card-bg)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                  >
                    <MessageSquareIcon size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Render Message List */}
          {messages.map((msg) =>
            msg.sender === 'user' ? (
              <NexusUserMessage key={msg.id} content={msg.content} />
            ) : (
              <NexusAssistantMessage key={msg.id} msg={msg} />
            )
          )}

          {/* Subtle Thinking / Processing Indicator */}
          {isProcessing && <NexusThinkingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Pinned Stable Suggested Prompts Row */}
        <NexusSuggestedPrompts
          prompts={SUGGESTED_PROMPTS}
          onSelectPrompt={handleSend}
          disabled={isProcessing}
        />

        {/* Pinned Stable Composer Dock */}
        <NexusComposer
          inputQuery={inputQuery}
          setInputQuery={setInputQuery}
          onSend={handleSend}
          isProcessing={isProcessing}
        />
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
                backgroundColor: 'var(--overlay-bg)',
                backdropFilter: 'blur(12px)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-panel)',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', boxShadow: '0 0 8px var(--accent-primary)' }} />
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
              backgroundColor: 'var(--overlay-bg)',
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
                <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--status-good-text)', backgroundColor: 'var(--status-good-bg)', border: '1px solid var(--status-good-border)', padding: '1px 5px', borderRadius: '4px' }}>
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
                backgroundColor: isMapExpanded ? 'var(--button)' : 'var(--bg-app)',
                color: isMapExpanded ? 'var(--button-foreground)' : 'var(--text-secondary)',
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
              backgroundColor: 'var(--overlay-bg)',
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
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--status-good-text)' }}>({aqiOverlayData.category})</span>
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
