'use client';

import React from 'react';

interface CommandNavSidebarProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  activeIncidentsCount: number;
}

export default function CommandNavSidebar({
  selectedCategory,
  onSelectCategory,
  activeIncidentsCount,
}: CommandNavSidebarProps) {
  const navItems = [
    { id: 'LIVE', label: 'Live Overview', count: null },
    { id: 'RISKS', label: 'Risk Radar', count: 'Active' },
    { id: 'INCIDENTS', label: 'Incidents', count: activeIncidentsCount > 0 ? activeIncidentsCount : null },
    { id: 'TRAFFIC', label: 'Traffic & Corridors', count: null },
    { id: 'WEATHER', label: 'Meteorology', count: null },
    { id: 'SAFETY', label: 'Civic Safety', count: null },
    { id: 'INFRASTRUCTURE', label: 'Infrastructure', count: null },
    { id: 'FORECAST', label: 'Predictive Horizon', count: null },
    { id: 'ALERTS', label: 'Active Alerts', count: activeIncidentsCount },
    { id: 'MISSIONS', label: 'Mission Control', count: null },
  ];

  return (
    <aside
      style={{
        width: '210px',
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 8px',
        flexShrink: 0,
        gap: '4px',
        overflowY: 'auto',
      }}
    >
      <div style={{ padding: '4px 8px 8px 8px', fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>
        COMMAND FEEDS
      </div>

      {navItems.map((item) => {
        const isSelected = selectedCategory === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectCategory(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
              color: isSelected ? '#1D4ED8' : '#374151',
              fontWeight: isSelected ? 700 : 500,
              fontSize: '12px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = '#F9FAFB';
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span>{item.label}</span>
            {item.count !== null && (
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '10px',
                  backgroundColor: isSelected ? '#DBEAFE' : '#F3F4F6',
                  color: isSelected ? '#1E40AF' : '#4B5563',
                }}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
}
