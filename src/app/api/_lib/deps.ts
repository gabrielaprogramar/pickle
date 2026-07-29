import {
  createVesselRepository,
  type VesselRepository,
  createVoyageRepository,
  type VoyageRepository,
  createAisPositionsRepository,
  type AisPositionsRepository,
} from "@/lib/supabase";
import { createMarineTrafficClient, type MarineTrafficClient } from "@/lib/marinetraffic";

export interface ApiDependencies {
  readonly vessels: VesselRepository;
  readonly voyages: VoyageRepository;
  readonly aisPositions: AisPositionsRepository;
  readonly marineTraffic: MarineTrafficClient;
}

export function createDefaultDeps(): ApiDependencies {
  const vessels = createVesselRepository();
  const voyages = createVoyageRepository();
  const aisPositions = createAisPositionsRepository();
  const marineTraffic = createMarineTrafficClient();

  return { vessels, voyages, aisPositions, marineTraffic };
}

export function createApiDeps(
  overrides: Partial<ApiDependencies>,
): ApiDependencies {
  return {
    vessels: overrides.vessels ?? createVesselRepository(),
    voyages: overrides.voyages ?? createVoyageRepository(),
    aisPositions: overrides.aisPositions ?? createAisPositionsRepository(),
    marineTraffic: overrides.marineTraffic ?? createMarineTrafficClient(),
  };
}
