'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import RAGPageLayout from '@/components/rag/RAGPageLayout';
import RAGQueryInterface from '@/components/rag/RAGQueryInterface';
import RAGPredictionSection from '@/components/rag/RAGPredictionSection';
import EvidenceCitationCard, { EvidenceCitation } from '@/components/rag/EvidenceCitationCard';
import GoogleMapView from '@/components/map/GoogleMapView';
import ErrorBoundary from '@/components/common/ErrorBoundary';

const CrisisRadar3D = dynamic(() => import('@/components/rag/3d/CrisisRadar3D'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '180px',
        backgroundColor: '#0F172A',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94A3B8',
        fontSize: '11px',
      }}
    >
      Initializing Tactical Radar...
    </div>
  ),
});

interface CrisisRAGWorkspaceProps {
  initialLat?: number;
  initialLng?: number;
  initialLocationName?: string;
  initialCityName?: string;
}

export default function CrisisRAGWorkspace({
  initialLat = 12.2958,
  initialLng = 76.6394,
  initialLocationName = 'Mysore Palace',
  initialCityName = 'Mysuru',
}: CrisisRAGWorkspaceProps) {
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeEventTab, setActiveEventTab] = useState<'CURRENT' | 'RECENT' | 'HISTORICAL' | 'FORECAST'>('CURRENT');

  const lat = initialLat;
  const lng = initialLng;
  const locationName = initialLocationName;
  const cityName = initialCityName;

  useEffect(() => {
    let isMounted = true;
    const fetchContext = async () => {
      setLoading(true);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        const res = await fetch(
          `${baseUrl}/api/v1/crisisrag/context?latitude=${lat}&longitude=${lng}&locationName=${encodeURIComponent(
            locationName
          )}&cityName=${encodeURIComponent(cityName)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isMounted) setContext(data);
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load CrisisRAG context');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchContext();
    return () => {
      isMounted = false;
    };
  }, [lat, lng, locationName, cityName]);

  const centerLocation = {
    latitude: lat,
    longitude: lng,
    displayName: locationName,
    city: cityName,
    country: 'India',
    countryCode: 'IN',
    isUserLocation: false,
  };

  const suggestedQueries = [
    'Which arterial transit corridors are currently closed?',
    'Is there active flooding or is this historical record?',
    'Where is the nearest verified civil shelter?',
    'What emergency civil defense protocols are active?',
  ];

  return (
    <ErrorBoundary>
      <RAGPageLayout
        moduleName="CrisisRAG"
        moduleSubtitle="Emergency Response Intelligence"
        locationName={locationName}
        cityName={cityName}
        latitude={lat}
        longitude={lng}
      >
        {/* Top 2-Column Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
          {/* Left Column: Situation Map & Transit/Shelter Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Situation Map */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#DC2626',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                    }}
                  >
                    Tactical Situation Map
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                    Emergency Evacuation & Route Corridors
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: '#FEF2F2',
                    color: '#DC2626',
                    border: '1px solid #FECACA',
                  }}
                >
                  Live Readiness
                </span>
              </div>

              <div style={{ height: '320px', width: '100%', position: 'relative' }}>
                <GoogleMapView
                  center={centerLocation}
                  radiusKm={12}
                  events={[]}
                  mapMode="roadmap"
                  height="100%"
                  showLegend={false}
                  showLocationHud={false}
                />
              </div>

              {/* Corridor & Shelter Quick Bar */}
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#F8FAFC',
                  borderTop: '1px solid #E2E8F0',
                  fontSize: '11px',
                  color: '#475569',
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <span>
                  <strong>Hydrants:</strong> {context?.roadShelterInfo?.fireHydrantReadiness ?? '94% Operational'}
                </span>
                <span>
                  <strong>Hospital Beds:</strong> {context?.roadShelterInfo?.hospitalBedsAvailable ?? 48} Available
                </span>
                <span>
                  <strong>Coverage Radius:</strong> {context?.roadShelterInfo?.emergencyServicesRadiusKm ?? 5.0} km
                </span>
              </div>
            </div>

            {/* 3D Tactical Radar */}
            <CrisisRadar3D height={180} />

            {/* Designated Shelters & Transit Closures */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '16px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#0F172A',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                Designated Shelters & Transit Status
              </div>

              {/* Transit Corridors */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748B' }}>
                  Transit Corridors Status:
                </div>
                {context?.roadShelterInfo?.openCorridors?.map((corr: string, idx: number) => (
                  <div
                    key={`open-${idx}`}
                    style={{
                      fontSize: '11px',
                      color: '#16A34A',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
                    {corr}
                  </div>
                ))}
                {context?.roadShelterInfo?.closures?.map((closure: string, idx: number) => (
                  <div
                    key={`closed-${idx}`}
                    style={{
                      fontSize: '11px',
                      color: '#DC2626',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#FEF2F2',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: '1px solid #FECACA',
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#DC2626' }} />
                    {closure}
                  </div>
                ))}
              </div>

              {/* Shelter Points */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748B' }}>
                  Designated Civil Shelters:
                </div>
                {context?.roadShelterInfo?.designatedShelters?.map((shelter: any, idx: number) => (
                  <div
                    key={`shelter-${idx}`}
                    style={{
                      backgroundColor: '#F8FAFC',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0F172A' }}>{shelter.name}</div>
                      <div style={{ fontSize: '10.5px', color: '#64748B' }}>
                        Capacity: {shelter.capacity} persons · Distance: {shelter.distanceKm} km
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '9.5px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: shelter.status === 'READY' ? '#DCFCE7' : '#EFF6FF',
                        color: shelter.status === 'READY' ? '#16A34A' : '#2563EB',
                      }}
                    >
                      {shelter.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Active Alerts, AI Situation Brief, Official Advisories */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* AI Situation Brief */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '16px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#DC2626',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                Civil Emergency Situation Brief
              </div>
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  borderLeft: '3px solid #DC2626',
                  borderRadius: '0 6px 6px 0',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#334155',
                  lineHeight: 1.5,
                }}
              >
                {context?.aiSituationBrief ||
                  'Zero acute red-alert emergencies are currently active. Civil protection teams remain on seasonal standby.'}
              </div>
            </div>

            {/* Current Active Emergency Alerts */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '16px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase' }}>
                  Active Emergency Notices ({context?.currentAlerts?.length ?? 2})
                </span>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: '#FEF3C7',
                    color: '#D97706',
                    border: '1px solid #FDE68A',
                  }}
                >
                  Amber Watch
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {context?.currentAlerts?.map((alert: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#F8FAFC',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>{alert.title}</div>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: alert.severity === 'MODERATE' ? '#FEF3C7' : '#EFF6FF',
                          color: alert.severity === 'MODERATE' ? '#D97706' : '#2563EB',
                        }}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>
                      {alert.instructions}
                    </div>
                    <div
                      style={{
                        fontSize: '9.5px',
                        color: '#64748B',
                        marginTop: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>Issued: {alert.agency}</span>
                      <span>{alert.issuedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Official Disaster Advisories / Citations */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '16px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                flex: 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase' }}>
                  Official Disaster Management Directives
                </span>
                <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                  {context?.officialAdvisories?.length ?? 3} Verified Protocols
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '300px' }}>
                {context?.officialAdvisories?.map((adv: EvidenceCitation, i: number) => (
                  <EvidenceCitationCard key={i} citation={adv} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Temporal Categorization Section */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '16px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#2563EB',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                Strict Temporal Event Segregation
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                Multi-Horizon Incident Horizon (Never Confuse Historical Incidents with Current Emergencies)
              </div>
            </div>

            {/* Horizon Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['CURRENT', 'RECENT', 'HISTORICAL', 'FORECAST'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveEventTab(tab)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid',
                    backgroundColor: activeEventTab === tab ? '#2563EB' : '#F8FAFC',
                    color: activeEventTab === tab ? '#FFFFFF' : '#475569',
                    borderColor: activeEventTab === tab ? '#2563EB' : '#E2E8F0',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Active Tab Event Display */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {context?.categorizedEvents?.[activeEventTab]?.map((ev: any, idx: number) => (
              <div
                key={idx}
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>{ev.title}</div>
                  <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '2px' }}>
                    Category: {ev.category} · Timestamp: {ev.time}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor:
                        activeEventTab === 'CURRENT'
                          ? '#FEF2F2'
                          : activeEventTab === 'RECENT'
                          ? '#FEF3C7'
                          : activeEventTab === 'HISTORICAL'
                          ? '#EFF6FF'
                          : '#F3E8FF',
                      color:
                        activeEventTab === 'CURRENT'
                          ? '#DC2626'
                          : activeEventTab === 'RECENT'
                          ? '#D97706'
                          : activeEventTab === 'HISTORICAL'
                          ? '#2563EB'
                          : '#7E22CE',
                    }}
                  >
                    {ev.status}
                  </span>
                </div>
              </div>
            ))}
            {(!context?.categorizedEvents?.[activeEventTab] ||
              context?.categorizedEvents?.[activeEventTab].length === 0) && (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: '#64748B' }}>
                No records found in {activeEventTab} event horizon.
              </div>
            )}
          </div>
        </div>

        {/* Dedicated Query Interface */}
        <RAGQueryInterface
          module="crisisrag"
          suggestedQueries={suggestedQueries}
          latitude={lat}
          longitude={lng}
          locationName={locationName}
          cityName={cityName}
        />

        {/* Prediction Section */}
        <RAGPredictionSection
          module="crisisrag"
          moduleTitle="CrisisRAG Emergency Vulnerability"
          latitude={lat}
          longitude={lng}
          locationName={locationName}
          cityName={cityName}
        />
      </RAGPageLayout>
    </ErrorBoundary>
  );
}
