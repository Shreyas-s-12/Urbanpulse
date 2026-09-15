/**
 * Single-Instance Google Maps Loader Service
 * Enforces exactly ONE loader initialization across the entire application.
 * Provides explicit lifecycle state machine: IDLE -> LOADING -> READY | ERROR.
 * Protected against race conditions, StrictMode double effects, and unhandled promise rejections.
 */

import { Loader } from '@googlemaps/js-api-loader';

export type MapsLoadingStatus = 'IDLE' | 'LOADING' | 'READY' | 'ERROR';

export interface MapsLoaderState {
  status: MapsLoadingStatus;
  error: string | null;
  mapsLibrary: google.maps.MapsLibrary | null;
}

const DEFAULT_MAPS_KEY = 'AIzaSyDU2vkyVUnqI5lYUOz8aYrKO6mnYtWVSTg';
const TIMEOUT_MS = 10000;

class GoogleMapsLoaderService {
  private loaderInstance: Loader | null = null;
  private loadPromise: Promise<google.maps.MapsLibrary> | null = null;
  private currentStatus: MapsLoadingStatus = 'IDLE';
  private lastError: string | null = null;
  private mapsLib: google.maps.MapsLibrary | null = null;
  private listeners: Set<(state: MapsLoaderState) => void> = new Set();

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
      (window as any).__UP_GMAPS_KEY ||
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
        libraries: ['places', 'maps', 'marker', 'geometry', 'visualization'],
      });
    }

    // Race loader against a safe 10-second timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Google Maps connection timed out after 10 seconds. Verify internet connectivity.')),
        TIMEOUT_MS
      )
    );

    this.loadPromise = Promise.race([
      this.loaderInstance.importLibrary('maps') as Promise<google.maps.MapsLibrary>,
      timeoutPromise,
    ])
      .then((lib) => {
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
        this.currentStatus = 'ERROR';
        this.lastError = err?.message || 'Failed to initialize Google Maps library.';
        this.loadPromise = null;
        this.notify();
        throw err;
      });

    return this.loadPromise;
  }

  public retry(apiKeyOverride?: string): Promise<google.maps.MapsLibrary> {
    this.loadPromise = null;
    this.currentStatus = 'IDLE';
    this.lastError = null;
    return this.loadMaps(apiKeyOverride);
  }
}

export const googleMapsLoader = new GoogleMapsLoaderService();
