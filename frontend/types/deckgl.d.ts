declare module '@deck.gl/google-maps' {
  export class GoogleMapsOverlay {
    constructor(props?: any);
    setMap(map: any): void;
    setProps(props: any): void;
    pickObject(opts: any): any;
    finalize(): void;
  }
}

declare module '@deck.gl/aggregation-layers' {
  export class HeatmapLayer {
    constructor(props?: any);
  }
  export class GridLayer {
    constructor(props?: any);
  }
  export class HexagonLayer {
    constructor(props?: any);
  }
}

declare module '@deck.gl/layers' {
  export class PolygonLayer {
    constructor(props?: any);
  }
  export class GeoJsonLayer {
    constructor(props?: any);
  }
  export class PathLayer {
    constructor(props?: any);
  }
  export class ScatterplotLayer {
    constructor(props?: any);
  }
}

declare module '@deck.gl/core' {
  export class Layer {
    constructor(props?: any);
  }
  export interface PickingInfo {
    layer: any;
    index: number;
    object: any;
    x: number;
    y: number;
    coordinate?: [number, number];
  }
}
