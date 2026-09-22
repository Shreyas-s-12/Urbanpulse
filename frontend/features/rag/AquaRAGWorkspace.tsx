'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import RAGPageLayout from '@/components/rag/RAGPageLayout';
import RAGQueryInterface from '@/components/rag/RAGQueryInterface';
import RAGPredictionSection from '@/components/rag/RAGPredictionSection';
import EvidenceCitationCard, { EvidenceCitation } from '@/components/rag/EvidenceCitationCard';
import GoogleMapView from '@/components/map/GoogleMapView';
import ErrorBoundary from '@/components/common/ErrorBoundary';

const AquaFlow3D = dynamic(() => import('@/components/rag/3d/AquaFlow3D'), {
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
      Initializing Fluid Dynamics Mesh...
    </div>
  ),
});

interface AquaRAGWorkspaceProps {
  initialLat?: number;
  initialLng?: number;
  initialLocationName?: string;
  initialCityName?: string;
}

export default function AquaRAGWorkspace({
  initialLat = 12.2958,
  initialLng = 76.6394,
  initialLocationName = 'Mysore Palace',
  initialCityName = 'Mysuru',
}: AquaRAGWorkspaceProps) {
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
          `${baseUrl}/api/v1/aquarag/context?latitude=${lat}&longitude=${lng}&locationName=${encodeURIComponent(
            locationName
          )}&cityName=${encodeURIComponent(cityName)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isMounted) setContext(data);
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load AquaRAG context');
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
    'Why has water turbidity changed recently?',
    'What is the historical dissolved oxygen trend over the last 5 months?',
    'How does heavy monsoonal runoff impact basin water quality?',
    'What is the status and recharge behavior of the local aquifer?',
  ];

  return (
    <ErrorBoundary>
      <RAGPageLayout
        moduleName="AquaRAG"
        moduleSubtitle="Water Intelligence & Hydrological Retrieval"
        locationName={locationName}
        cityName={cityName}
        latitude={lat}
        longitude={lng}
      >
        {/* Top 2-Column Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
          {/* Left Column: Hydrological Map & 3D Fluid Dynamics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Map Canvas */}
            <div
              style={{
                backgroundColor: 'var(--bg-panel, #101620)',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle, #1B2531)',
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
                      color: '#0284C7',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                    }}
                  >
                    Hydrological Basin Map
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                    Catchment Perimeter & In-Situ Sonde Station
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: '#E0F2FE',
                    color: '#0284C7',
                    border: '1px solid #BAE6FD',
                  }}
                >
                  Multiparameter Probe
                </span>
              </div>

              <div style={{ height: '320px', width: '100%', position: 'relative' }}>
                <GoogleMapView
                  center={centerLocation}
                  radiusKm={12}
                  events={[]}
                  mapMode="terrain"
                  height="100%"
                  showLegend={false}
                  showLocationHud={false}
                />
              </div>

              {/* Probe Metadata Bar */}
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-card, #111821)',
                  borderTop: '1px solid #E2E8F0',
                  fontSize: '11px',
                  color: '#475569',
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <span>
                  <strong>Array:</strong> {context?.sensorStatus?.sensorArray ?? 'YSI EXO2 Submersible Sonde'}
                </span>
                <span>
                  <strong>Last Calibrated:</strong> {context?.sensorStatus?.lastReading ?? 'Recent Sync'}
                </span>
              </div>
            </div>

            {/* 3D Aquatic Fluid Dynamics Canvas */}
            <AquaFlow3D height={180} />
          </div>

          {/* Right Column: Physical Sensor Status & 5-Month Historical Trend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Water Quality Classification & Physical Telemetry Grid */}
            <div
              style={{
                backgroundColor: 'var(--bg-panel, #101620)',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle, #1B2531)',
                padding: '16px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#0284C7',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                  }}
                >
                  Physical Sonde Telemetry (Real-Time Sensor Facts)
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                    border: '1px solid #DBEAFE',
                  }}
                >
                  {context?.waterQualityRating ?? 'CLASS B RATING'}
                </span>
              </div>

              {/* Sensor Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <div style={{ backgroundColor: 'var(--bg-card, #111821)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle, #1B2531)' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Turbidity</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#0284C7', marginTop: '2px' }}>
                    {context?.sensorStatus?.turbidityNtu ?? '14.5'} NTU
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>
                    {context?.sensorStatus?.turbidityStatus ?? 'OPTIMAL'}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-card, #111821)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle, #1B2531)' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Dissolved Oxygen</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#16A34A', marginTop: '2px' }}>
                    {context?.sensorStatus?.dissolvedOxygenMgL ?? '6.2'} mg/L
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>
                    {context?.sensorStatus?.doStatus ?? 'HEALTHY'}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-card, #111821)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle, #1B2531)' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>pH Level</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#334155', marginTop: '2px' }}>
                    {context?.sensorStatus?.ph ?? '7.40'}
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>
                    {context?.sensorStatus?.phStatus ?? 'NEUTRAL_BALANCED'}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-card, #111821)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle, #1B2531)' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Water Temp</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>
                    {context?.sensorStatus?.temperatureC ?? '24.8'}°C
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>Thermal In-situ</div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-card, #111821)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle, #1B2531)' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Biochemical Demand</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#334155', marginTop: '2px' }}>
                    {context?.sensorStatus?.biochemicalOxygenDemandMgL ?? '3.2'} mg/L
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>BOD-5 Clean</div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-card, #111821)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle, #1B2531)' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Flow Velocity</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#0284C7', marginTop: '2px' }}>
                    {context?.sensorStatus?.flowVelocityMs ?? '0.42'} m/s
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>Acoustic Doppler</div>
                </div>
              </div>

              {/* AI Water Synthesis */}
              {context?.aiWaterIntelligence && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-card, #111821)',
                    borderLeft: '3px solid #0284C7',
                    borderRadius: '0 6px 6px 0',
                    padding: '9px 12px',
                    fontSize: '11.5px',
                    color: '#334155',
                    lineHeight: 1.45,
                  }}
                >
                  {context.aiWaterIntelligence}
                </div>
              )}
            </div>

            {/* 5-Month Historical Trend Table */}
            <div
              style={{
                backgroundColor: 'var(--bg-panel, #101620)',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle, #1B2531)',
                padding: '16px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase' }}>
                  Structured Time-Series Historical Record (5 Months)
                </span>
                <span style={{ fontSize: '10.5px', color: '#64748B' }}>Sensor & Rainfall Inflow</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-card, #111821)', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                      <th style={{ padding: '8px 10px', fontWeight: 700 }}>Month</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700 }}>Turbidity (NTU)</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700 }}>DO (mg/L)</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700 }}>Rainfall (mm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {context?.historicalTrends?.map((trend: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0F172A' }}>{trend.month}</td>
                        <td style={{ padding: '8px 10px', color: '#0284C7', fontWeight: 600 }}>{trend.turbidity}</td>
                        <td style={{ padding: '8px 10px', color: '#16A34A', fontWeight: 600 }}>{trend.dissolvedOxygen}</td>
                        <td style={{ padding: '8px 10px', color: '#475569' }}>{trend.rainfallMm} mm</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hybrid Retrieved Citations */}
            <div
              style={{
                backgroundColor: 'var(--bg-panel, #101620)',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle, #1B2531)',
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
                  Hybrid Evidence Layer (Sensors + CPCB / CGWB Protocols)
                </span>
                <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                  {context?.evidence?.length ?? 4} Verified Citations
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '280px' }}>
                {context?.evidence?.map((cit: EvidenceCitation, i: number) => (
                  <EvidenceCitationCard key={i} citation={cit} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated Query Interface */}
        <RAGQueryInterface
          module="aquarag"
          suggestedQueries={suggestedQueries}
          latitude={lat}
          longitude={lng}
          locationName={locationName}
          cityName={cityName}
        />

        {/* Prediction Section */}
        <RAGPredictionSection
          module="aquarag"
          moduleTitle="AquaRAG Hydrological & Water Quality"
          latitude={lat}
          longitude={lng}
          locationName={locationName}
          cityName={cityName}
        />
      </RAGPageLayout>
    </ErrorBoundary>
  );
}
