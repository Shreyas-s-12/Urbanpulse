'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ResolvedLocation, UnifiedCityEvent, CandidateRoute } from '@shared/types';

interface SpatialMapProps {
  center: ResolvedLocation | null;
  radiusKm: number;
  events: UnifiedCityEvent[];
  activeRoute?: CandidateRoute | null;
  onSelectEvent?: (event: UnifiedCityEvent) => void;
  height?: string;
}

export default function SpatialMap({
  center,
  radiusKm,
  events,
  activeRoute,
  onSelectEvent,
  height = '100%',
}: SpatialMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<UnifiedCityEvent | null>(null);
  const [animationTick, setAnimationTick] = useState(0);

  // Animation loop for pulsing seismic rings and radar sweep
  useEffect(() => {
    let frameId: number;
    const loop = () => {
      setAnimationTick((prev) => (prev + 1) % 360);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !center) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    const heightPx = (canvas.height = canvas.parentElement?.clientHeight || 600);

    // Map Center in Canvas
    const cx = width / 2;
    const cy = heightPx / 2;

    // Scale: map radiusKm to fit within 75% of minimum canvas dimension
    const maxPixelRadius = Math.min(width, heightPx) * 0.38;
    const kmToPixels = maxPixelRadius / Math.max(radiusKm, 5);

    // Clear background
    ctx.fillStyle = '#EEF2F6';
    ctx.fillRect(0, 0, width, heightPx);

    // Draw Subtle Grid Lines (Lat/Long simulation)
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, heightPx);
      ctx.stroke();
    }
    for (let y = 0; y < heightPx; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw Simulated Regional Arterials and Roads
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    // Major Diagonal Expressway
    ctx.moveTo(0, cy * 0.4);
    ctx.bezierCurveTo(cx * 0.6, cy * 0.8, cx * 1.3, cy * 1.1, width, cy * 1.5);
    ctx.stroke();

    // Outer Ring Bypass
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, maxPixelRadius * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    // Draw 50 km Geographic Intelligence Radius Boundary
    ctx.beginPath();
    ctx.arc(cx, cy, maxPixelRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(19, 184, 135, 0.03)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(19, 184, 135, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Radial Radar Pulse Animation
    const pulseRadius = (animationTick % 120) * (maxPixelRadius / 120);
    ctx.beginPath();
    ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(19, 184, 135, ${Math.max(0, 0.35 - pulseRadius / maxPixelRadius)})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Radius Label
    ctx.fillStyle = 'var(--text-muted)';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(`${radiusKm} km Radial Boundary`, cx - 55, cy - maxPixelRadius - 8);

    // Draw Active Candidate Route Polyline if present
    if (activeRoute && activeRoute.polyline.length > 1) {
      ctx.strokeStyle = '#367FF2';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      activeRoute.polyline.forEach((pt, idx) => {
        const px = cx + (pt.longitude - center.longitude) * 111.0 * kmToPixels;
        const py = cy - (pt.latitude - center.latitude) * 111.0 * kmToPixels;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    // Draw Events
    events.forEach((ev) => {
      // 1 degree latitude ~ 111 km
      const dxKm = (ev.longitude - center.longitude) * 111.0 * Math.cos((center.latitude * Math.PI) / 180);
      const dyKm = (ev.latitude - center.latitude) * 111.0;

      const px = cx + dxKm * kmToPixels;
      const py = cy - dyKm * kmToPixels;

      // Skip rendering if outside visible canvas
      if (px < -20 || px > width + 20 || py < -20 || py > heightPx + 20) return;

      const isHovered = hoveredEvent?.eventId === ev.eventId;

      // Special rendering for earthquakes: expanding seismic shock rings
      if (ev.eventType === 'EARTHQUAKE') {
        const quakeRing = (animationTick % 60) * 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 14 + quakeRing, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${Math.max(0, 0.6 - quakeRing / 40)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Special rendering for floods: semi-transparent flood risk pool
      if (ev.eventType === 'FLOOD') {
        ctx.beginPath();
        ctx.arc(px, py, 24, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(54, 127, 242, 0.15)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(54, 127, 242, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Marker Dot
      ctx.beginPath();
      const dotRadius = isHovered ? 9 : 6.5;
      ctx.arc(px, py, dotRadius, 0, Math.PI * 2);

      let color = '#13B887';
      if (ev.severity >= 75) color = '#EF4444';
      else if (ev.severity >= 55) color = '#F59E0B';
      else if (ev.severity >= 35) color = '#367FF2';

      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Tooltip/Label on hover
      if (isHovered) {
        ctx.fillStyle = '#11161B';
        ctx.font = 'bold 12px -apple-system, sans-serif';
        const label = `${ev.eventType}: ${ev.title.slice(0, 32)}... (${ev.severity}/100)`;
        const textWidth = ctx.measureText(label).width;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
        ctx.fillRect(px - textWidth / 2 - 8, py - 38, textWidth + 16, 26);
        ctx.strokeStyle = '#CBD5E1';
        ctx.strokeRect(px - textWidth / 2 - 8, py - 38, textWidth + 16, 26);

        ctx.fillStyle = '#11161B';
        ctx.fillText(label, px - textWidth / 2, py - 21);
      }
    });

    // Draw User / Active Center Location Pin
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#11161B';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(17, 22, 27, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [center, radiusKm, events, activeRoute, hoveredEvent, animationTick]);

  // Handle Canvas Mouse Move for Hover Detection
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !center) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const width = canvas.width;
    const heightPx = canvas.height;
    const cx = width / 2;
    const cy = heightPx / 2;
    const maxPixelRadius = Math.min(width, heightPx) * 0.38;
    const kmToPixels = maxPixelRadius / Math.max(radiusKm, 5);

    let found: UnifiedCityEvent | null = null;
    for (const ev of events) {
      const dxKm = (ev.longitude - center.longitude) * 111.0 * Math.cos((center.latitude * Math.PI) / 180);
      const dyKm = (ev.latitude - center.latitude) * 111.0;
      const px = cx + dxKm * kmToPixels;
      const py = cy - dyKm * kmToPixels;

      const dist = Math.hypot(mouseX - px, mouseY - py);
      if (dist <= 14) {
        found = ev;
        break;
      }
    }

    setHoveredEvent(found);
  };

  const handleClick = () => {
    if (hoveredEvent && onSelectEvent) {
      onSelectEvent(hoveredEvent);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden', backgroundColor: '#EEF2F6' }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        style={{ width: '100%', height: '100%', display: 'block', cursor: hoveredEvent ? 'pointer' : 'default' }}
      />

      {/* Floating Spatial Compass / Coordinate Tag */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(8px)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: '12px',
        }}
      >
        <span>
          <strong>Center:</strong> {center ? `${center.latitude.toFixed(4)}°N, ${center.longitude.toFixed(4)}°E` : 'Locating...'}
        </span>
        <span>
          <strong>Projection:</strong> WGS 84 (EPSG:4326)
        </span>
      </div>
    </div>
  );
}
