'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CrisisRAGWorkspace from '@/features/rag/CrisisRAGWorkspace';
import { useLocationStore } from '@/stores/useLocationStore';

function CrisisRAGContent() {
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
    <CrisisRAGWorkspace
      initialLat={lat}
      initialLng={lng}
      initialLocationName={locationName}
      initialCityName={cityName}
    />
  );
}

export default function CrisisRAGPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--background)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Loading CrisisRAG Intelligence Workspace...
        </div>
      }
    >
      <CrisisRAGContent />
    </Suspense>
  );
}
