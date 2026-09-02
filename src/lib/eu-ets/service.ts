import type { EuEtsRecordRepository } from "@/lib/supabase/repositories/eu_ets_records";
import type { AuditLogRepository } from "@/lib/supabase/repositories/audit_log";
import type { EtsCalculationInput, EtsCalculationResult, EuEtsRecordInsert } from "@/lib/eu-ets/types";
import { ETS_CALCULATION_VERSION, etsScopeForGt, mrvScopeForGt } from "@/lib/eu-ets/types";
import { ETS_PARAMETER_VERSION_WITH_CLASSIFIER, getEtsCoverageRate } from "@/lib/eu-ets/parameters";
import { classifyVoyagePortStatus, type VoyagePortStatus } from "@/lib/eu-ets/port-classifier";
import { computeDeadlines } from "@/lib/eu-ets/deadlines";
import { evaluateEtsCompliance } from "@/lib/eu-ets/compliance";
import type { EtsComplianceStatus, EtsException } from "@/lib/eu-ets/compliance";
import { getEuaPrice } from "@/lib/eua-price/provider";
import type { EuaPriceProvider } from "@/lib/eua-price/provider";
import { determineApplicability } from "@/lib/regulatory/applicability";
import type { RegulatoryRuleRow } from "@/lib/supabase/types";

export interface EtsComplianceServiceOptions {
  readonly euaPriceProvider?: EuaPriceProvider;
  /** Wired to record an immutable audit trail on each persisted calculation. */
  readonly auditLog?: AuditLogRepository;
  readonly organizationId?: string;
  /** Optional effective EU_ETS rule used to derive applicability when not supplied. */
  readonly effectiveEtsRule?: RegulatoryRuleRow | null;
}

export class EtsComplianceService {
  constructor(
    private readonly repo: EuEtsRecordRepository,
    private readonly options: EtsComplianceServiceOptions = {},
  ) {}

  async calculate(input: EtsCalculationInput): Promise<EtsCalculationResult> {
    const paramVer = input.parameter_version_override ?? ETS_PARAMETER_VERSION_WITH_CLASSIFIER;
    const ts = new Date().toISOString();

    // Scope signals (backward-compatible fields) — GT-based.
    const gt = input.gt ?? null;
    const etsScope = etsScopeForGt(gt);
    const mrvScope = mrvScopeForGt(gt);
    const isInScope = etsScope === "IN_SCOPE";

    // ── Applicability (Part 1 foundation) ─────────────────────────────────
    // Use a provided determination; otherwise derive from the effective rule +
    // vessel facts; otherwise UNKNOWN (never silently assumed).
    let applicability:
      | {
          status: "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN" | "REQUIRES_REVIEW";
          is_decision_final: boolean;
        }
      | null = input.applicability ?? null;

    if (applicability === null && this.options.effectiveEtsRule) {
      const decision = determineApplicability(
        {
          rule: this.options.effectiveEtsRule,
          facts: {
            vessel_id: input.vessel_id,
            imo: "",
            gt,
            flag: input.vessel_profile?.flag ?? null,
            vesselType: input.vessel_profile?.vessel_type ?? null,
            vesselCategory: input.vessel_profile?.vessel_category ?? null,
          },
        },
        "EU_ETS",
        `${input.reporting_year}-01-01`,
      );
      applicability = {
        status: decision.applicability,
        is_decision_final: decision.is_decision_final,
      };
    }

    // ── Voyage geographic classification ──────────────────────────────────
    const classified = input.voyages.map((v) => ({
      voyage_id: v.id,
      departure_port: v.departure_port,
      arrival_port: v.arrival_port,
      status: classifyVoyagePortStatus(v.departure_port, v.arrival_port) as VoyagePortStatus,
    }));

    // ── EUA price ─────────────────────────────────────────────────────────
    // Distinguish a user-supplied price from a provider price. A missing price
    // is surfaced (PRICE_UNAVAILABLE), never fabricated.
    const priceProvider = this.options.euaPriceProvider ?? { name: "default", getPrice: getEuaPrice };
    let priceValue: number | null = null;
    let priceAvailable = false;
    let priceSource = input.eua_price_source ?? "none";

    if (typeof input.eua_price_eur === "number" && !isNaN(input.eua_price_eur)) {
      priceValue = input.eua_price_eur;
      priceAvailable = true;
      priceSource = input.eua_price_source ?? "provided";
    } else {
      const providerPrice = await priceProvider.getPrice();
      if (providerPrice !== null) {
        priceValue = providerPrice;
        priceAvailable = true;
        priceSource = priceProvider.name;
      } else {
        priceSource = `${priceProvider.name}:unavailable`;
      }
    }

    // ── Compliance evaluation (pure core) ─────────────────────────────────
    // Coverage rate comes from a versioned regulatory rule when provided,
    // otherwise the engine's built-in phase-in schedule (legacy fallback).
    const coverageEntry =
      typeof input.coverage_rate === "number" && !isNaN(input.coverage_rate)
        ? {
            rate: input.coverage_rate,
            source: input.coverage_rate_source ?? "regulatory_rules.ets_coverage",
          }
        : getEtsCoverageRate(input.reporting_year);
    const compliance = evaluateEtsCompliance({
      vesselProfile: {
        gt,
        flag: input.vessel_profile?.flag ?? null,
        vesselType: input.vessel_profile?.vessel_type ?? null,
        vesselCategory: input.vessel_profile?.vessel_category ?? null,
      },
      applicability,
      consumption: input.consumption ?? [],
      voyages: classified,
      coverageRate: coverageEntry.rate,
      price: { available: priceAvailable, source: priceSource, value_eur: priceValue },
      actualAllowanceTonnes: input.actual_allowance_tonnes ?? null,
    });

    const coveredCo2 = compliance.covered_co2_tonnes;
    const euaObligation = compliance.eua_obligation_tonnes;
    const estimatedCost = compliance.estimated_cost_eur;

    // Deadlines
    const deadlines = computeDeadlines(input.reporting_year);

    // Unknown ports (explicit)
    const unknownPorts = classified.flatMap((c) => c.status.unknownPorts);

    // Voyage contributions — map from the compliance engine.
    const voyageContribs = compliance.voyageCompliance.map((vc) => ({
      voyage_id: vc.voyage_id,
      departure_port: vc.departure_port,
      arrival_port: vc.arrival_port,
      coverage_type: vc.coverage_type === "UNKNOWN" ? "NON_EU" : vc.coverage_type,
      coverage_factor: vc.coverage_factor,
      ttw_co2_tonnes: vc.ttw_co2_tonnes,
      covered_co2_tonnes: vc.covered_co2_tonnes ?? 0,
    }));

    return {
      calculation_version: ETS_CALCULATION_VERSION,
      parameter_version: paramVer,
      vessel_id: input.vessel_id,
      reporting_year: input.reporting_year,

      gt,
      ets_scope: etsScope,
      mrv_scope: mrvScope,
      is_in_scope: isInScope,

      total_ttw_co2_tonnes: compliance.total_ttw_co2_tonnes,
      covered_co2_tonnes: coveredCo2 !== null ? round(coveredCo2, 4) : 0,
      coverage_rate: coverageEntry.rate,
      coverage_rate_version: coverageEntry.source,

      eua_obligation_tonnes: euaObligation !== null ? round(euaObligation, 4) : 0,
      eua_price_eur: priceValue,
      eua_price_available: priceAvailable,
      estimated_cost_eur: estimatedCost !== null ? round(estimatedCost, 2) : null,

      surrender_deadline: deadlines.surrender,
      mrv_deadline: deadlines.mrvReporting,

      voyage_contributions: voyageContribs,
      voyage_ids: input.voyages.map((v) => v.id),
      delivery_ids: input.deliveries.map((d) => d.id),

      unknown_ports: unknownPorts,

      compliance_status: compliance.compliance_status,
      exceptions: compliance.exceptions as readonly EtsException[],
      compliance_applicable: compliance.scope_applicable,
      compliance_scope_resolved: compliance.is_scope_resolved,
      allowance: compliance.allowance,
      eua_price_source: priceSource,
      emission_breakdown: compliance.perVoyageEmissions.map((e) => ({
        voyage_id: e.voyage_id,
        fuel_type: e.fuel_type,
        quantity_mt: e.quantity_mt,
        ttw_co2_tonnes: e.ttw_co2_tonnes,
        method: e.method,
        confidence: e.confidence,
        status: e.status,
      })),

      calculated_at: ts,
    };
  }

  async calculateAndSave(input: EtsCalculationInput): Promise<EtsCalculationResult> {
    const result = await this.calculate(input);
    const deadlines = computeDeadlines(input.reporting_year);

    const record: EuEtsRecordInsert = {
      vessel_id: result.vessel_id,
      reporting_year: result.reporting_year,
      calculation_version: result.calculation_version,
      gt: result.gt,
      ets_scope: result.ets_scope,
      mrv_scope: result.mrv_scope,
      total_ttw_co2_tonnes: result.total_ttw_co2_tonnes,
      covered_co2_tonnes: result.covered_co2_tonnes,
      coverage_rate: result.coverage_rate,
      coverage_rate_version: result.coverage_rate_version,
      eua_obligation_tonnes: result.eua_obligation_tonnes,
      eua_price_eur: result.eua_price_eur,
      eua_price_available: result.eua_price_available,
      estimated_cost_eur: result.estimated_cost_eur,
      surrender_deadline: deadlines.surrender?.deadline_date ?? null,
      surrender_status: deadlines.surrender?.status ?? null,
      mrv_deadline: deadlines.mrvReporting?.deadline_date ?? null,
      mrv_deadline_status: deadlines.mrvReporting?.status ?? null,
      parameter_version: result.parameter_version,
      calculation_details: {
        calculation_version: result.calculation_version,
        parameter_version: result.parameter_version,
        calculated_at: result.calculated_at,
        compliance: {
          status: result.compliance_status,
          applicable: result.compliance_applicable,
          scope_resolved: result.compliance_scope_resolved,
          exceptions: result.exceptions as unknown[],
          allowance: result.allowance,
        },
        eua_price_source: result.eua_price_source,
        emission_breakdown: result.emission_breakdown.map((e) => ({
          voyage_id: e.voyage_id,
          fuel_type: e.fuel_type,
          quantity_mt: e.quantity_mt,
          ttw_co2_tonnes: e.ttw_co2_tonnes,
          method: e.method,
          confidence: e.confidence,
          status: e.status,
        })),
        voyage_contributions: result.voyage_contributions.map((vc) => ({
          voyage_id: vc.voyage_id,
          coverage_type: vc.coverage_type,
          coverage_factor: vc.coverage_factor,
        })),
      },
      calculated_at: result.calculated_at,
    };

    const saved = await this.repo.upsert(record);

    // Immutable audit trail (reuse audit_log — never a second mechanism).
    if (this.options.auditLog && this.options.organizationId) {
      await this.options.auditLog.insert({
        organization_id: this.options.organizationId,
        action: "eu_ets.calculated",
        entity_type: "eu_ets_record",
        entity_id: saved.id,
        after_data: {
          reporting_year: result.reporting_year,
          compliance_status: result.compliance_status,
          exceptions: (result.exceptions as unknown[]).map((e) => (e as { code: string }).code),
          eua_obligation_tonnes: result.eua_obligation_tonnes,
          calculation_version: result.calculation_version,
        },
        source: "eu-ets-engine",
      });
    }

    return result;
  }

  async getRecord(vesselId: string, year: number): Promise<EtsCalculationResult | null> {
    const row = await this.repo.findByVesselAndYear(vesselId, year);
    if (!row) return null;

    const details = (row.calculation_details ?? {}) as {
      compliance?: {
        status?: string;
        applicable?: boolean;
        scope_resolved?: boolean;
        exceptions?: unknown[];
        allowance?: {
          calculated_obligation_tonnes?: number | null;
          actual_balance_tonnes?: number | null;
          source?: "CALCULATED" | "AUTHORITATIVE" | "NONE";
        };
      };
      eua_price_source?: string;
      emission_breakdown?: Array<{
        voyage_id: string;
        fuel_type: string;
        quantity_mt: number;
        ttw_co2_tonnes: number;
        method: string;
        confidence: string;
        status: string;
      }>;
    };

    return {
      calculation_version: row.calculation_version,
      parameter_version: row.parameter_version,
      vessel_id: row.vessel_id,
      reporting_year: row.reporting_year,
      gt: row.gt,
      ets_scope: row.ets_scope as EtsCalculationResult["ets_scope"],
      mrv_scope: row.mrv_scope as EtsCalculationResult["mrv_scope"],
      is_in_scope: row.ets_scope === "IN_SCOPE",
      total_ttw_co2_tonnes: row.total_ttw_co2_tonnes,
      covered_co2_tonnes: row.covered_co2_tonnes,
      coverage_rate: row.coverage_rate,
      coverage_rate_version: row.coverage_rate_version,
      eua_obligation_tonnes: row.eua_obligation_tonnes,
      eua_price_eur: row.eua_price_eur,
      eua_price_available: row.eua_price_available,
      estimated_cost_eur: row.estimated_cost_eur,
      surrender_deadline: null,
      mrv_deadline: null,
      voyage_contributions: [],
      voyage_ids: [],
      delivery_ids: [],
      unknown_ports: [],
      compliance_status: (details.compliance?.status ?? "UNKNOWN") as EtsComplianceStatus,
      exceptions: (details.compliance?.exceptions ?? []) as readonly EtsException[],
      compliance_applicable: details.compliance?.applicable ?? false,
      compliance_scope_resolved: details.compliance?.scope_resolved ?? false,
      allowance: {
        calculated_obligation_tonnes:
          details.compliance?.allowance?.calculated_obligation_tonnes ?? null,
        actual_balance_tonnes: details.compliance?.allowance?.actual_balance_tonnes ?? null,
        source: details.compliance?.allowance?.source ?? "NONE",
      },
      eua_price_source: details.eua_price_source ?? "unknown",
      emission_breakdown: details.emission_breakdown ?? [],
      calculated_at: row.calculated_at,
    };
  }
}

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}
