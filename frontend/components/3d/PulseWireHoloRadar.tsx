'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RadioIcon } from '@/components/common/Icons';

interface PulseWireHoloRadarProps {
  size?: number;
}

function RadarScene() {
  const sweepRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (sweepRef.current) {
      sweepRef.current.rotation.z += delta * 1.5;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.4;
      ring1Ref.current.rotation.y += delta * 0.3;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y -= delta * 0.35;
      ring2Ref.current.rotation.z += delta * 0.2;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.9} />
      <pointLight position={[3, 3, 3]} intensity={1.5} color="#06B6D4" />

      {/* Outer subtle orbital ring */}
      <mesh ref={ring1Ref}>
        <torusGeometry args={[1.3, 0.02, 16, 48]} />
        <meshBasicMaterial color="#0284C7" transparent opacity={0.55} />
      </mesh>

      {/* Inner oblique ring */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[1.05, 0.018, 16, 48]} />
        <meshBasicMaterial color="#06B6D4" transparent opacity={0.65} />
      </mesh>

      {/* Central radar sweep line */}
      <mesh ref={sweepRef}>
        <planeGeometry args={[0.04, 1.8]} />
        <meshBasicMaterial color="#38BDF8" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* Glowing center emitter node */}
      <mesh>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshBasicMaterial color="#0284C7" />
      </mesh>
    </group>
  );
}

export default function PulseWireHoloRadar({ size = 28 }: PulseWireHoloRadarProps) {
  const [hasWebGl, setHasWebGl] = React.useState(true);

  if (!hasWebGl) {
    return <RadioIcon size={size} color="var(--accent-primary)" />;
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 45 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        onCreated={() => {}}
        onError={() => setHasWebGl(false)}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <RadarScene />
      </Canvas>
    </div>
  );
}
