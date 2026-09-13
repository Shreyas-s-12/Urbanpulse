'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LandingScreen from '@/features/landing/LandingScreen';
import AgentHomeView from '@/features/agent/AgentHomeView';

export default function HomePage() {
  const router = useRouter();
  const [hasStarted, setHasStarted] = useState<boolean>(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const started = sessionStorage.getItem('up_agent_started');
        if (started === 'true') {
          setHasStarted(true);
        }
      }
    } catch {}
  }, []);

  const handleStart = () => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('up_agent_started', 'true');
      }
    } catch {}
    setHasStarted(true);
  };

  if (!hasStarted) {
    return <LandingScreen onStart={handleStart} />;
  }

  return <AgentHomeView />;
}
