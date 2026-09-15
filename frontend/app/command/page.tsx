'use client';

import React, { useState, useEffect } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { useMapContext } from '@/context/MapContext';
import GoogleMapView from '@/components/map/GoogleMapView';
import { UnifiedCityEvent } from '@shared/types';
import { eventService } from '@/services/eventService';
import { commandService } from '@/services/commandService';

import {
  CommandOverview,
  CrossDomainGraph,
  IncidentDossier,
  CityHealthResponse,
  DecisionSupportResponse,
  ReplayTimelineResponse,
} from '@/types/command';

import CommandHeaderHUD from '@/components/command/CommandHeaderHUD';
import CommandNavSidebar from '@/components/command/CommandNavSidebar';
import IncidentCommandPanel from '@/components/command/IncidentCommandPanel';
import IntelligenceGraphViewer from '@/components/command/IntelligenceGraphViewer';
import CityHealthMatrix from '@/components/command/CityHealthMatrix';
import DecisionSupportCard from '@/components/command/DecisionSupportCard';
import AdvancedComparisonModal from '@/components/command/AdvancedComparisonModal';
import ReplayTimelineBar from '@/components/command/ReplayTimelineBar';
import DataQualityModal from '@/components/command/DataQualityModal';
import ReportGeneratorModal from '@/components/command/ReportGeneratorModal';

export default function CommandCenterPage() {
  const { currentLocation, selectedRadiusKm } = useLocationStore();
  const { mapMode } = useMapContext();

  // Primary State
  const [overview, setOverview] = useState<CommandOverview | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('LIVE');
  const [activeView, setActiveView] = useState<string>('SITUATION');

  // Multi-Mode Panels State
  const [graphData, setGraphData] = useState<CrossDomainGraph | null>(null);
  const [incidentDossier, setIncidentDossier] = useState<IncidentDossier | null>(null);
  const [cityHealthData, setCityHealthData] = useState<CityHealthResponse | null>(null);
  const [decisionData, setDecisionData] = useState<DecisionSupportResponse | null>(null);
  const [timelineData, setTimelineData] = useState<ReplayTimelineResponse | null>(null);

  // Modals State
  const [showComparison, setShowComparison] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Replay State
  const [replayWindow, setReplayWindow] = useState('24H');
  const [replayFrameIndex, setReplayFrameIndex] = useState(0);

  // Map events
  const [events, setEvents] = useState<UnifiedCityEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<UnifiedCityEvent | null>(null);

  const lat = currentLocation?.latitude ?? null;
  const lng = currentLocation?.longitude ?? null;
  const cityName = currentLocation?.city || currentLocation?.displayName || 'Surveillance Target';

  // Load Overview & Events
  useEffect(() => {
    if (lat === null || lng === null) return;
    const loadOverview = async () => {
      try {
        const [ov, evts] = await Promise.all([
          commandService.getCommandOverview(lat, lng, selectedRadiusKm, cityName),
          eventService.getEventsWithinRadius(lat, lng, selectedRadiusKm),
        ]);
        setOverview(ov);
        setEvents(evts);
      } catch (err) {
        console.error('Failed to load command overview:', err);
      }
    };
    loadOverview();
  }, [lat, lng, selectedRadiusKm, cityName]);

  // Load Replay Timeline
  useEffect(() => {
    if (lat === null || lng === null) return;
    const loadReplay = async () => {
      try {
        const rep = await commandService.getReplayTimeline(lat, lng, replayWindow, 8);
        setTimelineData(rep);
        setReplayFrameIndex(rep.timeline.length - 1);
      } catch (err) {
        console.error('Failed to load replay timeline:', err);
      }
    };
    loadReplay();
  }, [lat, lng, replayWindow]);

  // Handle Active View changes
  const handleSelectView = async (view: string) => {
    setActiveView(view);
    if (view === 'COMPARE') {
      setShowComparison(true);
    } else if (view === 'QUALITY') {
      setShowQuality(true);
    } else if (view === 'REPORT') {
      setShowReport(true);
    } else if (view === 'GRAPH') {
      if (lat === null || lng === null) return;
      try {
        const g = await commandService.getCrossDomainGraph(lat, lng, selectedRadiusKm, cityName);
        setGraphData(g);
      } catch (err) {
        console.error('Failed to load graph:', err);
      }
    } else if (view === 'HEALTH') {
      if (lat === null || lng === null) return;
      try {
        const h = await commandService.getCityHealth(lat, lng, selectedRadiusKm, cityName);
        setCityHealthData(h);
      } catch (err) {
        console.error('Failed to load city health:', err);
      }
    } else if (view === 'DECISION') {
      if (lat === null || lng === null) return;
      try {
        const d = await commandService.evaluateDecision(lat, lng, 'transit_efficiency', [], cityName);
        setDecisionData(d);
      } catch (err) {
        console.error('Failed to load decisions:', err);
      }
    }
  };

  // When an event is selected on the map or list, trigger Incident Command Mode!
  const handleSelectIncident = async (ev: any) => {
    try {
      const incId = ev.id || `inc-${Date.now()}`;
      const dossier = await commandService.getIncidentDossier(
        incId,
        ev.latitude || lat,
        ev.longitude || lng,
        3.5,
        cityName,
        ev.eventType || 'HAZARD',
        ev.title || 'Civic Incident'
      );
      setIncidentDossier(dossier);
      setActiveView('INCIDENT');
    } catch (err) {
      console.error('Failed to open incident command mode:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Top Urban Status Bar */}
      <CommandHeaderHUD
        overview={overview}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        activeView={activeView}
        onSelectView={handleSelectView}
      />

      {/* Main 3-Pane Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {/* Left Nav Sidebar */}
        <CommandNavSidebar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          activeIncidentsCount={overview?.totalActiveIncidents || events.length}
        />

        {/* Center: Dominant Interactive Map */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0, height: '100%' }}>
          <GoogleMapView
            center={currentLocation}
            radiusKm={selectedRadiusKm}
            events={events}
            layers={{
              traffic: true,
              accidents: true,
              disasters: true,
              hazards: true,
              boundary: true,
            }}
            trafficEnabled={true}
            mapMode={mapMode}
            onSelectEvent={(ev) => {
              setSelectedEvent(ev);
              handleSelectIncident(ev);
            }}
            height="100%"
          />
        </div>

        {/* Right: Selected Intelligence / Incident Command Panel */}
        {activeView === 'INCIDENT' && incidentDossier && (
          <IncidentCommandPanel
            dossier={incidentDossier}
            onClose={() => setActiveView('SITUATION')}
            onRefresh={() => handleSelectIncident(selectedEvent || {})}
          />
        )}

        {activeView === 'GRAPH' && graphData && (
          <IntelligenceGraphViewer
            graph={graphData}
            onClose={() => setActiveView('SITUATION')}
          />
        )}

        {activeView === 'HEALTH' && cityHealthData && (
          <CityHealthMatrix
            data={cityHealthData}
            onClose={() => setActiveView('SITUATION')}
          />
        )}

        {activeView === 'DECISION' && decisionData && (
          <DecisionSupportCard
            data={decisionData}
            onClose={() => setActiveView('SITUATION')}
          />
        )}

        {/* Default Situation Awareness list if SITUATION view */}
        {activeView === 'SITUATION' && (
          <div
            style={{
              width: '380px',
              backgroundColor: '#FFFFFF',
              borderLeft: '1px solid #E5E7EB',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              overflowY: 'auto',
              boxShadow: '-2px 0 6px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>
                PRIORITIZED SITUATION AWARENESS
              </span>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: '2px 0 0 0' }}>
                Active Metropolitan Anomalies ({overview?.situationAwareness.length || 0})
              </h3>
            </div>

            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {overview?.situationAwareness.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectIncident(item)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    backgroundColor: item.severity === 'CRITICAL' ? '#FEF2F2' : '#F9FAFB',
                    border: item.severity === 'CRITICAL' ? '1px solid #FECACA' : '1px solid #E5E7EB',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: '3px',
                        backgroundColor: item.severity === 'CRITICAL' ? '#DC2626' : '#2563EB',
                        color: '#FFFFFF',
                      }}
                    >
                      {item.severity}
                    </span>
                    <span style={{ fontSize: '10px', color: '#6B7280' }}>
                      {Math.round(item.confidence * 100)}% Conf
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>{item.title}</div>
                  <div style={{ fontSize: '11px', color: '#4B5563', margin: '3px 0' }}>{item.description}</div>
                  <div style={{ fontSize: '10px', color: '#DC2626', fontWeight: 600 }}>Impact: {item.impact}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Replay Timeline Scrubber */}
      <ReplayTimelineBar
        timelineData={timelineData}
        selectedWindow={replayWindow}
        onSelectWindow={setReplayWindow}
        activeFrameIndex={replayFrameIndex}
        onSelectFrame={setReplayFrameIndex}
      />

      {/* Modals */}
      {showComparison && <AdvancedComparisonModal onClose={() => setShowComparison(false)} />}
      {showQuality && lat !== null && lng !== null && <DataQualityModal latitude={lat} longitude={lng} onClose={() => setShowQuality(false)} />}
      {showReport && lat !== null && lng !== null && (
        <ReportGeneratorModal
          latitude={lat}
          longitude={lng}
          cityName={cityName}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
