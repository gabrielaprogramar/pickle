import type { GeoPoint } from "../geo/types";

export type MapProviderName = "mock" | "leaflet" | "mapbox" | "maplibre";

export interface MapTileConfig {
  readonly url: string;
  readonly attribution: string;
  readonly minZoom: number;
  readonly maxZoom: number;
}

export interface MapStyleConfig {
  readonly defaultCenter: GeoPoint;
  readonly defaultZoom: number;
  readonly trackColor: string;
  readonly trackWeight: number;
  readonly trackOpacity: number;
  readonly zoneFillOpacity: number;
  readonly zoneStrokeWeight: number;
}

export interface MapProviderConfig {
  readonly provider: MapProviderName;
  readonly tile: MapTileConfig;
  readonly style: MapStyleConfig;
  readonly isMock: boolean;
}

export function createDefaultMapConfig(): MapProviderConfig {
  return {
    provider: "mock",
    tile: {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      minZoom: 2,
      maxZoom: 18,
    },
    style: {
      defaultCenter: { lat: 38.0, lng: 15.0 },
      defaultZoom: 5,
      trackColor: "#00B89F",
      trackWeight: 3,
      trackOpacity: 0.8,
      zoneFillOpacity: 0.15,
      zoneStrokeWeight: 2,
    },
    isMock: true,
  };
}
