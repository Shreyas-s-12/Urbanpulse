'use client';

import React, { useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

export default function ClientInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useSettingsStore.getState().initializeFromStorage();
  }, []);

  return <>{children}</>;
}
