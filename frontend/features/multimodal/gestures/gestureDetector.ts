/**
 * UrbanPulse Browser-Local Hand Gesture Detector
 * 100% Client-Side Inference. Zero video frames sent to the backend.
 *
 * Recognized Gesture Vocabulary:
 * 1. OPEN_PALM   -> Activate / Resume hand control
 * 2. POINT       -> Move pointer / focus
 * 3. PINCH       -> Click / Select (Single discrete trigger per pinch)
 * 4. SWIPE_LEFT  -> Previous panel / page
 * 5. SWIPE_RIGHT -> Next panel / page
 * 6. THUMBS_UP   -> Confirm
 * 7. HOLD_OPEN   -> Pause interaction
 */

export type RecognizedGesture =
  | 'OPEN_PALM'
  | 'POINT'
  | 'PINCH'
  | 'SWIPE_LEFT'
  | 'SWIPE_RIGHT'
  | 'THUMBS_UP'
  | 'HOLD_OPEN'
  | 'NONE';

export interface GestureEvent {
  gesture: RecognizedGesture;
  confidence: number;
  pointer?: { x: number; y: number }; // Normalized 0..1 coordinates
  timestamp: number;
}

export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export class GestureDetector {
  private lastTriggerTime: number = 0;
  private cooldownMs: number = 750; // Minimum delay between discrete actions
  private minConfidence: number = 0.65;

  // Hysteresis & Debounce tracking
  private candidateGesture: RecognizedGesture = 'NONE';
  private candidateFrameCount: number = 0;
  private requiredFrames: number = 3; // Must hold gesture for 3 frames

  // Pinch discrete click state machine
  private isCurrentlyPinched: boolean = false;

  // Swipe trajectory tracking
  private xHistory: { x: number; time: number }[] = [];

  // Open hand hold tracking for pause
  private openPalmStartTime: number = 0;

  /**
   * Resets internal tracking state
   */
  public reset(): void {
    this.candidateGesture = 'NONE';
    this.candidateFrameCount = 0;
    this.isCurrentlyPinched = false;
    this.xHistory = [];
    this.openPalmStartTime = 0;
    this.lastTriggerTime = 0;
  }

  /**
   * Evaluates 21 normalized landmarks (from MediaPipe or fallback hand tracker)
   * Returns a GestureEvent only when a discrete, stable gesture is triggered
   */
  public processLandmarks(landmarks: Landmark[]): GestureEvent | null {
    if (!landmarks || landmarks.length < 21) {
      this.isCurrentlyPinched = false;
      this.candidateGesture = 'NONE';
      this.candidateFrameCount = 0;
      return null;
    }

    const now = Date.now();

    // Key landmark references
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    // Distance helper
    const dist = (a: Landmark, b: Landmark) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    // Hand scale metric (wrist to middle pip)
    const handScale = Math.max(dist(wrist, middlePip), 0.1);

    // Finger extension checks (tip higher than pip relative to wrist)
    const isIndexExtended = dist(wrist, indexTip) > dist(wrist, indexPip) * 1.15;
    const isMiddleExtended = dist(wrist, middleTip) > dist(wrist, middlePip) * 1.15;
    const isRingExtended = dist(wrist, ringTip) > dist(wrist, ringPip) * 1.15;
    const isPinkyExtended = dist(wrist, pinkyTip) > dist(wrist, pinkyPip) * 1.15;

    // Track horizontal movement for swipe
    this.xHistory.push({ x: indexTip.x, time: now });
    if (this.xHistory.length > 10) {
      this.xHistory.shift();
    }

    // 1. PINCH: Distance between thumb tip and index tip is small
    const pinchDist = dist(thumbTip, indexTip) / handScale;
    const isPinchDetected = pinchDist < 0.28;

    // Pointer position: mid-point between thumb and index or index tip
    const pointer = {
      x: 1.0 - indexTip.x, // Mirror x for intuitive user perspective
      y: indexTip.y,
    };

    // Evaluate discrete PINCH transition
    if (isPinchDetected) {
      if (!this.isCurrentlyPinched && now - this.lastTriggerTime > this.cooldownMs) {
        this.isCurrentlyPinched = true;
        this.lastTriggerTime = now;
        return {
          gesture: 'PINCH',
          confidence: 0.9,
          pointer,
          timestamp: now,
        };
      }
      return null;
    } else {
      this.isCurrentlyPinched = false;
    }

    // 2. SWIPE: check rapid horizontal velocity over last 300ms
    if (this.xHistory.length >= 4) {
      const oldest = this.xHistory[0];
      const newest = this.xHistory[this.xHistory.length - 1];
      const dt = newest.time - oldest.time;
      const dx = newest.x - oldest.x;

      if (dt > 80 && dt < 400 && Math.abs(dx) > 0.22) {
        if (now - this.lastTriggerTime > this.cooldownMs) {
          this.lastTriggerTime = now;
          this.xHistory = [];
          // Mirroring: hand moving left on video means dx < 0
          const gesture: RecognizedGesture = dx < 0 ? 'SWIPE_RIGHT' : 'SWIPE_LEFT';
          return {
            gesture,
            confidence: 0.85,
            pointer,
            timestamp: now,
          };
        }
      }
    }

    // 3. THUMBS UP: Thumb extended upwards, other 4 fingers folded
    const isThumbUp = thumbTip.y < wrist.y - 0.1 && thumbTip.y < indexPip.y;
    const areOthersFolded = !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended;
    if (isThumbUp && areOthersFolded) {
      if (now - this.lastTriggerTime > this.cooldownMs) {
        return this.debounceGesture('THUMBS_UP', 0.85, pointer, now);
      }
      return null;
    }

    // 4. POINT: Index extended, middle/ring/pinky folded
    if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return {
        gesture: 'POINT',
        confidence: 0.88,
        pointer,
        timestamp: now,
      };
    }

    // 5. OPEN PALM & HOLD_OPEN
    const allExtended = isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended;
    if (allExtended) {
      if (!this.openPalmStartTime) {
        this.openPalmStartTime = now;
      } else if (now - this.openPalmStartTime > 2000) {
        // Held open for 2+ seconds -> Pause
        if (now - this.lastTriggerTime > this.cooldownMs) {
          this.lastTriggerTime = now;
          return {
            gesture: 'HOLD_OPEN',
            confidence: 0.9,
            pointer,
            timestamp: now,
          };
        }
      }

      if (now - this.lastTriggerTime > this.cooldownMs) {
        return this.debounceGesture('OPEN_PALM', 0.8, pointer, now);
      }
      return null;
    } else {
      this.openPalmStartTime = 0;
    }

    return null;
  }

  private debounceGesture(
    gesture: RecognizedGesture,
    confidence: number,
    pointer: { x: number; y: number },
    timestamp: number
  ): GestureEvent | null {
    if (this.candidateGesture === gesture) {
      this.candidateFrameCount += 1;
      if (this.candidateFrameCount >= this.requiredFrames) {
        this.lastTriggerTime = timestamp;
        this.candidateGesture = 'NONE';
        this.candidateFrameCount = 0;
        return { gesture, confidence, pointer, timestamp };
      }
    } else {
      this.candidateGesture = gesture;
      this.candidateFrameCount = 1;
    }
    return null;
  }
}
