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
  createFuelEuRecordRepository,
  type FuelEuRecordRepository,
  createEuEtsRecordRepository,
  type EuEtsRecordRepository,
  createMrvReportRepository,
  type MrvReportRepository,
} from "@/lib/supabase";
import { createMarineTrafficClient, type MarineTrafficClient } from "@/lib/marinetraffic";

export interface ApiDependencies {
  readonly vessels: VesselRepository;
  readonly voyages: VoyageRepository;
  readonly aisPositions: AisPositionsRepository;
  readonly fuelDeliveries: FuelDeliveryRepository;
  readonly fuelTypes: FuelTypeRepository;
  readonly fuelEuRecords: FuelEuRecordRepository;
  readonly euEtsRecords: EuEtsRecordRepository;
  readonly mrvReports: MrvReportRepository;
  readonly marineTraffic: MarineTrafficClient;
}

export function createDefaultDeps(): ApiDependencies {
  const vessels = createVesselRepository();
  const voyages = createVoyageRepository();
  const aisPositions = createAisPositionsRepository();
  const fuelDeliveries = createFuelDeliveryRepository();
  const fuelTypes = createFuelTypeRepository();
  const fuelEuRecords = createFuelEuRecordRepository();
  const euEtsRecords = createEuEtsRecordRepository();
  const mrvReports = createMrvReportRepository();
  const marineTraffic = createMarineTrafficClient();

  return { vessels, voyages, aisPositions, fuelDeliveries, fuelTypes, fuelEuRecords, euEtsRecords, mrvReports, marineTraffic };
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
    fuelEuRecords: overrides.fuelEuRecords ?? createFuelEuRecordRepository(),
    euEtsRecords: overrides.euEtsRecords ?? createEuEtsRecordRepository(),
    mrvReports: overrides.mrvReports ?? createMrvReportRepository(),
    marineTraffic: overrides.marineTraffic ?? createMarineTrafficClient(),
  };
}
