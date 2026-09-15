/**
 * UrbanPulse Google TrafficLayer Module
 *
 * Dedicated strictly to live street-level traffic visualization on the Google Map
 * using the Google Maps JavaScript API TrafficLayer.
 *
 * Strict architectural rule:
 * - TrafficLayer = map visualization
 * - Routes API = route calculation + ETA
 *
 * Failure of TrafficLayer or Routes API will never break the base map.
 */

export interface TrafficLayerStatus {
  isActive: boolean;
  isReady: boolean;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
}

export class GoogleTrafficLayerManager {
  private trafficLayer: google.maps.TrafficLayer | null = null;
  private map: google.maps.Map | null = null;
  private onStatusChange?: (status: TrafficLayerStatus) => void;

  constructor(onStatusChange?: (status: TrafficLayerStatus) => void) {
    this.onStatusChange = onStatusChange;
  }

  private notifyStatus(status: TrafficLayerStatus) {
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  /**
   * Attaches or detaches TrafficLayer to/from the provided Google Map instance.
   */
  public update(map: google.maps.Map | null, enabled: boolean) {
    this.map = map;

    if (!map || !enabled) {
      if (this.trafficLayer) {
        try {
          this.trafficLayer.setMap(null);
        } catch (e) {
          console.warn('[UrbanPulse TrafficLayer] Error detaching traffic layer:', e);
        }
      }
      this.notifyStatus({
        isActive: false,
        isReady: false,
        isLoading: false,
        isError: false,
      });
      return;
    }

    // Enabled & map is mounted
    this.notifyStatus({
      isActive: true,
      isReady: false,
      isLoading: true,
      isError: false,
    });

    try {
      const TrafficLayerClass =
        (window as any).google?.maps?.TrafficLayer;

      if (!TrafficLayerClass) {
        throw new Error('Google Maps TrafficLayer class is not loaded in current environment.');
      }

      if (!this.trafficLayer) {
        this.trafficLayer = new TrafficLayerClass();
      }

      this.trafficLayer?.setMap(map);

      this.notifyStatus({
        isActive: true,
        isReady: true,
        isLoading: false,
        isError: false,
      });
      console.log('[UrbanPulse TrafficLayer] Successfully mounted to map.');
    } catch (err: any) {
      console.warn('[UrbanPulse TrafficLayer] Failed to attach traffic layer:', err);
      this.notifyStatus({
        isActive: true,
        isReady: false,
        isLoading: false,
        isError: true,
        errorMessage: err?.message || 'Live traffic layer unavailable',
      });
    }
  }

  /**
   * Destroys and cleans up the TrafficLayer instance.
   */
  public destroy() {
    if (this.trafficLayer) {
      try {
        this.trafficLayer.setMap(null);
      } catch {}
      this.trafficLayer = null;
    }
    this.map = null;
  }
}
