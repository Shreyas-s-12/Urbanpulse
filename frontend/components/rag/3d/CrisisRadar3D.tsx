'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CrisisRadar3DProps {
  height?: number;
}

function RadarDome() {
  const sweepRef = useRef<THREE.Mesh>(null);
  const ringsRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (sweepRef.current) {
      sweepRef.current.rotation.z -= delta * 1.8;
    }
    if (ringsRef.current) {
      ringsRef.current.rotation.z += delta * 0.1;
    }
  });

  return (
    <group rotation={[-Math.PI / 3.4, 0, 0]}>
      {/* Concentric distance rings */}
      <group ref={ringsRef}>
        {[1.0, 1.8, 2.5].map((r, i) => (
          <mesh key={i}>
            <ringGeometry args={[r - 0.02, r, 64]} />
            <meshBasicMaterial color="#38BDF8" transparent opacity={0.35} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      {/* Rotating Radar Sweep Sector */}
      <mesh ref={sweepRef}>
        <ringGeometry args={[0, 2.5, 32, 1, 0, Math.PI / 3.5]} />
        <meshBasicMaterial
          color="#DC2626"
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Center Tactical Beacon */}
      <mesh position={[0, 0, 0.1]}>
        <circleGeometry args={[0.08, 16]} />
        <meshBasicMaterial color="#EF4444" />
      </mesh>
    </group>
  );
}

export default function CrisisRadar3D({ height = 180 }: CrisisRadar3DProps) {
  const [hasWebGL, setHasWebGL] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setHasWebGL(Boolean(gl));
    } catch {
      setHasWebGL(false);
    }
  }, []);

  if (!mounted || !hasWebGL) {
    return (
      <div
        style={{
          height: `${height}px`,
          width: '100%',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: '11px',
          gap: '6px',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10" />
          <path d="m4.93 4.93 4.24 4.24" />
          <circle cx="12" cy="12" r="2" />
        </svg>
        <span>Tactical Hazard Monitoring Radar</span>
      </div>
    );
  }

  return (
    <div
      style={{
        height: `${height}px`,
        width: '100%',
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '10px',
          zIndex: 10,
          fontSize: '10px',
          fontWeight: 700,
          color: '#F87171',
          letterSpacing: '0.4px',
          textTransform: 'uppercase',
        }}
      >
        Live Tactical Hazard Radar Sweep
      </div>
      <Canvas
        camera={{ position: [0, -2.2, 3.0], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.8} />
        <RadarDome />
      </Canvas>
    </div>
  );
}
