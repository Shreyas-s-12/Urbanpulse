'use client';

import React from 'react';

interface NexusUserMessageProps {
  content: string;
}

export default function NexusUserMessage({ content }: NexusUserMessageProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        width: '100%',
      }}
    >
      <div
        style={{
          maxWidth: '88%',
          width: 'fit-content',
          backgroundColor: '#2563EB',
          color: '#FFFFFF',
          borderRadius: '14px 14px 4px 14px',
          padding: '10px 14px',
          fontSize: '13px',
          lineHeight: 1.45,
          fontWeight: 400,
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          boxSizing: 'border-box',
        }}
      >
        {content}
      </div>
    </div>
  );
}
