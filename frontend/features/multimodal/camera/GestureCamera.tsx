'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GestureDetector, GestureEvent, Landmark } from '../gestures/gestureDetector';

interface GestureCameraProps {
  isActive: boolean;
  onGesture: (event: GestureEvent) => void;
  onError: (errorMessage: string) => void;
  showPreview?: boolean;
}

export default function GestureCamera({
  isActive,
  onGesture,
  onError,
  showPreview = false,
}: GestureCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const detectorRef = useRef<GestureDetector>(new GestureDetector());
  const lastInferenceTimeRef = useRef<number>(0);

  const [cameraState, setCameraState] = useState<'IDLE' | 'STARTING' | 'RUNNING' | 'ERROR'>('IDLE');

  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    detectorRef.current.reset();
    setCameraState('IDLE');
  }, []);

  const detectHandFromCanvas = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): Landmark[] | null => {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      // Fast color & brightness center-of-mass heuristic for browser-local fallback
      let totalX = 0;
      let totalY = 0;
      let skinPixels = 0;
      let topY = height;
      let topX = width / 2;

      for (let y = 0; y < height; y += 4) {
        for (let x = 0; x < width; x += 4) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Basic skin-tone luminance heuristic in YCbCr/RGB
          if (r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
            totalX += x;
            totalY += y;
            skinPixels++;
            if (y < topY) {
              topY = y;
              topX = x;
            }
          }
        }
      }

      if (skinPixels < 120) {
        return null;
      }

      const centerX = totalX / skinPixels / width;
      const centerY = totalY / skinPixels / height;
      const tipX = topX / width;
      const tipY = topY / height;

      // Construct normalized 21-point hand skeleton from geometric tracking
      const landmarks: Landmark[] = [];
      // 0: Wrist
      landmarks.push({ x: centerX, y: Math.min(centerY + 0.25, 0.98) });
      // 1-4: Thumb
      landmarks.push({ x: centerX - 0.08, y: centerY + 0.15 });
      landmarks.push({ x: centerX - 0.12, y: centerY + 0.08 });
      landmarks.push({ x: centerX - 0.15, y: centerY });
      landmarks.push({ x: centerX - 0.16, y: tipY + 0.05 });
      // 5-8: Index finger
      landmarks.push({ x: centerX - 0.05, y: centerY + 0.05 });
      landmarks.push({ x: centerX - 0.05, y: centerY - 0.05 });
      landmarks.push({ x: tipX, y: (centerY + tipY) / 2 });
      landmarks.push({ x: tipX, y: tipY }); // Index tip
      // 9-12: Middle finger
      landmarks.push({ x: centerX, y: centerY + 0.05 });
      landmarks.push({ x: centerX, y: centerY - 0.05 });
      landmarks.push({ x: centerX, y: tipY + 0.02 });
      landmarks.push({ x: centerX, y: tipY });
      // 13-16: Ring finger
      landmarks.push({ x: centerX + 0.05, y: centerY + 0.05 });
      landmarks.push({ x: centerX + 0.05, y: centerY });
      landmarks.push({ x: centerX + 0.05, y: tipY + 0.04 });
      landmarks.push({ x: centerX + 0.05, y: tipY + 0.03 });
      // 17-20: Pinky finger
      landmarks.push({ x: centerX + 0.09, y: centerY + 0.08 });
      landmarks.push({ x: centerX + 0.09, y: centerY + 0.02 });
      landmarks.push({ x: centerX + 0.09, y: tipY + 0.06 });
      landmarks.push({ x: centerX + 0.09, y: tipY + 0.05 });

      return landmarks;
    } catch {
      return null;
    }
  };

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = performance.now();
    // Throttle inference loop to ~16 FPS (60ms between inferences) to ensure zero impact on map/Nexus
    if (now - lastInferenceTimeRef.current >= 60) {
      lastInferenceTimeRef.current = now;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const landmarks = detectHandFromCanvas(ctx, canvas.width, canvas.height);
        if (landmarks) {
          const gestureEvent = detectorRef.current.processLandmarks(landmarks);
          if (gestureEvent) {
            onGesture(gestureEvent);
          }
        }
      }
    }

    animFrameIdRef.current = requestAnimationFrame(processFrame);
  }, [onGesture]);

  const startCamera = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onError('Camera access is unavailable on this device.');
      setCameraState('ERROR');
      return;
    }

    try {
      setCameraState('STARTING');
      // Low resolution request (320x240) to minimize CPU usage
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 20, max: 24 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraState('RUNNING');
        animFrameIdRef.current = requestAnimationFrame(processFrame);
      }
    } catch (err: any) {
      console.warn('[GestureCamera] Permission denied or device error:', err);
      onError('Camera access is unavailable. Hand control has been disabled.');
      setCameraState('ERROR');
      stopCamera();
    }
  }, [onError, processFrame, stopCamera]);

  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isActive, startCamera, stopCamera]);

  return (
    <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 9999, pointerEvents: 'none' }}>
      {/* Hidden processing video and canvas */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          display: showPreview && cameraState === 'RUNNING' ? 'block' : 'none',
          width: '120px',
          height: '90px',
          borderRadius: '8px',
          border: '2px solid #2563EB',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          transform: 'scaleX(-1)', // Mirrored view
          pointerEvents: 'auto',
          backgroundColor: '#000000',
        }}
      />
      <canvas ref={canvasRef} width={160} height={120} style={{ display: 'none' }} />
    </div>
  );
}
