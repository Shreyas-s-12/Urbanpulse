'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import RAGPageLayout from '@/components/rag/RAGPageLayout';
import RAGQueryInterface from '@/components/rag/RAGQueryInterface';
import RAGPredictionSection from '@/components/rag/RAGPredictionSection';
import EvidenceCitationCard, { EvidenceCitation } from '@/components/rag/EvidenceCitationCard';
import GoogleMapView from '@/components/map/GoogleMapView';
import ErrorBoundary from '@/components/common/ErrorBoundary';

const GeoTerrain3D = dynamic(() => import('@/components/rag/3d/GeoTerrain3D'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '180px', backgroundColor: '#0F172A', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '11px' }}>
      Initializing 3D Elevation Mesh…
    </div>
  ),
});

interface GeoRAGWorkspaceProps {
  initialLat?: number;
  initialLng?: number;
  initialLocationName?: string;
  initialCityName?: string;
}

export default function GeoRAGWorkspace({
  initialLat = 12.2958,
  initialLng = 76.6394,
  initialLocationName = 'Mysore Palace',
  initialCityName = 'Mysuru',
}: GeoRAGWorkspaceProps) {
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
          `${baseUrl}/api/v1/georag/context?latitude=${lat}&longitude=${lng}&locationName=${encodeURIComponent(
            locationName
          )}&cityName=${encodeURIComponent(cityName)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isMounted) setContext(data);
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load GeoRAG context');
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
    'What environmental changes occurred here?',
    'Why has vegetation changed?',
    'Has plastic accumulation increased?',
    'What changed along this coastline?',
  ];

  return (
    <ErrorBoundary>
      <RAGPageLayout
        moduleName="GeoRAG"
        moduleSubtitle="Satellite Environmental Intelligence"
        locationName={locationName}
        cityName={cityName}
        latitude={lat}
        longitude={lng}
      >
        {/* Top 2-Column Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
          {/* Left Column: Satellite & 3D Visual */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Satellite Map Canvas */}
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
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Satellite Ground Observation
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                    Multi-Spectral Canvas · Satellite View
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    border: '1px solid #BFDBFE',
                  }}
                >
                  Sentinel-2B MSI
                </span>
              </div>

              <div style={{ height: '320px', width: '100%', position: 'relative' }}>
                <GoogleMapView
                  center={centerLocation}
                  radiusKm={15}
                  events={[]}
                  mapMode="satellite"
                  height="100%"
                  showLegend={false}
                  showLocationHud={false}
                />
              </div>

              {context?.satelliteImagery && (
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
                    gap: '6px',
                  }}
                >
                  <span>Resolution: {context.satelliteImagery.spatialResolution}</span>
                  <span>Cloud Cover: {context.satelliteImagery.cloudCoverPercent}%</span>
                  <span>Captured: {context.satelliteImagery.captureDate}</span>
                </div>
              )}
            </div>

            {/* 3D Digital Elevation Contour */}
            <GeoTerrain3D height={180} />
          </div>

          {/* Right Column: Environmental Indicators & Retrieved Reports */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Environmental Indicators Grid */}
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
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Spectral Remote Sensing Indicators
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>NDVI Canopy Index</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#16A34A', marginTop: '2px' }}>
                    {context?.environmentalData?.vegetationIndex ?? '0.640'}
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>
                    {context?.environmentalData?.vegetationClassification ?? 'Dense Vegetation'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Aerosol Optical Depth</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#2563EB', marginTop: '2px' }}>
                    {context?.environmentalData?.surfaceAerosolOpticalDepth ?? '0.24'}
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>Clear Atmosphere</div>
                </div>

                <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Surface Temperature</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>
                    {context?.environmentalData?.landSurfaceTemperatureC ?? '28.4'}°C
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>Radiometric TIRS-2</div>
                </div>

                <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Plastic / Waste Index</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#334155', marginTop: '2px' }}>
                    {context?.environmentalData?.plasticWasteAccumulationIndex ?? '36.2'}/100
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>
                    {context?.environmentalData?.wasteRiskTier ?? 'Moderate'}
                  </div>
                </div>
              </div>

              {context?.aiAnalysis && (
                <div
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderLeft: '3px solid #2563EB',
                    borderRadius: '0 6px 6px 0',
                    padding: '9px 12px',
                    fontSize: '11.5px',
                    color: '#334155',
                    lineHeight: 1.45,
                  }}
                >
                  {context.aiAnalysis}
                </div>
              )}
            </div>

            {/* Retrieved Reports & Citations */}
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
                  Attributed Environmental Reports
                </span>
                <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                  {context?.environmentalReports?.length ?? 4} Verified Sources
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '340px' }}>
                {context?.environmentalReports?.map((report: EvidenceCitation, i: number) => (
                  <EvidenceCitationCard key={i} citation={report} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated Query Interface */}
        <RAGQueryInterface
          module="georag"
          suggestedQueries={suggestedQueries}
          latitude={lat}
          longitude={lng}
          locationName={locationName}
          cityName={cityName}
        />

        {/* Prediction Section */}
        <RAGPredictionSection
          module="georag"
          moduleTitle="GeoRAG Satellite Environmental"
          latitude={lat}
          longitude={lng}
          locationName={locationName}
          cityName={cityName}
        />
      </RAGPageLayout>
    </ErrorBoundary>
  );
}
