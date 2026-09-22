import React from 'react';
import { Metadata } from 'next';
import UrbanConditionView from '@/features/intelligence/UrbanConditionView';

export const metadata: Metadata = {
  title: 'Urban Analytics & Intelligence | UrbanPulse',
  description: 'Real-time urban condition analytics, multi-domain sensor intelligence, and city health metrics for Mysore and regional networks.',
};

export default function AnalyticsPage() {
  return <UrbanConditionView />;
}
