'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AquaRAGWorkspace from '@/features/rag/AquaRAGWorkspace';
import { useLocationStore } from '@/stores/useLocationStore';

function AquaRAGContent() {
  const searchParams = useSearchParams();
  const currentLocation = useLocationStore((s) => s.currentLocation);

  const queryLat = searchParams.get('lat');
  const queryLng = searchParams.get('lng');
  const queryLoc = searchParams.get('location') || searchParams.get('name');
  const queryCity = searchParams.get('city');

  const lat = queryLat ? parseFloat(queryLat) : currentLocation?.latitude ?? 12.2958;
  const lng = queryLng ? parseFloat(queryLng) : currentLocation?.longitude ?? 76.6394;
  const locationName = queryLoc || currentLocation?.displayName || 'Mysore Palace';
  const cityName = queryCity || currentLocation?.city || 'Mysuru';

  return (
    <AquaRAGWorkspace
      initialLat={lat}
      initialLng={lng}
      initialLocationName={locationName}
      initialCityName={cityName}
    />
  );
}

export default function AquaRAGPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F8FAFC',
            color: '#64748B',
            fontFamily: 'var(--font-inter, sans-serif)',
          }}
        >
          Loading AquaRAG Intelligence Workspace...
        </div>
      }
    >
      <AquaRAGContent />
    </Suspense>
  );
}
