/**
 * Single-Instance Google Maps Loader Service
 * Enforces exactly ONE loader initialization across the entire application.
 * Explicit lifecycle state machine: IDLE -> LOADING -> READY | ERROR | TIMEOUT | UNAVAILABLE.
 * Protected against race conditions, StrictMode double effects, and unhandled promise rejections.
 * Hard 12-second timeout guarantees the application never hangs on map initialization.
 */

import { Loader } from '@googlemaps/js-api-loader';

export type MapsLoadingStatus =
  | 'IDLE'
  | 'LOADING'
  | 'READY'
  | 'ERROR'
  | 'TIMEOUT'
  | 'UNAVAILABLE';

export interface MapsLoaderState {
  status: MapsLoadingStatus;
  error: string | null;
  mapsLibrary: google.maps.MapsLibrary | null;
}

const TIMEOUT_MS = 12000; // 12-second hard timeout guard (within 10-15s requirement)

class GoogleMapsLoaderService {
  private loaderInstance: Loader | null = null;
  private loadPromise: Promise<google.maps.MapsLibrary> | null = null;
  private currentStatus: MapsLoadingStatus = 'IDLE';
  private lastError: string | null = null;
  private mapsLib: google.maps.MapsLibrary | null = null;
  private listeners: Set<(state: MapsLoaderState) => void> = new Set();
  private authFailureHandled = false;
  private activeReject: ((reason?: any) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.attachAuthFailureHandler();
    }
  }

  private attachAuthFailureHandler() {
    if (this.authFailureHandled || typeof window === 'undefined') return;
    this.authFailureHandled = true;

    const existingHandler = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.warn('[GoogleMapsLoader] Google Maps authentication failure detected (API key policy / quota / billing).');
      this.currentStatus = 'ERROR';
      this.lastError = 'Map unavailable (Google Maps API key / billing restriction). Location search, site analysis, weather, traffic, and intelligence systems remain fully operational.';
      if (this.activeReject) {
        this.activeReject(new Error(this.lastError));
        this.activeReject = null;
      }
      this.loadPromise = null;
      this.notify();
      if (typeof existingHandler === 'function') {
        try {
          existingHandler();
        } catch (_) {}
      }
    };
  }

  public getStatus(): MapsLoadingStatus {
    return this.currentStatus;
  }

  public getError(): string | null {
    return this.lastError;
  }

  public getState(): MapsLoaderState {
    return {
      status: this.currentStatus,
      error: this.lastError,
      mapsLibrary: this.mapsLib,
    };
  }

  public subscribe(listener: (state: MapsLoaderState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        console.warn('[GoogleMapsLoader] Listener notification error:', e);
      }
    });
  }

  public hasApiKey(apiKeyOverride?: string): boolean {
    const key =
      apiKeyOverride ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      (typeof window !== 'undefined' && (window as any).__UP_GMAPS_KEY ? (window as any).__UP_GMAPS_KEY : '');
    return Boolean(key && key.trim().length > 0);
  }

  public async loadMaps(apiKeyOverride?: string): Promise<google.maps.MapsLibrary> {
    if (typeof window === 'undefined') {
      throw new Error('Google Maps cannot be loaded on the server.');
    }

    this.attachAuthFailureHandler();

    // 1. If already fully ready with valid global google.maps.Map constructor, return immediately
    if (this.currentStatus === 'READY' && this.mapsLib && (window as any).google?.maps?.Map) {
      return this.mapsLib;
    }

    // 2. Check if google.maps is already attached to window by a previous script tag
    if ((window as any).google?.maps?.Map) {
      this.mapsLib = (window as any).google.maps as google.maps.MapsLibrary;
      this.currentStatus = 'READY';
      this.lastError = null;
      this.notify();
      return this.mapsLib;
    }

    // 3. If already in flight, return the single active promise (Strict Mode & concurrency safe)
    if (this.currentStatus === 'LOADING' && this.loadPromise) {
      return this.loadPromise;
    }

    const effectiveKey =
      apiKeyOverride ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      ((window as any).__UP_GMAPS_KEY ? (window as any).__UP_GMAPS_KEY : '');

    // 4. If key is missing, fail immediately into UNAVAILABLE without hanging
    if (!effectiveKey || effectiveKey.trim() === '') {
      this.currentStatus = 'UNAVAILABLE';
      this.lastError = 'Google Maps API key is not configured. All location search, site analysis, weather, traffic, and intelligence systems remain fully operational.';
      this.notify();
      throw new Error(this.lastError);
    }

    this.currentStatus = 'LOADING';
    this.lastError = null;
    this.notify();

    // 5. Clean up any existing duplicate script tags before initializing Loader
    const existingScripts = document.querySelectorAll('script[src*="maps.googleapis.com/maps/api"]');
    if (existingScripts.length > 0 && !(window as any).google?.maps?.Map) {
      // If scripts exist but google.maps is not attached, remove stale tags to avoid conflict
      existingScripts.forEach((s) => s.parentNode?.removeChild(s));
    }

    if (!this.loaderInstance || (this.loaderInstance as any).apiKey !== effectiveKey) {
      this.loaderInstance = new Loader({
        apiKey: effectiveKey,
        version: 'weekly',
        libraries: ['places', 'geometry', 'marker'],
      });
    }

    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Google Maps connection timed out (${TIMEOUT_MS / 1000}s). Operating in fallback mode.`));
      }, TIMEOUT_MS);
    });

    const authPromise = new Promise<never>((_, reject) => {
      this.activeReject = reject;
    });

    this.loadPromise = Promise.race([
      this.loaderInstance.importLibrary('maps') as Promise<google.maps.MapsLibrary>,
      timeoutPromise,
      authPromise,
    ])
      .then((lib) => {
        if (timeoutId) clearTimeout(timeoutId);
        this.activeReject = null;
        this.mapsLib = lib || (window as any).google?.maps;
        if (!this.mapsLib || !(window as any).google?.maps?.Map) {
          throw new Error('Google Maps loaded, but Map constructor is unavailable.');
        }
        this.currentStatus = 'READY';
        this.lastError = null;
        this.notify();
        return this.mapsLib;
      })
      .catch((err: any) => {
        if (timeoutId) clearTimeout(timeoutId);
        this.activeReject = null;
        const isTimeout = err?.message?.includes('timed out');
        this.currentStatus = isTimeout ? 'TIMEOUT' : 'ERROR';
        this.lastError = err?.message || 'Failed to initialize Google Maps library.';
        this.loadPromise = null;
        this.notify();
        throw err;
      });

    return this.loadPromise;
  }

  public async importLibrary<T = any>(name: string, apiKeyOverride?: string): Promise<T | null> {
    if (typeof window === 'undefined') return null;

    // Fast check: if google.maps is already available, use it directly
    if ((window as any).google?.maps?.importLibrary) {
      try {
        return (await (window as any).google.maps.importLibrary(name)) as T;
      } catch {}
    }

    // If map status is already terminal failure, do NOT block downstream callers
    if (
      this.currentStatus === 'ERROR' ||
      this.currentStatus === 'TIMEOUT' ||
      this.currentStatus === 'UNAVAILABLE' ||
      !this.hasApiKey(apiKeyOverride)
    ) {
      return null;
    }

    try {
      // Race loadMaps with a 600ms timeout so external callers (search/autocomplete) never hang
      const loadWithFastTimeout = Promise.race([
        this.loadMaps(apiKeyOverride),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Fast library import timeout')), 600)
        ),
      ]);

      await loadWithFastTimeout;

      if ((window as any).google?.maps?.importLibrary) {
        return (await (window as any).google.maps.importLibrary(name)) as T;
      }
      if (this.loaderInstance) {
        return (await this.loaderInstance.importLibrary(name as any)) as T;
      }
    } catch (err) {
      console.warn(`[GoogleMapsLoader] Fast library import skipped for '${name}' (non-fatal):`, err);
    }
    return null;
  }

  public retry(apiKeyOverride?: string): Promise<google.maps.MapsLibrary> {
    this.loadPromise = null;
    this.loaderInstance = null;
    this.mapsLib = null;
    this.currentStatus = 'IDLE';
    this.lastError = null;
    this.notify();

    // Clean up any failed script tags from the DOM
    if (typeof document !== 'undefined') {
      const scripts = document.querySelectorAll('script[src*="maps.googleapis.com/maps/api"]');
      scripts.forEach((s) => s.parentNode?.removeChild(s));
    }

    return this.loadMaps(apiKeyOverride);
  }
}

export const googleMapsLoader = new GoogleMapsLoaderService();
