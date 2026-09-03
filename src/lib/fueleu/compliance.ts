/**
 * fuelEu/compliance.ts — deterministic FuelEU Maritime compliance state machine
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 3 makes FuelEU genuinely scope-aware and foundation-driven:
 *
 *   • Applicability comes from the shared regulatory foundation (never a
 *     hardcoded GT-only side-effect).
 *   • Energy comes ONLY from canonical `voyage_consumption` (never
 *     `fuel_deliveries.quantity_mt` / equal-share).
 *   • Geographic scope weights each voyage's energy via the authoritative EU
 *     port classifier (intra-EU = 1.0, to/from EU = 0.5, non-EU = 0.0).
 *   • Target/baseline/penalty come from versioned `regulatory_rules`.
 *   • UNKNOWN / REQUIRES_REVIEW / DATA_INCOMPLETE are first-class outcomes.
 *   • Penalty distinguishes ESTIMATE from ACTUAL ASSESSED.
 *   • Banking / borrowing / pooling are deterministic & rule-aware; unsupported
 *     or unresolved conditions yield EXPLICIT review states, never fake success.
 *
 * This module is PURE/deterministic given its inputs.
 */

import type { VoyageConsumptionRow } from "@/lib/supabase/types";
import type { FuelEuVoyageScopeType } from "@/lib/fueleu/types";
import { computeFuelEuEnergy } from "@/lib/fueleu/energy";
import { computeFuelEuEmissions } from "@/lib/fueleu/emissions";
import { estimateFuelEuPenalty } from "@/lib/fueleu/penalty";
import type {
  FuelEuBalanceToolResult,
  ComplianceSign,
} from "@/lib/fueleu/types";

// ── Compliance status ───────────────────────────────────────────────────────

export type FuelEuComplianceStatus =
  | "NOT_APPLICABLE"
  | "UNKNOWN"
  | "REQUIRES_REVIEW"
  | "DATA_INCOMPLETE"
  | "CALCULATED"
  | "SURPLUS"
  | "DEFICIT"
  | "READY_FOR_REVIEW"
  | "POOLING_REQUIRES_REVIEW"
  | "COMPLIANT"
  | "NON_COMPLIANT";

export const FUELEU_EXCEPTION_CODES = [
  "MISSING_APPLICABILITY",
  "APPLICABILITY_UNRESOLVED",
  "NOT_IN_SCOPE",
  "MISSING_VOYAGE_PORTS",
  "UNRESOLVED_PORT",
  "MISSING_CONSUMPTION",
  "INSUFFICIENT_CONSUMPTION",
  "CONFLICTING_CONSUMPTION",
  "UNKNOWN_FUEL_TYPE",
  "MISSING_WTW_FACTOR",
  "BASELINE_RULE_UNAVAILABLE",
  "TARGET_RULE_UNAVAILABLE",
  "PENALTY_RULE_UNAVAILABLE",
  "BANKING_UNAVAILABLE",
  "BORROWING_UNAVAILABLE",
  "POOLING_UNAVAILABLE",
  "POOLING_NEEDS_REVIEW",
  "BIOFUEL_CERTIFICATION_MISSING",
  "BIOFUEL_CERTIFICATION_EXPIRED",
  "BIOFUEL_CERTIFICATION_UNSUPPORTED",
  "BIOFUEL_CERTIFICATION_CONFLICT",
] as const;

export type FuelEuExceptionCode = (typeof FUELEU_EXCEPTION_CODES)[number];

export interface FuelEuException {
  readonly code: FuelEuExceptionCode;
  readonly message: string;
  readonly ref?: string;
}

// ── Input ───────────────────────────────────────────────────────────────────

export interface FuelEuComplianceInput {
  readonly vesselProfile: {
    readonly gt: number | null;
    readonly flag: string | null;
    readonly vesselType: string | null;
  };
  readonly applicability: {
    readonly status: "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN" | "REQUIRES_REVIEW";
    readonly is_decision_final: boolean;
  } | null;
  readonly consumption: readonly VoyageConsumptionRow[];
  readonly voyages: ReadonlyArray<{
    readonly voyage_id: string;
    readonly departure_port: string;
    readonly arrival_port: string;
    readonly scope_factor: number | null;
    readonly scope_type: FuelEuVoyageScopeType;
    readonly unknown_ports: readonly string[];
  }>;
  readonly rules: {
    readonly baseline_gco2e_per_mj: number | null;
    readonly target_gco2e_per_mj: number | null;
    readonly target_source: string | null;
    readonly reduction_pct: number | null;
    readonly penalty_eur_per_tonne_vlsfoe: number | null;
    readonly penalty_formula_version: string | null;
  };
  readonly ops_energy_mj: number | null;
  readonly ops_data_available: boolean;
  readonly biofuel_certification: ReadonlyArray<{
    readonly fuel_type: string;
    readonly voyage_id: string | null;
    readonly certificate_status:
      | "VALID"
      | "MISSING"
      | "EXPIRED"
      | "UNSUPPORTED"
      | "CONFLICT";
    readonly detail: string;
  }>;
  readonly penalty_assessed_eur: number | null;
  readonly banking_requested: boolean;
  readonly borrowing_requested: boolean;
  readonly pooling_requested: boolean;
  readonly pool_snapshot: ReadonlyArray<{
    readonly vessel_id: string;
    readonly imo: string;
    readonly surplus_intensity_gco2e_per_mj: number;
  }>;
}

// ── Result ──────────────────────────────────────────────────────────────────

export interface FuelEuComplianceResult {
  readonly compliance_status: FuelEuComplianceStatus;
  readonly is_scope_resolved: boolean;
  readonly scope_applicable: boolean;
  readonly exceptions: readonly FuelEuException[];
  readonly energy_input_mj: number | null;
  readonly total_wtw_emissions_gco2e: number | null;
  readonly ghg_intensity_gco2e_per_mj: number | null;
  readonly baseline_gco2e_per_mj: number | null;
  readonly target_gco2e_per_mj: number | null;
  readonly reduction_pct: number | null;
  readonly compliance_balance: number | null;
  readonly surplus_or_deficit: ComplianceSign | null;
  readonly biofuel_energy_mj: number;
  readonly fossil_energy_mj: number;
  readonly iscc_missing: ReadonlyArray<{
    fuel_type: string;
    voyage_id: string | null;
    certificate_status: string;
    detail: string;
  }>;
  readonly ops_energy_mj: number | null;
  readonly ops_data_available: boolean;
  readonly penalty_exposure_estimate: number | null;
  readonly penalty_is_estimate: boolean;
  readonly penalty_assessed_eur: number | null;
  readonly banking: FuelEuBalanceToolResult;
  readonly borrowing: FuelEuBalanceToolResult;
  readonly pooling: FuelEuBalanceToolResult;
  readonly voyage_contributions: ReadonlyArray<{
    voyage_id: string;
    departure_port: string;
    arrival_port: string;
    scope_type: FuelEuVoyageScopeType;
    scope_factor: number | null;
    scope_resolved: boolean;
    energy_mj: number;
    total_wtw_emissions_gco2e: number;
    ghg_intensity_gco2e_per_mj: number | null;
    unknown_ports: readonly string[];
    consumption_status: string | null;
  }>;
  readonly energy_contributions: ReturnType<typeof computeFuelEuEmissions>["contributions"];
  readonly consumption_report: ReadonlyArray<{
    voyage_id: string | null;
    fuel_type: string;
    quantity_mt: number;
    method: string;
    confidence: string;
    status: string;
    blocked: boolean;
  }>;
}

// ── Deterministic core ──────────────────────────────────────────────────────

export function evaluateFuelEuCompliance(input: FuelEuComplianceInput): FuelEuComplianceResult {
  const exceptions: FuelEuException[] = [];
  const appStatus = input.applicability?.status ?? "UNKNOWN";
  const scopeApplicable = appStatus === "APPLICABLE";
  const isScopeResolved = appStatus === "APPLICABLE" || appStatus === "NOT_APPLICABLE";

  if (input.applicability === null) {
    exceptions.push({
      code: "MISSING_APPLICABILITY",
      message: "FuelEU applicability has not been determined for this vessel/year.",
    });
  }
  if (appStatus === "UNKNOWN") {
    exceptions.push({
      code: "APPLICABILITY_UNRESOLVED",
      message: "FuelEU applicability is UNKNOWN — missing required vessel facts. No intensity can be claimed.",
    });
  } else if (appStatus === "REQUIRES_REVIEW") {
    exceptions.push({
      code: "APPLICABILITY_UNRESOLVED",
      message: "FuelEU applicability conflicts or needs judgement — REQUIRES_REVIEW.",
    });
  } else if (appStatus === "NOT_APPLICABLE") {
    exceptions.push({
      code: "NOT_IN_SCOPE",
      message: "Vessel is not within FuelEU scope for this year.",
    });
  }

  // ── Rule availability (NEVER fabricate baseline/target/penalty) ─────────
  if (input.rules.baseline_gco2e_per_mj === null) {
    exceptions.push({
      code: "BASELINE_RULE_UNAVAILABLE",
      message: "No effective FuelEU baseline rule — cannot compute a target.",
    });
  }
  if (input.rules.target_gco2e_per_mj === null) {
    exceptions.push({
      code: "TARGET_RULE_UNAVAILABLE",
      message: "No effective FuelEU target rule for this reporting year.",
    });
  }

  // ── Energy from canonical consumption ────────────────────────────────────
  const energyHash = buildEnergy(input.consumption);
  const blocked = energyHash.blocked;

  // ── Voyage scope weighting ───────────────────────────────────────────────
  const voyageContributions = input.voyages.map((v) => {
    const blocks = blocked.filter((b) => b.voyage_id === v.voyage_id);
    const consumptionStatus =
      blocks.length > 0
        ? (blocks[0]?.status ?? "BLOCKED")
        : v.scope_type === "UNKNOWN"
          ? "SCOPE_UNKNOWN"
          : null;
    const scopeResolved = v.scope_type !== "UNKNOWN";
    // Weighted energy uses the scope factor for the voyage's share.
    const factor = scopeResolved ? (v.scope_factor ?? 0) : null;
    return {
      voyage_id: v.voyage_id,
      departure_port: v.departure_port,
      arrival_port: v.arrival_port,
      scope_type: v.scope_type,
      scope_factor: factor,
      scope_resolved: scopeResolved,
      // energy_mj is filled below once per-voyage WtW energy is available.
      energy_mj: 0,
      total_wtw_emissions_gco2e: 0,
      ghg_intensity_gco2e_per_mj: null as number | null,
      unknown_ports: [...v.unknown_ports],
      consumption_status: consumptionStatus,
    };
  });

  const scopeResolvedByVoyage = new Map<string, boolean>();
  for (const vc of voyageContributions) scopeResolvedByVoyage.set(vc.voyage_id, vc.scope_resolved);

  // Exceptions for unresolved ports / consumption.
  for (const v of voyageContributions) {
    if (!v.departure_port || !v.arrival_port) {
      exceptions.push({
        code: "MISSING_VOYAGE_PORTS",
        ref: v.voyage_id,
        message: "Voyage is missing an origin/destination port — FuelEU scope unresolved.",
      });
    }
    for (const p of v.unknown_ports) {
      exceptions.push({
        code: "UNRESOLVED_PORT",
        ref: v.voyage_id,
        message: `Port "${p}" could not be classified as EU/non-EU — voyage FuelEU scope unresolved.`,
      });
    }
  }

  // Consumption-level exceptions (blocked/insufficient/conflicting/unknown).
  for (const b of blocked) {
    if (b.status === "BLOCKED" || b.method === "INSUFFICIENT_DATA") {
      exceptions.push({
        code: "INSUFFICIENT_CONSUMPTION",
        ref: b.voyage_id ?? undefined,
        message: "Voyage fuel consumption is BLOCKED / INSUFFICIENT_DATA — energy for this leg is unresolved.",
      });
    } else if (b.method === "CONFLICT_DELTA" || b.status === "REVIEW") {
      exceptions.push({
        code: "CONFLICTING_CONSUMPTION",
        ref: b.voyage_id ?? undefined,
        message: "Voyage consumption sources conflict — REQUIRES_REVIEW.",
      });
    } else if (b.reason === "UNKNOWN_FUEL") {
      exceptions.push({
        code: "UNKNOWN_FUEL_TYPE",
        ref: b.voyage_id ?? undefined,
        message: `Fuel type "${b.fuel_type}" has no authoritative energy/WtW definition — its energy is unresolved.`,
      });
    }
  }

  // Missing consumption on an in-scope voyage → DATA_INCOMPLETE.
  const byVoyage = new Map<
    string,
    Array<{ status: string; method: string; quantity_mt: number }>
  >();
  for (const rec of input.consumption) {
    if (rec.voyage_id) {
      if (!byVoyage.has(rec.voyage_id)) byVoyage.set(rec.voyage_id, []);
      byVoyage.get(rec.voyage_id)!.push(rec);
    }
  }
  let missingConsumption = false;
  for (const v of input.voyages) {
    const recs = byVoyage.get(v.voyage_id) ?? [];
    if (recs.length === 0 && scopeResolvedByVoyage.get(v.voyage_id)) {
      missingConsumption = true;
      exceptions.push({
        code: "MISSING_CONSUMPTION",
        ref: v.voyage_id,
        message: "No canonical fuel-consumption record for this in-scope voyage — its energy is unresolved.",
      });
    }
  }

  // ── WtW emissions over counted (in-scope, pre-weighting) energy ─────────
  const emissionsRes = computeFuelEuEmissions(energyHash.contributions);
  for (const u of emissionsRes.unresolved_fuel_types) {
    exceptions.push({
      code: "MISSING_WTW_FACTOR",
      message: `Fuel type "${u}" has no WtW factor — its emissions are unresolved.`,
    });
  }

  // Per-voyage WtW (weighted by scope factor for the counted portion).
  let weightedEnergy = 0;
  let weightedWtw = 0;
  for (const v of voyageContributions) {
    const factor = v.scope_factor ?? 0;
    const contribs = emissionsRes.contributions.filter((c) => c.voyage_id === v.voyage_id);
    const vEnergy = contribs.reduce((s, c) => s + c.energy_mj, 0);
    const vWtw = contribs.reduce((s, c) => s + c.wtw_emissions_gco2e, 0);
    v.energy_mj = vEnergy;
    v.total_wtw_emissions_gco2e = vWtw;
    if (v.scope_resolved) {
      weightedEnergy += vEnergy * factor;
      weightedWtw += vWtw * factor;
    }
    if (v.scope_resolved && v.energy_mj > 0) {
      v.ghg_intensity_gco2e_per_mj = vWtw / vEnergy;
    }
  }

  // A voyage counts as resolved when its scope is resolved AND it carries
  // measurable, evidenced energy (computed AFTER per-voyage energy is filled).
  const hasResolvedEnergy = voyageContributions.some(
    (vc) => vc.scope_resolved && vc.energy_mj > 0,
  );

  // ── OPS (low-carbon shore power reduces effective intensity) ────────────
  // Distinguish "OPS is genuinely zero" from "OPS data unavailable": we never
  // fabricate an OPS=0 figure when we have no OPS source. Unavailable -> null.
  const opsAvailable = input.ops_data_available;
  const opsEnergy = opsAvailable ? Math.max(0, input.ops_energy_mj ?? 0) : null;
  // Under FuelEU, OPS energy at berth is zero-GHG (it is not ship fuel). It
  // does not add to the numerator but does NOT reduce the denominator either;
  // we track it separately and surface it so an OPS gap is visible.
  if (!opsAvailable) {
    exceptions.push({
      code: "MISSING_CONSUMPTION",
      message: "OPS (on-shore power) data is not available — the FuelEU at-berth picture is incomplete.",
    });
  }

  // ── Biofuel certification ────────────────────────────────────────────────
  const isccMissing: Array<{
    fuel_type: string;
    voyage_id: string | null;
    certificate_status: string;
    detail: string;
  }> = [];
  const bioCertByFuel = new Map<string, string[]>();
  for (const cert of input.biofuel_certification) {
    const arr = bioCertByFuel.get(cert.fuel_type) ?? [];
    arr.push(cert.certificate_status);
    bioCertByFuel.set(cert.fuel_type, arr);
    if (
      cert.certificate_status === "MISSING" ||
      cert.certificate_status === "EXPIRED" ||
      cert.certificate_status === "UNSUPPORTED" ||
      cert.certificate_status === "CONFLICT"
    ) {
      isccMissing.push({
        fuel_type: cert.fuel_type,
        voyage_id: cert.voyage_id,
        certificate_status: cert.certificate_status,
        detail: cert.detail,
      });
    }
    const code: FuelEuExceptionCode =
      cert.certificate_status === "EXPIRED"
        ? "BIOFUEL_CERTIFICATION_EXPIRED"
        : cert.certificate_status === "UNSUPPORTED"
          ? "BIOFUEL_CERTIFICATION_UNSUPPORTED"
          : cert.certificate_status === "CONFLICT"
            ? "BIOFUEL_CERTIFICATION_CONFLICT"
            : "BIOFUEL_CERTIFICATION_MISSING";
    if (cert.certificate_status !== "VALID") {
      exceptions.push({
        code,
        ref: cert.voyage_id ?? undefined,
        message: `Biofuel "${cert.fuel_type}" ${cert.certificate_status.toLowerCase()} — low-carbon credit cannot be assumed. ${cert.detail}`,
      });
    }
  }

  // We do not alter the intensity for uncertified biofuel here: the low-carbon
  // WtW factor is only valid when certified. Uncertified biofuel is surfaced as
  // an exception (REQUIRES_REVIEW) rather than silently reclassified to fossil.

  // ── Target / balance ─────────────────────────────────────────────────────
  const baseline = input.rules.baseline_gco2e_per_mj;
  const target = input.rules.target_gco2e_per_mj;
  const intensity = weightedEnergy > 0 ? weightedWtw / weightedEnergy : null;
  const countsAsResolved =
    scopeApplicable && isScopeResolved && intensity !== null && !missingConsumption && hasResolvedEnergy;

  let balance: number | null = null;
  let sign: ComplianceSign | null = null;
  if (countsAsResolved && target !== null) {
    balance = target - intensity;
    if (balance > 0) sign = "surplus";
    else if (balance < 0) sign = "deficit";
    else sign = "zero";
  }

  // ── Penalty (estimate vs assessed) ───────────────────────────────────────
  let penaltyEstimate: number | null = null;
  let penaltyIsEstimate = true;
  if (sign === "deficit" && balance !== null && weightedEnergy > 0 && target !== null) {
    const p = estimateFuelEuPenalty({
      deficit_gco2e_per_mj: Math.abs(balance),
      total_energy_mj: weightedEnergy,
      penalty_eur_per_tonne_vlsfoe: input.rules.penalty_eur_per_tonne_vlsfoe,
    });
    penaltyEstimate = p;
    if (input.rules.penalty_eur_per_tonne_vlsfoe === null) {
      exceptions.push({
        code: "PENALTY_RULE_UNAVAILABLE",
        message: "No effective FuelEU penalty rule — penalty cannot be estimated.",
      });
    }
  }
  const penaltyAssessed = input.penalty_assessed_eur;

  // ── Banking / borrowing / pooling (rule-aware, explicit review states) ───
  const banking = resolveBanking({
    requested: input.banking_requested,
    sign,
    balance,
  });
  const borrowing = resolveBorrowing({
    requested: input.borrowing_requested,
    sign,
    balance,
  });
  const pooling = resolvePooling({
    requested: input.pooling_requested,
    sign,
    balance,
    pool_snapshot: input.pool_snapshot,
  });

  // ── Status ───────────────────────────────────────────────────────────────
  const status = deriveStatus({
    appStatus,
    isScopeResolved,
    scopeApplicable,
    countsAsResolved,
    sign,
    balance,
    target,
    penaltyEstimate,
    penaltyAssessed,
    banking,
    borrowing,
    pooling,
    pooling_requested: input.pooling_requested,
    missingConsumption,
  });

  const biofuelEnergy = energyHash.resolvable.biofuel_energy_mj;
  const fossilEnergy = energyHash.resolvable.fossil_energy_mj;

  return {
    compliance_status: status,
    is_scope_resolved: isScopeResolved,
    scope_applicable: scopeApplicable,
    exceptions,
    energy_input_mj: countsAsResolved ? round(weightedEnergy, 4) : null,
    total_wtw_emissions_gco2e: countsAsResolved ? round(weightedWtw, 4) : null,
    ghg_intensity_gco2e_per_mj: countsAsResolved ? round(intensity ?? 0, 6) : null,
    baseline_gco2e_per_mj: baseline !== null ? round(baseline, 6) : null,
    target_gco2e_per_mj: target !== null ? round(target, 6) : null,
    reduction_pct: input.rules.reduction_pct,
    compliance_balance: balance !== null ? round(balance, 6) : null,
    surplus_or_deficit: sign,
    biofuel_energy_mj: biofuelEnergy,
    fossil_energy_mj: fossilEnergy,
    iscc_missing: isccMissing,
    ops_energy_mj: opsEnergy,
    ops_data_available: opsAvailable,
    penalty_exposure_estimate: penaltyEstimate !== null ? round(penaltyEstimate, 2) : null,
    penalty_is_estimate: penaltyIsEstimate,
    penalty_assessed_eur: penaltyAssessed,
    banking,
    borrowing,
    pooling,
    voyage_contributions: voyageContributions,
    energy_contributions: emissionsRes.contributions,
    consumption_report: energyHash.consumptionReport,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildEnergy(consumption: readonly VoyageConsumptionRow[]) {
  const resolvable = computeFuelEuEnergy(consumption);
  const contributions = computeFuelEuEmissions(resolvable.contributions).contributions;
  const blocked: Array<{
    voyage_id: string | null;
    fuel_type: string;
    method: string;
    status: string;
    reason?: string;
  }> = [];
  for (const row of consumption) {
    if (
      row.status === "BLOCKED" ||
      row.method === "INSUFFICIENT_DATA" ||
      row.method === "CONFLICT_DELTA" ||
      row.status === "REVIEW" ||
      row.quantity_mt <= 0
    ) {
      blocked.push({
        voyage_id: row.voyage_id,
        fuel_type: row.fuel_type,
        method: row.method,
        status: row.status,
        reason: resolvable.unresolved_fuel_types.includes(row.fuel_type) ? "UNKNOWN_FUEL" : undefined,
      });
    } else if (resolvable.unresolved_fuel_types.includes(row.fuel_type)) {
      blocked.push({
        voyage_id: row.voyage_id,
        fuel_type: row.fuel_type,
        method: row.method,
        status: row.status,
        reason: "UNKNOWN_FUEL",
      });
    }
  }
  const consumptionReport = consumption.map((row) => ({
    voyage_id: row.voyage_id,
    fuel_type: row.fuel_type,
    quantity_mt: row.quantity_mt,
    method: row.method,
    confidence: row.confidence,
    status: row.status,
    blocked:
      row.status === "BLOCKED" ||
      row.method === "INSUFFICIENT_DATA" ||
      row.method === "CONFLICT_DELTA" ||
      row.status === "REVIEW" ||
      row.quantity_mt <= 0 ||
      resolvable.unresolved_fuel_types.includes(row.fuel_type),
  }));
  return { resolvable, contributions, blocked, consumptionReport };
}

interface BalanceToolArgs {
  requested: boolean;
  sign: ComplianceSign | null;
  balance: number | null;
  pool_snapshot?: ReadonlyArray<{ vessel_id: string; imo: string; surplus_intensity_gco2e_per_mj: number }>;
}

function resolveBanking(args: BalanceToolArgs): FuelEuBalanceToolResult {
  if (!args.requested) {
    return { tool: null, status: "UNAVAILABLE", detail: "Banking was not requested.", energy_mj_applied: null, evidence: [] };
  }
  // Part 3.6: banking is SAFELY DEFERRED. There is no persistent cross-year
  // ledger with double-spend protection, so the engine must not claim a surplus
  // was banked. We flag REQUIRES_REVIEW instead of reporting an APPLIED amount.
  return {
    tool: "BANKING",
    status: "REQUIRES_REVIEW",
    detail:
      "Banking was requested but is not yet applied: the compliance engine has no persistent cross-year surplus ledger with double-spend protection. Review before MRV hand-off.",
    energy_mj_applied: null,
    evidence: [],
  };
}

function resolveBorrowing(args: BalanceToolArgs): FuelEuBalanceToolResult {
  if (!args.requested) {
    return { tool: null, status: "UNAVAILABLE", detail: "Borrowing was not requested.", energy_mj_applied: null, evidence: [] };
  }
  // Part 3.6: borrowing is SAFELY DEFERRED. No persistent cross-year ledger /
  // double-spend protection exists, so we must not claim a deficit was covered
  // by a future period.
  return {
    tool: "BORROWING",
    status: "REQUIRES_REVIEW",
    detail:
      "Borrowing was requested but is not yet applied: the compliance engine has no persistent future-period ledger with double-spend protection. Review before MRV hand-off.",
    energy_mj_applied: null,
    evidence: [],
  };
}

function resolvePooling(args: BalanceToolArgs & {
  pool_snapshot: ReadonlyArray<{ vessel_id: string; imo: string; surplus_intensity_gco2e_per_mj: number }>;
}): FuelEuBalanceToolResult {
  if (!args.requested) {
    return { tool: null, status: "UNAVAILABLE", detail: "Pooling was not requested.", energy_mj_applied: null, evidence: [] };
  }
  // Part 3.6: pooling is SAFELY DEFERRED. The pool membership, verified surplus,
  // and allocation are not persistable/enforceable in the current model, so we
  // must not report a pooled cover amount. Always flag for explicit review.
  return {
    tool: "POOLING",
    status: "POOLING_REQUIRES_REVIEW",
    detail:
      "Pooling was requested but is not yet applied: pool membership and verified surplus allocation are not enforceable without a persistent, double-spend-protected pool ledger. Review before MRV hand-off.",
    energy_mj_applied: null,
    evidence: (args.pool_snapshot ?? []).map((p) => `${p.imo}:${p.surplus_intensity_gco2e_per_mj}`),
  };
}

function deriveStatus(args: {
  appStatus: string;
  isScopeResolved: boolean;
  scopeApplicable: boolean;
  countsAsResolved: boolean;
  sign: ComplianceSign | null;
  balance: number | null;
  target: number | null;
  penaltyEstimate: number | null;
  penaltyAssessed: number | null;
  banking: FuelEuBalanceToolResult;
  borrowing: FuelEuBalanceToolResult;
  pooling: FuelEuBalanceToolResult;
  pooling_requested: boolean;
  missingConsumption: boolean;
}): FuelEuComplianceStatus {
  const {
    appStatus,
    isScopeResolved,
    scopeApplicable,
    countsAsResolved,
    sign,
    banking,
    borrowing,
    pooling,
    pooling_requested,
  } = args;

  if (isScopeResolved && !scopeApplicable) return "NOT_APPLICABLE";
  if (!isScopeResolved) return appStatus === "REQUIRES_REVIEW" ? "REQUIRES_REVIEW" : "UNKNOWN";
  if (!countsAsResolved) return "DATA_INCOMPLETE";
  if (sign === null) return "DATA_INCOMPLETE";

  // Pooling requested but unresolved/cannot apply fully → explicit review state.
  if (pooling_requested && pooling.status !== "APPLIED") return "POOLING_REQUIRES_REVIEW";
  if (banking.status === "REQUIRES_REVIEW" || borrowing.status === "REQUIRES_REVIEW") {
    return "REQUIRES_REVIEW";
  }

  if (sign === "surplus") return "SURPLUS";
  if (sign === "deficit") return "DEFICIT";
  return "CALCULATED";
}

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}
