/**
 * Single-Instance Google Maps Loader Service
 * Enforces exactly ONE loader initialization across the entire application.
 * Provides explicit lifecycle state machine: IDLE -> LOADING -> READY | ERROR.
 * Protected against race conditions, StrictMode double effects, and unhandled promise rejections.
 * Short 5-second timeout ensures the application never hangs on map initialization.
 */

import { Loader } from '@googlemaps/js-api-loader';

export type MapsLoadingStatus = 'IDLE' | 'LOADING' | 'READY' | 'ERROR' | 'TIMEOUT';

export interface MapsLoaderState {
  status: MapsLoadingStatus;
  error: string | null;
  mapsLibrary: google.maps.MapsLibrary | null;
}

const DEFAULT_MAPS_KEY = 'AIzaSyCRm7GF2AcuT5bLElP1fMyejdO2SotpGoo';
const TIMEOUT_MS = 6000; // 6-second hard timeout guard to prevent app freeze

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
      console.warn('[GoogleMapsLoader] Google Maps authentication failure detected (key policy / quota).');
      this.currentStatus = 'ERROR';
      this.lastError = 'Map unavailable (Google Maps authentication failure). All other UrbanPulse intelligence tools remain operational.';
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

  public async loadMaps(apiKeyOverride?: string): Promise<google.maps.MapsLibrary> {
    if (typeof window === 'undefined') {
      throw new Error('Google Maps cannot be loaded on the server.');
    }

    this.attachAuthFailureHandler();

    // If already fully ready with a valid global google.maps object, return immediately
    if (this.currentStatus === 'READY' && this.mapsLib && (window as any).google?.maps?.Map) {
      return this.mapsLib;
    }

    // If already in flight, return the single active promise to prevent duplicate injection
    if (this.currentStatus === 'LOADING' && this.loadPromise) {
      return this.loadPromise;
    }

    const effectiveKey =
      apiKeyOverride ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      (typeof window !== 'undefined' && (window as any).__UP_GMAPS_KEY ? (window as any).__UP_GMAPS_KEY : '') ||
      DEFAULT_MAPS_KEY;

    if (!effectiveKey || effectiveKey.trim() === '') {
      this.currentStatus = 'ERROR';
      this.lastError = 'Missing Google Maps API Key.';
      this.notify();
      throw new Error(this.lastError);
    }

    this.currentStatus = 'LOADING';
    this.lastError = null;
    this.notify();

    // Check if google.maps is already attached to window by a previous script
    if ((window as any).google?.maps?.Map) {
      this.mapsLib = (window as any).google.maps as google.maps.MapsLibrary;
      this.currentStatus = 'READY';
      this.notify();
      return this.mapsLib;
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
        reject(new Error('Google Maps connection timed out (6s). Operating in map fallback mode.'));
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
    try {
      if ((window as any).google?.maps?.importLibrary) {
        return (await (window as any).google.maps.importLibrary(name)) as T;
      }
      await this.loadMaps(apiKeyOverride);
      if ((window as any).google?.maps?.importLibrary) {
        return (await (window as any).google.maps.importLibrary(name)) as T;
      }
      if (this.loaderInstance) {
        return (await this.loaderInstance.importLibrary(name as any)) as T;
      }
    } catch (err) {
      console.warn(`[GoogleMapsLoader] Failed to import library '${name}' (non-fatal):`, err);
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
    return this.loadMaps(apiKeyOverride);
  }
}

export const googleMapsLoader = new GoogleMapsLoaderService();
