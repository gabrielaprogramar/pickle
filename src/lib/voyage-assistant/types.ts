export const VOYAGE_ASSISTANT_VERSION = "1.0.0";

export const VOYAGE_SYSTEM_PROMPT_VERSION = "1.0.0";

export type AisGapTier =
  | "NONE"
  | "INTERPOLATION_OK"
  | "FLAGGED"
  | "MANUAL_REQUIRED"
  | "CRITICAL_ESCALATION";

export type VoyageClassification =
  | "INTRA_EU"
  | "EU_TO_THIRD_COUNTRY"
  | "THIRD_COUNTRY_TO_EU"
  | "THIRD_COUNTRY"
  | "UNCLASSIFIED";

export interface VoyageVessel {
  readonly vesselId: string;
  readonly name: string;
  readonly imo: string;
}

export interface VoyageContext {
  readonly operatorId: string;
  readonly organizationId: string;
  readonly vessel: VoyageVessel;
  readonly now?: string;
}

export interface VoyagePortRef {
  readonly name: string;
  readonly locode: string;
}

export interface VoyageRecord {
  readonly id: string;
  readonly vesselId: string;
  readonly voyageNumber: string;
  readonly departurePort: VoyagePortRef;
  readonly arrivalPort: VoyagePortRef;
  readonly departureTs: string;
  readonly arrivalTs: string;
  readonly distanceNm: number | null;
  readonly classification: VoyageClassification;
  readonly etsCoverageRate: number | null;
  readonly dataQuality: "HIGH" | "MEDIUM" | "LOW";
  readonly source: string;
}

export interface AisPosition {
  readonly id: string;
  readonly vesselId: string;
  readonly voyageId: string | null;
  readonly ts: string;
  readonly lat: number;
  readonly lng: number;
  readonly speedKnots: number | null;
  readonly source: string;
}

export interface AisGap {
  readonly id: string;
  readonly vesselId: string;
  readonly voyageId: string;
  readonly from: string;
  readonly to: string;
  readonly durationMinutes: number;
  readonly tier: AisGapTier;
  readonly actionRequired: string;
  readonly escalation: boolean;
  readonly notes: string | null;
}

export interface PortCall {
  readonly id: string;
  readonly vesselId: string;
  readonly voyageId: string;
  readonly portName: string;
  readonly locode: string;
  readonly country: string;
  readonly greenZone: boolean;
  readonly arrTs: string | null;
  readonly depTs: string | null;
  readonly source: string;
}

export interface GreenZoneEncounter {
  readonly id: string;
  readonly vesselId: string;
  readonly voyageId: string;
  readonly zoneName: string;
  readonly zoneCategory: string;
  readonly enteredAt: string;
  readonly exitedAt: string | null;
  readonly durationMinutes: number | null;
  readonly actionRequired: string;
}

export interface Violation {
  readonly id: string;
  readonly code: string;
  readonly voyageId: string;
  readonly severity: "LOW" | "MEDIUM" | "HIGH";
  readonly title: string;
  readonly description: string;
  readonly ruleReference: string;
  readonly recommendation: string;
}

export interface VoyageComplianceContext {
  readonly vessel: VoyageVessel;
  readonly voyage: VoyageRecord;
  readonly etsCoverageRate: number | null;
  readonly classification: VoyageClassification;
  readonly violations: ReadonlyArray<Violation>;
  readonly actionableItems: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly severity: "LOW" | "MEDIUM" | "HIGH";
  }>;
}

export interface ManualVoyageDraft {
  readonly id: string;
  readonly vesselId: string;
  readonly voyageId: string;
  readonly departurePort: VoyagePortRef;
  readonly arrivalPort: VoyagePortRef;
  readonly departureTs: string;
  readonly arrivalTs: string;
  readonly distanceNm: number | null;
  readonly reason: string;
  readonly supportingEvidence: string;
  readonly verifierDefensibility: string;
  readonly status: "DRAFT" | "CONFIRMED";
  readonly source: string;
}

export interface AisSyncRequest {
  readonly id: string;
  readonly vesselId: string;
  readonly voyageId: string;
  readonly from: string;
  readonly to: string;
  readonly reason: string;
  readonly status: "DRAFT" | "CONFIRMED";
  readonly source: string;
}

export interface VoyageDataGapSummary {
  readonly totalGaps: number;
  readonly worstTier: AisGapTier;
  readonly worstGap: AisGap | null;
  readonly flaggedGaps: number;
  readonly manualGaps: number;
  readonly criticalGaps: number;
  readonly coveragePct: number;
  readonly referencePeriodMinutes: number;
  readonly referenceFrom: string;
  readonly referenceTo: string;
}

export interface VoyageMemoryEntry {
  readonly key: string;
  readonly value: string;
  readonly updatedAt: string;
}

export interface VoyageAnswer {
  readonly text: string;
  readonly voyage?: VoyageRecord | null;
  readonly positions?: ReadonlyArray<AisPosition>;
  readonly gaps?: ReadonlyArray<AisGap>;
  readonly gapSummary?: VoyageDataGapSummary | null;
  readonly ports?: ReadonlyArray<PortCall>;
  readonly violations?: ReadonlyArray<Violation>;
  readonly greenZoneEncounters?: ReadonlyArray<GreenZoneEncounter>;
  readonly complianceContext?: VoyageComplianceContext | null;
  readonly manualDraft?: ManualVoyageDraft | null;
  readonly aisSync?: AisSyncRequest | null;
  readonly memory?: ReadonlyArray<VoyageMemoryEntry>;
  readonly handoff?: {
    readonly target: string;
    readonly confidence: number;
    readonly reason: string;
  };
}

export interface VoyageRequest {
  readonly query: string;
  readonly context: VoyageContext;
}
