export const CAPTAIN_ASSISTANT_VERSION = "1.0.0";

export type ReadinessLevel = "GREEN" | "AMBER" | "RED";

export type IngestStatus =
  | "received"
  | "processing"
  | "extracted"
  | "needs_review"
  | "completed"
  | "failed";

export interface CaptainVessel {
  readonly vesselId: string;
  readonly name: string;
  readonly imo: string;
}

export interface CaptainContext {
  readonly captainId: string;
  readonly organizationId: string;
  readonly assignedVessel: CaptainVessel;
}

export interface PortCall {
  readonly id: string;
  readonly port: string;
  readonly arrivalDate: string;
  readonly departureDate: string;
  readonly status: "CONFIRMED" | "ESTIMATED" | "PLANNED";
}

export type RequirementCategory = "DOCUMENT" | "CERTIFICATE" | "NOTIFICATION" | "BDN";

export interface PortRequirement {
  readonly id: string;
  readonly port: string;
  readonly requirement: string;
  readonly category: RequirementCategory;
  readonly blocking: boolean;
  readonly reference: string;
}

export interface VesselDocumentStatus {
  readonly documentId: string;
  readonly documentType: string;
  readonly title: string;
  readonly status: string;
  readonly requiredForArrival: boolean;
  readonly expiresAt: string | null;
}

export interface IsccStatus {
  readonly present: boolean;
  readonly documentId: string | null;
  readonly expiresAt: string | null;
  readonly status: string;
}

export interface IngestEvent {
  readonly id: string;
  readonly vesselId: string;
  readonly documentType: string;
  readonly fileName: string;
  readonly receivedAt: string;
  readonly status: IngestStatus;
  readonly detail: string;
}

export type ChecklistStatus = "GREEN" | "AMBER" | "RED";

export interface ReadinessChecklistItem {
  readonly requirement: string;
  readonly status: ChecklistStatus;
  readonly evidence: string;
  readonly missing: string | null;
  readonly deadline: string | null;
  readonly recommendedAction: string;
  readonly source: string;
  readonly blocking: boolean;
}

export interface PortReadinessResult {
  readonly port: string;
  readonly portCallId: string | null;
  readonly arrivalDate: string | null;
  readonly vessel: CaptainVessel;
  readonly level: ReadinessLevel;
  readonly summary: string;
  readonly checklist: ReadonlyArray<ReadinessChecklistItem>;
  readonly missingBlocking: ReadonlyArray<string>;
}

export interface CaptainAnswer {
  readonly text: string;
  readonly readiness?: PortReadinessResult;
  readonly checklist?: ReadonlyArray<ReadinessChecklistItem>;
  readonly ingest?: ReadonlyArray<IngestEvent>;
  readonly portCalls?: ReadonlyArray<PortCall>;
  readonly handoff?: {
    readonly target: string;
    readonly confidence: number;
    readonly reason: string;
  };
}

export interface CaptainRequest {
  readonly query: string;
  readonly context: CaptainContext;
}
