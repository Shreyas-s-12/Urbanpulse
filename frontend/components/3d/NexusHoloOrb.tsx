'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface NexusHoloOrbProps {
  size?: number;
  className?: string;
  interactive?: boolean;
}

// Inner 3D Sphere & Orbital Rings
function HoloSphere({ interactive = true }: { interactive?: boolean }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Generate node particles on a sphere surface
  const [particlePositions] = useState(() => {
    const coords = [];
    const count = 48;
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const radius = 1.35;
      coords.push(
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.sin(theta) * Math.sin(phi),
        radius * Math.cos(phi)
      );
    }
    return new Float32Array(coords);
  });

  useFrame((state, delta) => {
    // Subtle rotation speeds
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.4;
      coreRef.current.rotation.x += delta * 0.15;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.6;
      ring1Ref.current.rotation.y += delta * 0.25;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y -= delta * 0.5;
      ring2Ref.current.rotation.z += delta * 0.35;
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.z += delta * 0.4;
      ring3Ref.current.rotation.x -= delta * 0.3;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group>
      {/* Ambient and point lights */}
      <ambientLight intensity={0.8} />
      <pointLight position={[5, 5, 5]} intensity={1.5} color="#3B82F6" />
      <pointLight position={[-5, -5, -5]} intensity={0.8} color="#06B6D4" />

      {/* Core wireframe sphere */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[1.0, 18, 18]} />
        <meshStandardMaterial
          color="#2563EB"
          wireframe
          transparent
          opacity={0.4}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Inner glowing core */}
      <mesh>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshBasicMaterial color="#3B82F6" transparent opacity={0.35} />
      </mesh>

      {/* Equatorial Telemetry Orbit Ring 1 */}
      <mesh ref={ring1Ref}>
        <torusGeometry args={[1.4, 0.02, 16, 64]} />
        <meshBasicMaterial color="#0284C7" transparent opacity={0.65} />
      </mesh>

      {/* Polar Telemetry Orbit Ring 2 */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[1.5, 0.015, 16, 64]} />
        <meshBasicMaterial color="#2563EB" transparent opacity={0.5} />
      </mesh>

      {/* Oblique Sensor Orbit Ring 3 */}
      <mesh ref={ring3Ref} rotation={[-Math.PI / 4, Math.PI / 6, 0]}>
        <torusGeometry args={[1.6, 0.012, 16, 64]} />
        <meshBasicMaterial color="#60A5FA" transparent opacity={0.4} />
      </mesh>

      {/* Sensor Node Points */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlePositions.length / 3}
            array={particlePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.065}
          color="#38BDF8"
          transparent
          opacity={0.85}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

// 2D Premium Fallback when WebGL unavailable or reduced motion preferred
function OrbFallback2D({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #60A5FA 0%, #2563EB 50%, #1E40AF 100%)',
        boxShadow: '0 0 16px rgba(37, 99, 235, 0.35), inset 0 0 8px rgba(255, 255, 255, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <svg
        width={size * 0.75}
        height={size * 0.75}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.9 }}
      >
        <circle cx="12" cy="12" r="10" strokeDasharray="3 3" />
        <ellipse cx="12" cy="12" rx="10" ry="4" />
        <line x1="12" y1="2" x2="12" y2="22" />
      </svg>
    </div>
  );
}

// Main NexusHoloOrb Component
export default function NexusHoloOrb({
  size = 64,
  className,
  interactive = true,
}: NexusHoloOrbProps) {
  const [canRender3D, setCanRender3D] = useState<boolean | null>(null);

  useEffect(() => {
    // Check WebGL availability and prefers-reduced-motion
    try {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) {
        setCanRender3D(false);
        return;
      }

      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
      setCanRender3D(Boolean(gl));
    } catch {
      setCanRender3D(false);
    }
  }, []);

  // SSR or determining state
  if (canRender3D === null) {
    return <div style={{ width: size, height: size }} />;
  }

  // 2D Fallback
  if (!canRender3D) {
    return <OrbFallback2D size={size} />;
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.8], fov: 45 }}
        style={{ width: size, height: size, background: 'transparent' }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      >
        <HoloSphere interactive={interactive} />
      </Canvas>
    </div>
  );
}
