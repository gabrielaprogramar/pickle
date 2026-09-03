/**
 * fuelEu/service.ts — FuelEU Compliance service (calculate / persist / read)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This service is the FuelEU analogue of the EU ETS `EtsComplianceService`.
 * It is deliberately AGNOSTIC to data sources: the caller (the FuelEU pipeline)
 * is responsible for assembling canonical inputs (applicability, voyage
 * consumption, port scope, versioned rules). The service:
 *
 *   1. runs the deterministic compliance engine (`evaluateFuelEuCompliance`),
 *   2. persists a fully lossless row (all detail in `calculation_details`),
 *   3. reconstructs a complete result on `getRecord` (no data loss).
 *
 * UNKNOWN must stay NULL in the DB (never coerced to 0) — matching the
 * Part 2 learning.
 */

import type {
  FuelEuCalculationInput,
  FuelEuCalculationResult,
  FuelEuRecordInsert,
  FuelEuBalanceToolResult,
  ComplianceSign,
} from "@/lib/fueleu/types";
import { FUELEU_CALCULATION_VERSION } from "@/lib/fueleu/types";
import { CURRENT_PARAMETER_VERSION } from "@/lib/fueleu/parameters";
import { evaluateFuelEuCompliance, type FuelEuComplianceInput } from "@/lib/fueleu/compliance";
import type { FuelEuRecordRepository } from "@/lib/supabase/repositories/fuel_eu_records";
import type { AuditLogRepository } from "@/lib/supabase/repositories/audit_log";
import { getWtwFactor } from "@/lib/fueleu/parameters";

export interface FuelEUComplianceServiceOptions {
  /** Wired to record an immutable audit trail on each persisted calculation. */
  readonly auditLog?: AuditLogRepository;
  readonly organizationId?: string;
}

export class FuelEUComplianceService {
  constructor(
    private readonly repo: FuelEuRecordRepository,
    private readonly options: FuelEUComplianceServiceOptions = {},
  ) {}

  /**
   * Run a complete, scope-aware FuelEU compliance calculation for vessel × year.
   * Inputs are pre-assembled by the pipeline; this method only computes.
   */
  async calculate(input: FuelEuCalculationInput): Promise<FuelEuCalculationResult> {
    const paramVer = input.parameter_version_override ?? CURRENT_PARAMETER_VERSION;
    const ts = new Date().toISOString();

    const compliance = evaluateFuelEuCompliance(toComplianceInput(input));

    const isccMissing = compliance.iscc_missing.map((d) => ({ ...d }));
    const energyContributions = compliance.energy_contributions.map((c) => ({ ...c }));
    const WtWFactorForUncertified = (fuelType: string) => {
      const f = getWtwFactor(fuelType);
      return f ? { factor: f.wtw_gco2e_per_mj, source: f.source, verified: f.requires_regulatory_verification !== true } : null;
    };

    const result: FuelEuCalculationResult = {
      calculation_version: FUELEU_CALCULATION_VERSION,
      parameter_version: paramVer,
      vessel_id: input.vessel_id,
      reporting_year: input.reporting_year,
      status: input.status ?? "draft",

      gt: input.gt,
      is_in_scope: compliance.scope_applicable,
      compliance_applicable: compliance.scope_applicable,
      compliance_scope_resolved: compliance.is_scope_resolved,
      compliance_status: compliance.compliance_status,
      exceptions: compliance.exceptions.map((e) => ({ ...e })),

      energy_input_mj: compliance.energy_input_mj,
      total_wtw_emissions_gco2e: compliance.total_wtw_emissions_gco2e,
      ghg_intensity_gco2e_per_mj: compliance.ghg_intensity_gco2e_per_mj,

      baseline_gco2e_per_mj: compliance.baseline_gco2e_per_mj,
      target_gco2e_per_mj: compliance.target_gco2e_per_mj,
      target_source: input.rules?.target_source ?? null,
      reduction_pct: compliance.reduction_pct,
      compliance_balance: compliance.compliance_balance,
      surplus_or_deficit: compliance.surplus_or_deficit,

      biofuel_energy_mj: compliance.biofuel_energy_mj,
      fossil_energy_mj: compliance.fossil_energy_mj,
      iscc_missing_flag: isccMissing.length > 0,
      iscc_missing_details: isccMissing,

      ops_energy_mj: compliance.ops_energy_mj,
      ops_data_available: compliance.ops_data_available,

      penalty_exposure_estimate: compliance.penalty_exposure_estimate,
      penalty_is_estimate: compliance.penalty_is_estimate,
      penalty_assessed_eur: compliance.penalty_assessed_eur,
      penalty_formula_version: input.rules?.penalty_formula_version ?? null,

      banking: { ...compliance.banking },
      borrowing: { ...compliance.borrowing },
      pooling: { ...compliance.pooling },

      voyage_contributions: compliance.voyage_contributions.map((v) => ({ ...v })),
      voyage_ids: input.voyages?.map((v) => v.id) ?? [],
      energy_contributions: energyContributions.map((c) => ({
        ...c,
        wtw_factor_source: c.wtw_factor_source || WtWFactorForUncertified(c.fuel_type)?.source || "",
      })),
      unknown_ports: compliance.voyage_contributions.flatMap((v) =>
        v.unknown_ports.filter((p) => p),
      ),
      consumption_rows: (input.consumption ?? []).map((c) => ({ ...c })),

      calculated_at: ts,
    };

    return result;
  }

  /** Calculate and persist a FuelEU result (lossless round-trip). */
  async calculateAndSave(input: FuelEuCalculationInput): Promise<FuelEuCalculationResult> {
    const result = await this.calculate(input);

    const record: FuelEuRecordInsert = {
      vessel_id: result.vessel_id,
      reporting_year: result.reporting_year,
      calculation_version: result.calculation_version,
      status: result.status,
      energy_input_mj: result.energy_input_mj,
      total_wtw_emissions_gco2e: result.total_wtw_emissions_gco2e,
      ghg_intensity_gco2e_per_mj: result.ghg_intensity_gco2e_per_mj,
      target_gco2e_per_mj: result.target_gco2e_per_mj,
      compliance_balance: result.compliance_balance,
      surplus_or_deficit: result.surplus_or_deficit,
      penalty_exposure_estimate: result.penalty_exposure_estimate,
      penalty_formula_version: result.penalty_formula_version,
      biofuel_energy_mj: result.biofuel_energy_mj,
      fossil_energy_mj: result.fossil_energy_mj,
      iscc_missing_flag: result.iscc_missing_flag,
      iscc_missing_details: result.iscc_missing_details,
      ops_energy_mj: result.ops_energy_mj,
      ops_data_available: result.ops_data_available,
      parameter_version: result.parameter_version,
      calculation_details: {
        calculation_version: result.calculation_version,
        compliance_status: result.compliance_status,
        is_in_scope: result.is_in_scope,
        compliance_applicable: result.compliance_applicable,
        compliance_scope_resolved: result.compliance_scope_resolved,
        gt: result.gt,
        baseline_gco2e_per_mj: result.baseline_gco2e_per_mj,
        target_source: result.target_source,
        reduction_pct: result.reduction_pct,
        surplus_or_deficit: result.surplus_or_deficit,
        penalty_is_estimate: result.penalty_is_estimate,
        penalty_assessed_eur: result.penalty_assessed_eur,
        exceptions: result.exceptions,
        banking: result.banking,
        borrowing: result.borrowing,
        pooling: result.pooling,
        voyage_contributions: result.voyage_contributions,
        voyage_ids: result.voyage_ids,
        energy_contributions: result.energy_contributions,
        unknown_ports: result.unknown_ports,
        consumption_rows: result.consumption_rows,
        iscc_missing_details: result.iscc_missing_details,
        parameter_version: result.parameter_version,
        calculated_at: result.calculated_at,
      },
      calculated_at: result.calculated_at,
    };

    const saved = await this.repo.upsert(record);

    // Immutable audit trail (reuse audit_log — never a second mechanism).
    if (this.options.auditLog && this.options.organizationId) {
      await this.options.auditLog.insert({
        organization_id: this.options.organizationId,
        action: "fueleu.calculated",
        entity_type: "fuel_eu_record",
        entity_id: saved.id,
        after_data: {
          reporting_year: result.reporting_year,
          compliance_status: result.compliance_status,
          exceptions: result.exceptions.map((e) => e.code),
          compliance_balance: result.compliance_balance,
          penalty_exposure_estimate: result.penalty_exposure_estimate,
          calculation_version: result.calculation_version,
        },
        source: "fueleu-engine",
      });
    }

    return result;
  }

  /** Reconstruct a previously calculated FuelEU result (no data loss). */
  async getRecord(vesselId: string, year: number): Promise<FuelEuCalculationResult | null> {
    const row = await this.repo.findByVesselAndYear(vesselId, year);
    if (!row) return null;

    const details = (row.calculation_details ?? {}) as Record<string, unknown>;
    const cfg = row.calculation_version
      ? (row.calculation_details as { calculation_version?: string })?.calculation_version
      : undefined;

    const asArray = <T>(v: unknown): readonly T[] => {
      if (!Array.isArray(v)) return [];
      return v as T[];
    };

    const banking = (details.banking ?? undefined) as FuelEuBalanceToolResult | undefined;
    const borrowing = (details.borrowing ?? undefined) as FuelEuBalanceToolResult | undefined;
    const pooling = (details.pooling ?? undefined) as FuelEuBalanceToolResult | undefined;

    return {
      calculation_version: cfg ?? row.calculation_version,
      parameter_version: row.parameter_version,
      vessel_id: row.vessel_id,
      reporting_year: row.reporting_year,
      status: (row.status as FuelEuCalculationResult["status"]) ?? "draft",
      gt: details.gt == null ? null : (details.gt as number),
      is_in_scope: (details.is_in_scope as boolean | undefined) ?? false,
      compliance_applicable: (details.compliance_applicable as boolean | undefined) ?? false,
      compliance_scope_resolved: (details.compliance_scope_resolved as boolean | undefined) ?? false,
      compliance_status:
        (details.compliance_status as FuelEuCalculationResult["compliance_status"]) ?? "UNKNOWN",
      exceptions: asArray<FuelEuCalculationResult["exceptions"][number]>(details.exceptions),

      energy_input_mj: row.energy_input_mj,
      total_wtw_emissions_gco2e: row.total_wtw_emissions_gco2e,
      ghg_intensity_gco2e_per_mj: row.ghg_intensity_gco2e_per_mj,
      baseline_gco2e_per_mj: details.baseline_gco2e_per_mj == null ? null : (details.baseline_gco2e_per_mj as number),
      target_gco2e_per_mj: row.target_gco2e_per_mj,
      target_source: details.target_source == null ? null : (details.target_source as string),
      reduction_pct: details.reduction_pct == null ? null : (details.reduction_pct as number),
      compliance_balance: row.compliance_balance,
      surplus_or_deficit: (row.surplus_or_deficit as ComplianceSign | null) ?? null,

      biofuel_energy_mj: row.biofuel_energy_mj,
      fossil_energy_mj: row.fossil_energy_mj,
      iscc_missing_flag: row.iscc_missing_flag,
      iscc_missing_details: asArray<FuelEuCalculationResult["iscc_missing_details"][number]>(
        details.iscc_missing_details ?? row.iscc_missing_details,
      ),

      ops_energy_mj: row.ops_energy_mj,
      ops_data_available: row.ops_data_available,

      penalty_exposure_estimate: row.penalty_exposure_estimate,
      penalty_is_estimate: (details.penalty_is_estimate as boolean | undefined) ?? true,
      penalty_assessed_eur: details.penalty_assessed_eur == null ? null : (details.penalty_assessed_eur as number),
      penalty_formula_version: row.penalty_formula_version,

      banking: banking ?? { tool: null, status: "UNAVAILABLE", detail: null, energy_mj_applied: null, evidence: [] },
      borrowing: borrowing ?? { tool: null, status: "UNAVAILABLE", detail: null, energy_mj_applied: null, evidence: [] },
      pooling: pooling ?? { tool: null, status: "UNAVAILABLE", detail: null, energy_mj_applied: null, evidence: [] },

      voyage_contributions: asArray<FuelEuCalculationResult["voyage_contributions"][number]>(
        details.voyage_contributions,
      ),
      voyage_ids: asArray<string>(details.voyage_ids),
      energy_contributions: asArray<FuelEuCalculationResult["energy_contributions"][number]>(
        details.energy_contributions,
      ),
      unknown_ports: asArray<string>(details.unknown_ports),
      consumption_rows: asArray<FuelEuCalculationResult["consumption_rows"][number]>(
        details.consumption_rows ?? row.calculation_details.consumption_rows,
      ),

      calculated_at: row.calculated_at,
    };
  }
}

// ── Adapter ─────────────────────────────────────────────────────────────────

function toComplianceInput(input: FuelEuCalculationInput): FuelEuComplianceInput {
  return {
    vesselProfile: {
      gt: input.gt,
      flag: input.vessel_profile?.flag ?? null,
      vesselType: input.vessel_profile?.vessel_type ?? null,
    },
    applicability: input.applicability
      ? {
          status: input.applicability.status,
          is_decision_final: input.applicability.is_decision_final,
        }
      : null,
    consumption: input.consumption ?? [],
    voyages: (input.voyages ?? []).map((v) => ({
      voyage_id: v.id,
      departure_port: v.departure_port,
      arrival_port: v.arrival_port,
      scope_factor: v.scope_factor ?? null,
      scope_type: v.scope_type ?? "UNKNOWN",
      unknown_ports: v.unknown_ports ?? [],
    })),
    rules: {
      baseline_gco2e_per_mj: input.rules?.baseline_gco2e_per_mj ?? null,
      target_gco2e_per_mj: input.rules?.target_gco2e_per_mj ?? null,
      target_source: input.rules?.target_source ?? null,
      reduction_pct: input.rules?.reduction_pct ?? null,
      penalty_eur_per_tonne_vlsfoe: input.rules?.penalty_eur_per_tonne_vlsfoe ?? null,
      penalty_formula_version: input.rules?.penalty_formula_version ?? null,
    },
    ops_energy_mj: input.ops_energy_mj ?? 0,
    ops_data_available: input.ops_data_available ?? false,
    biofuel_certification: input.biofuel_certification ?? [],
    penalty_assessed_eur: input.penalty_assessed_eur ?? null,
    banking_requested: input.banking_requested ?? false,
    borrowing_requested: input.borrowing_requested ?? false,
    pooling_requested: input.pooling_requested ?? false,
    pool_snapshot: input.pool_snapshot ?? [],
  };
}
