'use client';

import React, { useEffect } from 'react';
import MainScreen from '@/features/overview/MainScreen';
import { useResearchStore } from '@/stores/useResearchStore';

export default function ResearchPage() {
  const setResearchModeOpen = useResearchStore((s) => s.setResearchModeOpen);

  useEffect(() => {
    setResearchModeOpen(true);
  }, [setResearchModeOpen]);

  return <MainScreen />;
}
