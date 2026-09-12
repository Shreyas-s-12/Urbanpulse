"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ResolvedLocation } from '@shared/types';

type MapMode = 'myLocation' | 'selectOnMap';

interface MapContextProps {
  centerLocation: ResolvedLocation | null;
  setCenterLocation: (loc: ResolvedLocation | null) => void;
  selectedRadiusKm: number;
  setSelectedRadiusKm: (radius: number) => void;
  mapMode: 'roadmap' | 'satellite' | 'terrain';
  mode: MapMode;
  setMode: (mode: MapMode) => void;
  setMapMode: (mode: 'roadmap' | 'satellite' | 'terrain') => void;
}

const MapContext = createContext<MapContextProps | undefined>(undefined);

export const MapProvider = ({ children }: { children: ReactNode }) => {
  const [centerLocation, setCenterLocation] = useState<ResolvedLocation | null>(null);
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number>(25);
  const [mode, setMode] = useState<MapMode>('myLocation');
  const [mapMode, setMapMode] = useState<'roadmap' | 'satellite' | 'terrain'>('roadmap');

  return (
    <MapContext.Provider
      value={{
        centerLocation,
        setCenterLocation,
        selectedRadiusKm,
        setSelectedRadiusKm,
        mode,
        setMode,
        mapMode,
        setMapMode,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

export const useMapContext = (): MapContextProps => {
  const ctx = useContext(MapContext);
  if (!ctx) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return ctx;
};
