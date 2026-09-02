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
  createRegulatoryRuleRepository,
  type RegulatoryRuleRepository,
  createRegulationApplicabilityRepository,
  type RegulationApplicabilityRepository,
  createVoyageConsumptionRepository,
  type VoyageConsumptionRepository,
  createNoonReportRepository,
  type NoonReportRepository,
  createPortCallRepository,
  type PortCallRepository,
  createAuditLogRepository,
  type AuditLogRepository,
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
  readonly regulatoryRules: RegulatoryRuleRepository;
  readonly regulationApplicability: RegulationApplicabilityRepository;
  readonly voyageConsumption: VoyageConsumptionRepository;
  readonly noonReports: NoonReportRepository;
  readonly portCalls: PortCallRepository;
  readonly auditLog: AuditLogRepository;
  /** Organization context for audit-trail writes (e.g. EU ETS calculations). */
  readonly organizationId?: string;
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
  const regulatoryRules = createRegulatoryRuleRepository();
  const regulationApplicability = createRegulationApplicabilityRepository();
  const voyageConsumption = createVoyageConsumptionRepository();
  const noonReports = createNoonReportRepository();
  const portCalls = createPortCallRepository();
  const auditLog = createAuditLogRepository();
  const marineTraffic = createMarineTrafficClient();

  return { vessels, voyages, aisPositions, fuelDeliveries, fuelTypes, fuelEuRecords, euEtsRecords, mrvReports, regulatoryRules, regulationApplicability, voyageConsumption, noonReports, portCalls, auditLog, marineTraffic };
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
    regulatoryRules: overrides.regulatoryRules ?? createRegulatoryRuleRepository(),
    regulationApplicability: overrides.regulationApplicability ?? createRegulationApplicabilityRepository(),
    voyageConsumption: overrides.voyageConsumption ?? createVoyageConsumptionRepository(),
    noonReports: overrides.noonReports ?? createNoonReportRepository(),
    portCalls: overrides.portCalls ?? createPortCallRepository(),
    auditLog: overrides.auditLog ?? createAuditLogRepository(),
    marineTraffic: overrides.marineTraffic ?? createMarineTrafficClient(),
  };
}
