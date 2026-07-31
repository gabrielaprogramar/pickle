/**
 * sox-eca/mock-data.ts — deterministic mock scenarios for the Aurelia (IMO 9074729)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Nine fixed scenarios drive the SOx ECA watch tests and the API's `scenario`
 * parameter. Every scenario is fully deterministic: same key → same result.
 */

import type { EnvironmentalZone } from "@/lib/geo";
import type {
  EvidenceStatus,
  SoxEvidenceSource,
  SoxEvaluationInput,
  SoxRuleId,
  WatchSeverity,
  WatchStatus,
} from "./types";

export type SoxMockScenarioKey =
  | "outside-conforming"
  | "inside-conforming"
  | "inside-non-conforming"
  | "inside-no-evidence"
  | "conflicting-bdn"
  | "ambiguous-bunker"
  | "geometry-unavailable"
  | "entry-conforming"
  | "entry-non-conforming";

export const SOX_MOCK_SCENARIO_KEYS: ReadonlyArray<SoxMockScenarioKey> = [
  "outside-conforming",
  "inside-conforming",
  "inside-non-conforming",
  "inside-no-evidence",
  "conflicting-bdn",
  "ambiguous-bunker",
  "geometry-unavailable",
  "entry-conforming",
  "entry-non-conforming",
];

export function isSoxMockScenarioKey(value: string): value is SoxMockScenarioKey {
  return (SOX_MOCK_SCENARIO_KEYS as ReadonlyArray<string>).includes(value);
}

export const SOX_MOCK_NOW = "2026-07-10T12:00:00.000Z";

export const SOX_MOCK_VESSEL = Object.freeze({
  vesselId: "vsl-aurelia",
  imo: "9074729",
  name: "Aurelia",
});

/** Point inside the seeded Med SOx ECA polygon. */
export const SOX_POSITION_INSIDE = Object.freeze({ id: null, ts: SOX_MOCK_NOW, lat: 38.0, lng: 15.0 });

/** Point outside the ECA (North Atlantic). */
export const SOX_POSITION_OUTSIDE = Object.freeze({ id: null, ts: SOX_MOCK_NOW, lat: 50.0, lng: -10.0 });

/** The same approximate Med SOx ECA polygon seeded in migration 0009. */
export const SOX_MOCK_ZONE: EnvironmentalZone = Object.freeze({
  id: "z-med-sox-eca",
  code: "MED_SOX_ECA",
  name: "Mediterranean Sea SOx Emission Control Area",
  category: "ECA_SOX",
  geometryType: "POLYGON",
  geometryCoordinates: [[[-5.0, 35.0], [5.0, 35.0], [5.0, 46.0], [30.0, 46.0], [30.0, 36.0], [36.0, 36.0], [36.0, 32.0], [20.0, 30.0], [10.0, 30.0], [-5.0, 35.0]]],
  description: "Mediterranean Sea designated as SOx ECA under MARPOL Annex VI, effective 1 May 2025.",
  regulationReference: "MARPOL Annex VI, Regulation 14; IMO MEPC.361(79)",
  geometryVersion: "1.0",
  jurisdiction: "Mediterranean Sea — all riparian states",
  effectiveFrom: "2025-05-01",
  effectiveUntil: null,
  isActive: true,
});

export interface SoxMockScenario {
  readonly key: SoxMockScenarioKey;
  readonly input: SoxEvaluationInput;
  readonly expected: {
    readonly watchStatus: WatchStatus;
    readonly severity: WatchSeverity;
    readonly evidenceStatus: EvidenceStatus | null;
    readonly insideEca: boolean;
    readonly ruleIds: ReadonlyArray<SoxRuleId>;
  };
}

function delivery(overrides: Partial<SoxEvidenceSource> & { readonly fuel_delivery_id: string }): SoxEvidenceSource {
  return {
    document_id: null,
    ocr_result_id: null,
    ai_extraction_id: null,
    delivery_date: "2026-07-01T10:00:00.000Z",
    delivery_port: "Genoa",
    fuel_type: "vlsfo",
    quantity_mt: 120,
    sulphur_content_pct: 0.1,
    delivery_status: "verified",
    review_state: null,
    ai_confidence: 0.94,
    source: "BDN OCR",
    ...overrides,
  };
}

const SULPHUR_005 = delivery({ fuel_delivery_id: "fd-005", sulphur_content_pct: 0.05 });
const SULPHUR_010 = delivery({ fuel_delivery_id: "fd-010", sulphur_content_pct: 0.1 });
const SULPHUR_015 = delivery({ fuel_delivery_id: "fd-015", sulphur_content_pct: 0.15, fuel_type: "rmg_380" });
const UNDER_REVIEW = delivery({
  fuel_delivery_id: "fd-under-review",
  sulphur_content_pct: 0.12,
  review_state: "under_review",
});
const AMBIGUOUS_A = delivery({
  fuel_delivery_id: "fd-amb-a",
  delivery_date: "2026-07-05T10:00:00.000Z",
  sulphur_content_pct: 0.05,
});
const AMBIGUOUS_B = delivery({
  fuel_delivery_id: "fd-amb-b",
  delivery_date: "2026-07-06T10:00:00.000Z",
  sulphur_content_pct: 0.15,
});

function base(key: SoxMockScenarioKey): SoxMockScenario {
  return {
    key,
    input: {
      vessel: SOX_MOCK_VESSEL,
      position: SOX_POSITION_INSIDE,
      previousZoneState: null,
      zone: SOX_MOCK_ZONE,
      deliveries: [SULPHUR_010],
      now: SOX_MOCK_NOW,
    },
    expected: {
      watchStatus: "CLEAR",
      severity: "INFO",
      evidenceStatus: "CONFORMING",
      insideEca: true,
      ruleIds: ["SOX-ECA-02"],
    },
  };
}

export function createMockSoxScenario(key: SoxMockScenarioKey): SoxMockScenario {
  switch (key) {
    case "outside-conforming": {
      const s = base(key);
      return {
        ...s,
        input: {
          ...s.input,
          position: SOX_POSITION_OUTSIDE,
          deliveries: [SULPHUR_010],
        },
        expected: {
          watchStatus: "CLEAR",
          severity: "INFO",
          evidenceStatus: "CONFORMING",
          insideEca: false,
          ruleIds: ["SOX-ECA-02"],
        },
      };
    }

    case "inside-conforming": {
      const s = base(key);
      return {
        ...s,
        input: { ...s.input, deliveries: [SULPHUR_005] },
        expected: {
          watchStatus: "CLEAR",
          severity: "INFO",
          evidenceStatus: "CONFORMING",
          insideEca: true,
          ruleIds: ["SOX-ECA-02"],
        },
      };
    }

    case "inside-non-conforming": {
      const s = base(key);
      return {
        ...s,
        input: { ...s.input, deliveries: [SULPHUR_015] },
        expected: {
          watchStatus: "NON_CONFORMING",
          severity: "HIGH",
          evidenceStatus: "NON_CONFORMING",
          insideEca: true,
          ruleIds: ["SOX-ECA-03"],
        },
      };
    }

    case "inside-no-evidence": {
      const s = base(key);
      return {
        ...s,
        input: { ...s.input, deliveries: [] },
        expected: {
          watchStatus: "NO_EVIDENCE",
          severity: "WARNING",
          evidenceStatus: "INSUFFICIENT_EVIDENCE",
          insideEca: true,
          ruleIds: ["SOX-ECA-04"],
        },
      };
    }

    case "conflicting-bdn": {
      const s = base(key);
      return {
        ...s,
        input: { ...s.input, deliveries: [UNDER_REVIEW] },
        expected: {
          watchStatus: "UNKNOWN",
          severity: "WARNING",
          evidenceStatus: "UNKNOWN",
          insideEca: true,
          ruleIds: ["SOX-ECA-05"],
        },
      };
    }

    case "ambiguous-bunker": {
      const s = base(key);
      return {
        ...s,
        input: { ...s.input, deliveries: [AMBIGUOUS_A, AMBIGUOUS_B] },
        expected: {
          watchStatus: "UNKNOWN",
          severity: "WARNING",
          evidenceStatus: "UNKNOWN",
          insideEca: true,
          ruleIds: ["SOX-ECA-05"],
        },
      };
    }

    case "geometry-unavailable": {
      const s = base(key);
      return {
        ...s,
        input: { ...s.input, zone: null },
        expected: {
          watchStatus: "UNKNOWN",
          severity: "INFO",
          evidenceStatus: "UNKNOWN",
          insideEca: false,
          ruleIds: ["SOX-ECA-06"],
        },
      };
    }

    case "entry-conforming": {
      const s = base(key);
      return {
        ...s,
        input: {
          ...s.input,
          previousZoneState: "OUTSIDE",
          position: SOX_POSITION_INSIDE,
          deliveries: [SULPHUR_005],
        },
        expected: {
          watchStatus: "CLEAR",
          severity: "INFO",
          evidenceStatus: "CONFORMING",
          insideEca: true,
          ruleIds: ["SOX-ECA-01", "SOX-ECA-02"],
        },
      };
    }

    case "entry-non-conforming": {
      const s = base(key);
      return {
        ...s,
        input: {
          ...s.input,
          previousZoneState: "OUTSIDE",
          position: SOX_POSITION_INSIDE,
          deliveries: [SULPHUR_015],
        },
        expected: {
          watchStatus: "NON_CONFORMING",
          severity: "HIGH",
          evidenceStatus: "NON_CONFORMING",
          insideEca: true,
          ruleIds: ["SOX-ECA-01", "SOX-ECA-03"],
        },
      };
    }

    default:
      return base(key);
  }
}

/** Convenience map for tests/API that want all scenarios evaluated. */
export const SOX_MOCK_SCENARIOS: ReadonlyArray<SoxMockScenario> =
  SOX_MOCK_SCENARIO_KEYS.map((k) => createMockSoxScenario(k));
