/**
 * UrbanPulse 3D Geospatial Overlay
 * Implements google.maps.WebGLOverlayView synchronized with Three.js.
 * Provides geographically anchored 3D beacons, event pulses, and risk columns.
 * Gracefully falls back to 2D when WebGL or WebGLOverlayView is unsupported.
 */

import * as THREE from 'three';
import { UnifiedCityEvent, SpatialRiskZone, RiskDomain } from '@shared/types';

export interface Overlay3DOptions {
  events: UnifiedCityEvent[];
  riskZones?: SpatialRiskZone[];
  selectedLocation?: { latitude: number; longitude: number } | null;
  activeFilter?: string;
  onFallback?: (reason: string) => void;
}

export class UrbanPulse3DOverlay {
  private overlay: google.maps.WebGLOverlayView | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private isInitialized = false;
  private isDestroyed = false;
  private options: Overlay3DOptions;
  private map: google.maps.Map | null = null;
  private animationFrameId: number | null = null;
  private animTick = 0;

  // Tracked 3D objects
  private eventObjects: { mesh: THREE.Object3D; event: UnifiedCityEvent }[] = [];
  private riskObjects: { mesh: THREE.Object3D; zone: SpatialRiskZone }[] = [];
  private locationObject: THREE.Object3D | null = null;

  constructor(options: Overlay3DOptions) {
    this.options = options;
  }

  public attach(map: google.maps.Map): boolean {
    this.map = map;
    this.isDestroyed = false;

    const gmaps = (window as any).google?.maps;
    if (!gmaps || !gmaps.WebGLOverlayView) {
      this.options.onFallback?.('WebGLOverlayView is not supported on this device/browser.');
      return false;
    }

    try {
      const overlayInstance = new gmaps.WebGLOverlayView();
      this.overlay = overlayInstance;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera();

      // Soft ambient + directional light for 3D depth
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
      this.scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
      dirLight.position.set(0, 100, 50);
      this.scene.add(dirLight);

      overlayInstance.onContextRestored = ({ gl }: { gl: WebGLRenderingContext }) => {
        try {
          this.renderer = new THREE.WebGLRenderer({
            canvas: gl.canvas,
            context: gl,
            antialias: true,
          });
          this.renderer.autoClear = false;
          this.isInitialized = true;
          this.rebuildObjects();
        } catch (e: any) {
          console.warn('[UrbanPulse3DOverlay] Three.js WebGLRenderer init failed:', e);
          this.options.onFallback?.(e?.message || 'WebGL context initialization failed');
        }
      };

      overlayInstance.onDraw = ({ transformer }: { gl: WebGLRenderingContext; transformer: any }) => {
        if (!this.renderer || !this.scene || !this.camera || this.isDestroyed) return;

        this.animTick += 0.03;

        // Animate pulse rings
        this.eventObjects.forEach(({ mesh }) => {
          const ring = mesh.getObjectByName('pulseRing');
          if (ring) {
            const scale = 1 + (Math.sin(this.animTick * 2) + 1) * 0.25;
            ring.scale.set(scale, scale, 1);
            const mat = (ring as THREE.Mesh).material as THREE.MeshBasicMaterial;
            if (mat) {
              mat.opacity = 0.25 + (Math.cos(this.animTick * 2) + 1) * 0.2;
            }
          }
        });

        // Sync camera matrix with map center
        const center = map.getCenter();
        if (center && transformer.fromLatLngAltitude) {
          try {
            const matrix = transformer.fromLatLngAltitude({
              lat: center.lat(),
              lng: center.lng(),
              altitude: 0,
            });
            this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
            this.renderer.render(this.scene, this.camera);
            this.renderer.resetState();
          } catch (e) {
            // Silently swallow projection errors during fast zooms
          }
        }

        // Request next frame for subtle animation
        overlayInstance.requestRedraw();
      };

      overlayInstance.setMap(map);
      return true;
    } catch (err: any) {
      console.warn('[UrbanPulse3DOverlay] WebGL initialization error:', err);
      this.options.onFallback?.(err?.message || 'WebGLOverlayView failed to initialize');
      return false;
    }
  }

  public update(options: Partial<Overlay3DOptions>) {
    this.options = { ...this.options, ...options };
    if (this.isInitialized) {
      this.rebuildObjects();
    }
  }

  private rebuildObjects() {
    if (!this.scene || !this.map) return;

    // Clear old objects
    this.eventObjects.forEach(({ mesh }) => this.scene?.remove(mesh));
    this.eventObjects = [];

    this.riskObjects.forEach(({ mesh }) => this.scene?.remove(mesh));
    this.riskObjects = [];

    if (this.locationObject) {
      this.scene.remove(this.locationObject);
      this.locationObject = null;
    }

    const mapCenter = this.map.getCenter();
    if (!mapCenter) return;

    const centerLat = mapCenter.lat();
    const centerLng = mapCenter.lng();

    // 1. Intelligence Beacons / Event Pulses
    const filteredEvents = this.getFilteredEvents();
    filteredEvents.slice(0, 40).forEach((ev) => {
      const mesh = this.createEventObject(ev, centerLat, centerLng);
      if (mesh) {
        this.scene?.add(mesh);
        this.eventObjects.push({ mesh, event: ev });
      }
    });

    // 2. Risk Radar 3D Zones / Columns
    if (this.options.riskZones && this.options.riskZones.length > 0) {
      this.options.riskZones.slice(0, 15).forEach((zone) => {
        const mesh = this.createRiskObject(zone, centerLat, centerLng);
        if (mesh) {
          this.scene?.add(mesh);
          this.riskObjects.push({ mesh, zone });
        }
      });
    }

    // 3. Selected Location Beacon
    if (this.options.selectedLocation) {
      const locMesh = this.createLocationBeacon(this.options.selectedLocation, centerLat, centerLng);
      if (locMesh) {
        this.scene.add(locMesh);
        this.locationObject = locMesh;
      }
    }
  }

  private getFilteredEvents(): UnifiedCityEvent[] {
    const filter = this.options.activeFilter || 'ALL';
    if (filter === 'ALL') return this.options.events;

    return this.options.events.filter((ev) => {
      const type = ev.eventType.toUpperCase();
      if (filter === 'CRIME') return type.includes('POLICE') || type.includes('CRIME') || type.includes('THEFT');
      if (filter === 'WEATHER') return type.includes('WEATHER') || type.includes('STORM') || type.includes('CYCLONE');
      if (filter === 'TRAFFIC') return type.includes('TRAFFIC') || type.includes('ACCIDENT');
      if (filter === 'HAZARD') return type.includes('POTHOLE') || type.includes('ROAD') || type.includes('HAZARD');
      if (filter === 'FLOOD') return type.includes('FLOOD');
      return true;
    });
  }

  // Convert lat/lng delta to local meters around map center
  private toLocalMeters(lat: number, lng: number, centerLat: number, centerLng: number): { x: number; y: number } {
    const latMeters = (lat - centerLat) * 111139;
    const lngMeters = (lng - centerLng) * 111139 * Math.cos((centerLat * Math.PI) / 180);
    return { x: lngMeters, y: latMeters };
  }

  private createEventObject(ev: UnifiedCityEvent, centerLat: number, centerLng: number): THREE.Group | null {
    const pos = this.toLocalMeters(ev.latitude, ev.longitude, centerLat, centerLng);
    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, 0);

    // Semantic Color
    let color = 0x10b981; // Low / Positive
    if (ev.severity >= 75) color = 0xef4444; // High / Severe
    else if (ev.severity >= 55) color = 0xf59e0b; // Warning
    else if (ev.eventType.includes('POLICE') || ev.eventType.includes('TRAFFIC')) color = 0x2563eb;

    // Small 3D Vertical Pillar / Beacon
    const height = Math.max(15, (ev.severity / 100) * 45);
    const radius = ev.severity >= 75 ? 3.5 : 2.5;
    const cylinderGeo = new THREE.CylinderGeometry(radius, radius, height, 8);
    cylinderGeo.rotateX(Math.PI / 2); // Align vertically to ground plane
    cylinderGeo.translate(0, 0, height / 2);

    const mat = new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: 0.88,
    });
    const cylinder = new THREE.Mesh(cylinderGeo, mat);
    group.add(cylinder);

    // Pulse Ring on Ground Plane
    const ringGeo = new THREE.RingGeometry(radius * 1.5, radius * 3.5, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.name = 'pulseRing';
    group.add(ring);

    return group;
  }

  private createRiskObject(zone: SpatialRiskZone, centerLat: number, centerLng: number): THREE.Group | null {
    const pos = this.toLocalMeters(zone.center.latitude, zone.center.longitude, centerLat, centerLng);
    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, 0);

    let color = 0x2563eb;
    if (zone.level === 'SEVERE') color = 0xdc2626;
    else if (zone.level === 'HIGH') color = 0xea580c;
    else if (zone.level === 'MODERATE') color = 0xf59e0b;

    // Localized Risk Column
    const height = zone.level === 'SEVERE' ? 50 : zone.level === 'HIGH' ? 35 : 20;
    const radius = Math.min(Math.max(zone.radiusMeters / 15, 6), 30);
    const geo = new THREE.CylinderGeometry(radius * 0.8, radius, height, 12);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, height / 2);

    const mat = new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: 0.45,
    });
    const col = new THREE.Mesh(geo, mat);
    group.add(col);

    return group;
  }

  private createLocationBeacon(loc: { latitude: number; longitude: number }, centerLat: number, centerLng: number): THREE.Group {
    const pos = this.toLocalMeters(loc.latitude, loc.longitude, centerLat, centerLng);
    const group = new THREE.Group();
    group.position.set(pos.x, pos.y, 0);

    // Elegant Cobalt Location Beacon
    const geo = new THREE.ConeGeometry(4, 18, 8);
    geo.rotateX(-Math.PI / 2); // Point down towards coordinate
    geo.translate(0, 0, 12);

    const mat = new THREE.MeshLambertMaterial({
      color: 0x2563eb,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.3,
    });
    const cone = new THREE.Mesh(geo, mat);
    group.add(cone);

    // Subtle Ground Ring
    const ringGeo = new THREE.RingGeometry(2, 6, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x2563eb,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    group.add(new THREE.Mesh(ringGeo, ringMat));

    return group;
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.overlay) {
      try {
        this.overlay.setMap(null);
      } catch (e) {}
      this.overlay = null;
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
  }
}
