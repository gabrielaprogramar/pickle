import type { GeoPoint, GeoGeometry } from "./types";

export const MEDITERRANEAN_BOUNDS: {
  readonly minLat: number;
  readonly maxLat: number;
  readonly minLng: number;
  readonly maxLng: number;
} = {
  minLat: 30.0,
  maxLat: 47.0,
  minLng: -6.0,
  maxLng: 37.0,
};

export const MAJOR_MED_PORTS: Record<string, GeoPoint> = {
  "Palma de Mallorca": { lat: 39.5696, lng: 2.6409 },
  Antibes: { lat: 43.5804, lng: 7.1251 },
  Barcelona: { lat: 41.3453, lng: 2.1667 },
  Valencia: { lat: 39.4499, lng: -0.3183 },
  Marseille: { lat: 43.2965, lng: 5.3698 },
  Genoa: { lat: 44.4056, lng: 8.9463 },
  Naples: { lat: 40.8382, lng: 14.2726 },
  "Piraeus": { lat: 37.9427, lng: 23.6439 },
  "Algeciras": { lat: 36.1274, lng: -5.4645 },
  "Gibraltar": { lat: 36.1408, lng: -5.3536 },
  "Tunis": { lat: 36.8065, lng: 10.1815 },
  "Malta": { lat: 35.8959, lng: 14.5105 },
  "Livorno": { lat: 43.5498, lng: 10.3086 },
  "Civitavecchia": { lat: 42.0920, lng: 11.7863 },
  "Trieste": { lat: 45.6503, lng: 13.7797 },
  "Venice": { lat: 45.4408, lng: 12.3155 },
  "Salerno": { lat: 40.6780, lng: 14.7565 },
  "Palermo": { lat: 38.1167, lng: 13.3667 },
  "Cagliari": { lat: 39.2167, lng: 9.1167 },
  "Larnaca": { lat: 34.9167, lng: 33.6333 },
  "Limassol": { lat: 34.6500, lng: 33.0333 },
  "Haifa": { lat: 32.8192, lng: 34.9992 },
  "Ashrafi": { lat: 33.6514, lng: 35.8664 },
  "Souda": { lat: 35.4833, lng: 24.0667 },
  "Igoumenitsa": { lat: 39.5000, lng: 20.2667 },
  "Patras": { lat: 38.2500, lng: 21.7333 },
  "Thessaloniki": { lat: 40.6333, lng: 22.9333 },
  "Izmir": { lat: 38.4167, lng: 27.1333 },
  "Mersin": { lat: 36.8000, lng: 34.6167 },
  "Alexandria": { lat: 31.2000, lng: 29.9167 },
  "Port Said": { lat: 31.2500, lng: 32.3000 },
  "Damietta": { lat: 31.4167, lng: 31.8167 },
  "Mallorca": { lat: 39.5696, lng: 2.6409 },
  "Bonifacio": { lat: 41.3874, lng: 9.1588 },
};

export const MED_DEFAULTS = {
  center: { lat: 38.0, lng: 15.0 } as GeoPoint,
  zoom: 5,
  minZoom: 2,
  maxZoom: 18,
};

export const VESSEL_DEFAULTS = {
  trackColor: "#00B89F",
  trackWeight: 3,
  trackOpacity: 0.8,
  zoneFillOpacity: 0.15,
  zoneStrokeWeight: 2,
};
