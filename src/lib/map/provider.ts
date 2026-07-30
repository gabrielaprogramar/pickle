import type { MapProviderConfig, MapTileConfig, MapStyleConfig } from "./types";
import { createDefaultMapConfig } from "./types";

export interface MapProvider {
  readonly name: string;
  getConfig(): MapProviderConfig;
  getTileConfig(): MapTileConfig;
  getStyleConfig(): MapStyleConfig;
}

export class DefaultMapProvider implements MapProvider {
  readonly name: string = "default";
  private config: MapProviderConfig;

  constructor(config?: Partial<MapProviderConfig>) {
    this.config = { ...createDefaultMapConfig(), ...config };
  }

  getConfig(): MapProviderConfig {
    return this.config;
  }

  getTileConfig(): MapTileConfig {
    return this.config.tile;
  }

  getStyleConfig(): MapStyleConfig {
    return this.config.style;
  }
}

export async function fetchMapConfigFromApi(): Promise<MapProviderConfig> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "";
  const res = await fetch(`${base}/api/map-config`);
  if (!res.ok) return createDefaultMapConfig();
  const data = await res.json();
  return data as MapProviderConfig;
}
