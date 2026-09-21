'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AquaFlow3DProps {
  height?: number;
}

function WaterWaveMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const [geometry] = useState(() => new THREE.PlaneGeometry(3.6, 3.6, 24, 24));

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * 1.5;
    if (meshRef.current) {
      const pos = meshRef.current.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = Math.sin(x * 2.0 + t) * 0.18 + Math.cos(y * 2.5 + t * 0.8) * 0.15;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
      meshRef.current.geometry.computeVertexNormals();
    }
  });

  return (
    <group rotation={[-Math.PI / 3.0, 0, 0]}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color="#0284C7"
          roughness={0.2}
          metalness={0.4}
          flatShading
          transparent
          opacity={0.88}
        />
      </mesh>
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#7DD3FC" wireframe transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

export default function AquaFlow3D({ height = 180 }: AquaFlow3DProps) {
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
          backgroundColor: '#F8FAFC',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748B',
          fontSize: '11px',
          gap: '6px',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="1.8">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
        <span>Hydrological Riparian Basin Model</span>
      </div>
    );
  }

  return (
    <div
      style={{
        height: `${height}px`,
        width: '100%',
        backgroundColor: '#0F172A',
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
          color: '#38BDF8',
          letterSpacing: '0.4px',
          textTransform: 'uppercase',
        }}
      >
        Dynamic Aquatic Fluid Dispersion Mesh
      </div>
      <Canvas
        camera={{ position: [0, -1.8, 3.0], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 4, 6]} intensity={1.5} color="#E0F2FE" />
        <WaterWaveMesh />
      </Canvas>
    </div>
  );
}
