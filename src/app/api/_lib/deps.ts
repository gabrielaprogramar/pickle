import {
  createVesselRepository,
  type VesselRepository,
  createVoyageRepository,
  type VoyageRepository,
  createAisPositionsRepository,
  type AisPositionsRepository,
  createFuelDeliveryRepository,
  type FuelDeliveryRepository,
  createFuelTypeRepository,
  type FuelTypeRepository,
} from "@/lib/supabase";
import { createMarineTrafficClient, type MarineTrafficClient } from "@/lib/marinetraffic";

export interface ApiDependencies {
  readonly vessels: VesselRepository;
  readonly voyages: VoyageRepository;
  readonly aisPositions: AisPositionsRepository;
  readonly fuelDeliveries: FuelDeliveryRepository;
  readonly fuelTypes: FuelTypeRepository;
  readonly marineTraffic: MarineTrafficClient;
}

export function createDefaultDeps(): ApiDependencies {
  const vessels = createVesselRepository();
  const voyages = createVoyageRepository();
  const aisPositions = createAisPositionsRepository();
  const fuelDeliveries = createFuelDeliveryRepository();
  const fuelTypes = createFuelTypeRepository();
  const marineTraffic = createMarineTrafficClient();

  return { vessels, voyages, aisPositions, fuelDeliveries, fuelTypes, marineTraffic };
}

export function createApiDeps(
  overrides: Partial<ApiDependencies>,
): ApiDependencies {
  return {
    vessels: overrides.vessels ?? createVesselRepository(),
    voyages: overrides.voyages ?? createVoyageRepository(),
    aisPositions: overrides.aisPositions ?? createAisPositionsRepository(),
    fuelDeliveries: overrides.fuelDeliveries ?? createFuelDeliveryRepository(),
    fuelTypes: overrides.fuelTypes ?? createFuelTypeRepository(),
    marineTraffic: overrides.marineTraffic ?? createMarineTrafficClient(),
  };
}
