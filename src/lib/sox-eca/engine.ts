/**
 * sox-eca/engine.ts — deterministic SOx ECA compliance rule engine
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Rules (fixed IDs, stable across versions):
 *   SOX-ECA-01  zone transition (ENTRY/EXIT) notice
 *   SOX-ECA-02  bunker evidence conforming vs applicable limit
 *   SOX-ECA-03  bunker evidence exceeds applicable limit
 *   SOX-ECA-04  inside ECA without usable bunker evidence
 *   SOX-ECA-05  conflicting / ambiguous / unreviewed evidence
 *   SOX-ECA-06  ECA geometry unavailable — no assertion possible
 *
 * The engine is a pure function of its inputs. I/O (persistence, notifications)
 * lives in service.ts.
 */

import type {
  BunkerEvidenceSelection,
  EvidenceStatus,
  SoxEvaluationInput,
  SoxEvaluationResult,
  SoxRuleResult,
  WatchSeverity,
  WatchStatus,
  ZoneState,
} from "./types";
import {
  getApplicableSulphurLimit,
  isMedSoxEcaEffective,
  isSulphurConforming,
} from "./parameters";
import { selectBunkerEvidence } from "./evidence";
import {
  computeZoneState,
  hasUsableGeometry,
  isMedSoxZone,
} from "./zone";

interface EvidenceFacts {
  readonly evidenceStatus: EvidenceStatus | null;
  readonly sulphurContentPct: number | null;
  readonly selectedDeliveryId: string | null;
  readonly reviewRequired: boolean;
  readonly ambiguous: boolean;
  readonly fromTrustedFuelInUse: boolean;
}

function resolveEvidence(
  selection: BunkerEvidenceSelection,
  insideEca: boolean,
  now: string,
  trustedFuelInUse: SoxEvaluationInput["trustedFuelInUse"],
): EvidenceFacts {
  const applicableLimit = getApplicableSulphurLimit(insideEca, now);

  if (trustedFuelInUse && insideEca) {
    return {
      evidenceStatus: isSulphurConforming(trustedFuelInUse.sulphurContentPct, applicableLimit)
        ? "CONFORMING"
        : "NON_CONFORMING",
      sulphurContentPct: trustedFuelInUse.sulphurContentPct,
      selectedDeliveryId: null,
      reviewRequired: false,
      ambiguous: false,
      fromTrustedFuelInUse: true,
    };
  }

  if (selection.state === "READY" && selection.selected?.sulphur_content_pct != null) {
    return {
      evidenceStatus: isSulphurConforming(selection.selected.sulphur_content_pct, applicableLimit)
        ? "CONFORMING"
        : "NON_CONFORMING",
      sulphurContentPct: selection.selected.sulphur_content_pct,
      selectedDeliveryId: selection.selected.fuel_delivery_id,
      reviewRequired: selection.reviewRequired,
      ambiguous: selection.ambiguous,
      fromTrustedFuelInUse: false,
    };
  }

  if (selection.state === "REVIEW_REQUIRED") {
    return {
      evidenceStatus: "UNKNOWN",
      sulphurContentPct: selection.selected?.sulphur_content_pct ?? null,
      selectedDeliveryId: selection.selected?.fuel_delivery_id ?? null,
      reviewRequired: true,
      ambiguous: selection.ambiguous,
      fromTrustedFuelInUse: false,
    };
  }

  return {
    evidenceStatus: "INSUFFICIENT_EVIDENCE",
    sulphurContentPct: null,
    selectedDeliveryId: null,
    reviewRequired: selection.reviewRequired,
    ambiguous: selection.ambiguous,
    fromTrustedFuelInUse: false,
  };
}

function ecaLimitLabel(insideEca: boolean): string {
  return insideEca ? "0.10% m/m ECA limit" : "0.50% m/m global limit";
}

export function evaluateSox(input: SoxEvaluationInput): SoxEvaluationResult {
  const now = input.now ?? new Date().toISOString();
  const geometryAvailable = hasUsableGeometry(input.zone);
  const ecaInForce = isMedSoxEcaEffective(now) && isMedSoxZone(input.zone) && geometryAvailable;

  const zoneState: ZoneState = ecaInForce
    ? computeZoneState(input.previousZoneState, input.position, null, input.zone)
    : "OUTSIDE";

  const insideEca = ecaInForce && (zoneState === "ENTRY" || zoneState === "WITHIN");

  const selection = selectBunkerEvidence(input.deliveries);
  const facts = resolveEvidence(selection, insideEca, now, input.trustedFuelInUse);
  const applicableLimit = getApplicableSulphurLimit(insideEca, now);

  const ruleResults: SoxRuleResult[] = [];

  if (!geometryAvailable) {
    ruleResults.push({
      rule_id: "SOX-ECA-06",
      kind: "NOT_APPLICABLE",
      severity: "INFO",
      explanation:
        "The Mediterranean SOx ECA geometry is not available, so a position-based sulphur compliance assertion cannot be made.",
      source: "environmental_zones / geo engine",
    });
    return {
      evaluatedAt: now,
      vessel: input.vessel,
      insideEca: false,
      ecaEffective: false,
      geometryAvailable: false,
      zoneState: "OUTSIDE",
      evidenceStatus: "UNKNOWN",
      reviewRequired: facts.reviewRequired,
      ambiguous: facts.ambiguous,
      applicableLimitPct: null,
      sulphurContentPct: facts.sulphurContentPct,
      selectedDeliveryId: facts.selectedDeliveryId,
      watchStatus: "UNKNOWN",
      severity: "INFO",
      ruleResults,
      dedupKey: buildDedupKey("OUTSIDE", "UNKNOWN", "INFO", facts.evidenceStatus ?? "none", facts.selectedDeliveryId, facts.sulphurContentPct),
    };
  }

  if (!ecaInForce) {
    ruleResults.push({
      rule_id: "SOX-ECA-02",
      kind: "NOT_APPLICABLE",
      severity: "INFO",
      explanation:
        "The Mediterranean SOx ECA is not yet in force (effective 2025-05-01); only the global 0.50% m/m cap applies.",
      source: "sox-eca parameters v2025.1",
    });
  }

  // Zone transition notice — SOX-ECA-01
  if (ecaInForce && (zoneState === "ENTRY" || zoneState === "EXIT")) {
    const entering = zoneState === "ENTRY";
    const watchOut = facts.evidenceStatus === "NON_CONFORMING" ||
      facts.evidenceStatus === "INSUFFICIENT_EVIDENCE" ||
      facts.evidenceStatus === "UNKNOWN";
    ruleResults.push({
      rule_id: "SOX-ECA-01",
      kind: "NOTICE",
      severity: entering && watchOut ? "WARNING" : "INFO",
      explanation: entering
        ? `Vessel entered the Mediterranean Sea SOx ECA; the ${ecaLimitLabel(true)} now applies to fuel sulphur content.`
        : "Vessel exited the Mediterranean Sea SOx ECA; the 0.50% m/m global cap applies outside.",
      source: "geo engine / MED_SOX_ECA",
    });
  }

  // Main rule — SOX-ECA-02/03/04/05
  let watchStatus: WatchStatus;
  let severity: WatchSeverity = "INFO";

  if (facts.evidenceStatus === "CONFORMING") {
    watchStatus = "CLEAR";
    severity = "INFO";
    ruleResults.push({
      rule_id: "SOX-ECA-02",
      kind: "CONFORMING",
      severity: "INFO",
      explanation: `Available bunker evidence indicates ${facts.sulphurContentPct}% m/m sulphur, within the ${ecaLimitLabel(insideEca)}.`,
      source: facts.fromTrustedFuelInUse ? "trusted fuel-in-use evidence" : "fuel_deliveries / BDN",
    });
  } else if (facts.evidenceStatus === "NON_CONFORMING") {
    watchStatus = "NON_CONFORMING";
    severity = facts.fromTrustedFuelInUse && insideEca ? "CRITICAL" : "HIGH";
    ruleResults.push({
      rule_id: "SOX-ECA-03",
      kind: "NON_CONFORMING",
      severity,
      explanation: `Available ${facts.fromTrustedFuelInUse ? "fuel-in-use" : "bunker"} evidence indicates ${facts.sulphurContentPct}% m/m sulphur, exceeding the ${ecaLimitLabel(insideEca)}.`,
      source: facts.fromTrustedFuelInUse ? "trusted fuel-in-use evidence" : "fuel_deliveries / BDN",
    });
  } else if (facts.evidenceStatus === "INSUFFICIENT_EVIDENCE") {
    if (insideEca) {
      watchStatus = "NO_EVIDENCE";
      severity = "WARNING";
      ruleResults.push({
        rule_id: "SOX-ECA-04",
        kind: "NO_EVIDENCE",
        severity: "WARNING",
        explanation:
          "Vessel is inside the Mediterranean SOx ECA but no usable bunker sulphur evidence is on file to substantiate compliance with the 0.10% m/m limit.",
        source: "fuel_deliveries / BDN",
      });
    } else {
      watchStatus = "CLEAR";
      severity = "INFO";
      ruleResults.push({
        rule_id: "SOX-ECA-02",
        kind: "NOT_APPLICABLE",
        severity: "INFO",
        explanation:
          "Vessel is outside the ECA; no ECA bunker evidence requirement is currently active. Global 0.50% m/m cap applies.",
        source: "fuel_deliveries / BDN",
      });
    }
  } else {
    watchStatus = "UNKNOWN";
    severity = "WARNING";
    ruleResults.push({
      rule_id: "SOX-ECA-05",
      kind: "REVIEW_REQUIRED",
      severity: "WARNING",
      explanation: facts.ambiguous
        ? "Multiple bunker deliveries carry conflicting sulphur values; the applicable sulphur cannot be determined without review."
        : "Bunker sulphur evidence is under review or conflicts with the review outcome; the applicable sulphur cannot be determined until resolved.",
      source: "fuel_deliveries / document review",
    });
  }

  return {
    evaluatedAt: now,
    vessel: input.vessel,
    insideEca,
    ecaEffective: ecaInForce,
    geometryAvailable: true,
    zoneState,
    evidenceStatus: facts.evidenceStatus,
    reviewRequired: facts.reviewRequired,
    ambiguous: facts.ambiguous,
    applicableLimitPct: applicableLimit,
    sulphurContentPct: facts.sulphurContentPct,
    selectedDeliveryId: facts.selectedDeliveryId,
    watchStatus,
    severity,
    ruleResults,
    dedupKey: buildDedupKey(
      zoneState,
      watchStatus,
      severity,
      facts.evidenceStatus ?? "none",
      facts.selectedDeliveryId,
      facts.sulphurContentPct,
    ),
  };
}

export function buildDedupKey(
  zoneState: ZoneState,
  watchStatus: WatchStatus,
  severity: WatchSeverity,
  evidenceStatus: string,
  selectedDeliveryId: string | null,
  sulphurContentPct: number | null,
): string {
  return [
    zoneState,
    watchStatus,
    severity,
    evidenceStatus,
    selectedDeliveryId ?? "none",
    sulphurContentPct ?? "none",
  ].join("|");
}
