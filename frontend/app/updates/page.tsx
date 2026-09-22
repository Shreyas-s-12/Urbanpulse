import React from 'react';
import { Metadata } from 'next';
import UpdatesView from '@/features/updates/UpdatesView';

export const metadata: Metadata = {
  title: 'City Updates & Alerts | UrbanPulse',
  description: 'Live verified civic and urban intelligence updates for Mysuru across traffic, weather, crime, hazards, and municipal operations.',
};

export default function UpdatesPage() {
  return <UpdatesView />;
}
