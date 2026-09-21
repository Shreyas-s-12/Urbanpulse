'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GeoTerrain3DProps {
  height?: number;
  interactive?: boolean;
}

function TerrainMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.LineSegments>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 0.12;
    }
    if (wireframeRef.current) {
      wireframeRef.current.rotation.z += delta * 0.12;
    }
  });

  const [geometry] = useState(() => {
    const geom = new THREE.PlaneGeometry(3.6, 3.6, 24, 24);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const elevation =
        Math.sin(vx * 2.2) * 0.25 +
        Math.cos(vy * 2.5) * 0.28 +
        Math.sin((vx + vy) * 3.0) * 0.15;
      pos.setZ(i, elevation);
    }
    geom.computeVertexNormals();
    return geom;
  });

  return (
    <group rotation={[-Math.PI / 3.2, 0, 0]}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color="#2563EB"
          roughness={0.4}
          metalness={0.2}
          wireframe={false}
          flatShading
        />
      </mesh>
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#93C5FD" wireframe transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

export default function GeoTerrain3D({ height = 180, interactive = false }: GeoTerrain3DProps) {
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
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        <span>Satellite Terrain Elevation Profile</span>
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
          color: '#93C5FD',
          letterSpacing: '0.4px',
          textTransform: 'uppercase',
        }}
      >
        3D Digital Elevation Contour
      </div>
      <Canvas
        camera={{ position: [0, -1.8, 3.2], fov: 45 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <pointLight position={[-4, -4, 2]} intensity={0.5} color="#60A5FA" />
        <TerrainMesh />
      </Canvas>
    </div>
  );
}
