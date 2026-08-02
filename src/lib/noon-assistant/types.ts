/**
 * noon-assistant/types.ts — domain types for the Noon Report Assistant
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The assistant is a deterministic console over the noon-report snapshot: it
 * reports stored analysis, findings and correlations. It never re-computes or
 * fabricates values — every answer is sourced from the snapshot built by the
 * noon engine.
 */

import type {
  NoonFinding,
  NoonFuelCorrelation,
  NoonFuelEuOperationalInput,
  NoonEtsOperationalInput,
  NoonReportAnalysis,
  NoonReportDomain,
  NoonValidatorResult,
  NoonVoyageCorrelation,
} from "@/lib/noon-report";

export const NOON_ASSISTANT_VERSION = "1.0.0";

export const NOON_SYSTEM_PROMPT_VERSION = "1.0.0";

export interface NoonVessel {
  readonly vesselId: string;
  readonly name: string;
  readonly imo: string;
}

export interface NoonContext {
  readonly operatorId: string;
  readonly organizationId: string;
  readonly vessel: NoonVessel;
  readonly now?: string;
}

/** One fully-evaluated noon report: domain + deterministic outputs. */
export interface NoonReportSnapshot {
  readonly report: NoonReportDomain;
  readonly analysis: NoonReportAnalysis;
  readonly validator: NoonValidatorResult;
  readonly fuel: NoonFuelCorrelation;
  readonly voyage: NoonVoyageCorrelation;
  readonly fueleu: NoonFuelEuOperationalInput;
  readonly ets: NoonEtsOperationalInput;
  readonly findings: ReadonlyArray<NoonFinding>;
}

export interface NoonAssistantState {
  readonly vessel: NoonVessel;
  /** Ordered report_date descending (newest first). */
  readonly reports: ReadonlyArray<NoonReportDomain>;
  readonly latest: NoonReportSnapshot | null;
}

export interface NoonMemoryEntry {
  readonly key: string;
  readonly value: string;
  readonly updatedAt: string;
}

export interface NoonHandoffRef {
  readonly target: string;
  readonly confidence: number;
  readonly reason: string;
}

export interface NoonAnswer {
  readonly text: string;
  readonly snapshot?: NoonReportSnapshot | null;
  readonly report?: NoonReportDomain | null;
  readonly analysis?: NoonReportAnalysis | null;
  readonly validator?: NoonValidatorResult | null;
  readonly fuel?: NoonFuelCorrelation | null;
  readonly voyage?: NoonVoyageCorrelation | null;
  readonly fueleu?: NoonFuelEuOperationalInput | null;
  readonly ets?: NoonEtsOperationalInput | null;
  readonly findings?: ReadonlyArray<NoonFinding>;
  readonly history?: ReadonlyArray<NoonReportDomain>;
  readonly memory?: ReadonlyArray<NoonMemoryEntry>;
  readonly handoff?: NoonHandoffRef;
}

export interface NoonRequest {
  readonly query: string;
  readonly context: NoonContext;
}
