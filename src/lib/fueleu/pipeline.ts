/**
 * fuelEu/pipeline.ts — FuelEU Maritime production pipeline (scope-aware, E2E)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Part 3 wires the FuelEU engine to the SAME Part 1 foundation and Part 2 EU ETS
 * pipeline patterns — NOT a second architecture. This producer mirrors
 * `EtsPipelineService`:
 *
 *   1. reads the effective `fueleu_scope` / `fueleu_baseline` / `fueleu_target`
 *      / `fueleu_penalty` RULES from `regulatory_rules` (no hardcoded schedule);
 *   2. computes + persists `regulation_applicability` (FUEL_EU, idempotent);
 *   3. attributes BDN-evidenced consumption per (voyage, fuel) via the Part 1
 *      `attributeVoyageConsumption` producer and persists it;
 *   4. resolves authoritative port countries from `port_calls` and reuses the
 *      EU ETS port classifier for FuelEU geographic weighting (no 2nd classifier);
 *   5. derives biofuel (ISCC) certification evidence from the certificate registry;
 *   6. delegates to `FuelEUComplianceService.calculateAndSave`, which persists the
 *      `fuel_eu_record` and an immutable `audit_log` trail.
 *
 * UNKNOWN/unknown are preserved end-to-end (NULL aggregates, UNKNOWN scope,
 * missing-consumption → UNKNOWN) — never coerced to 0.
 */

import { FuelEUComplianceService } from "@/lib/fueleu/service";
import type { FuelEuCalculationResult } from "@/lib/fueleu/types";
import { determineApplicability, ruleEffectiveOn } from "@/lib/regulatory/applicability";
import { attributeVoyageConsumption } from "@/lib/regulatory/consumption";
import type { VesselProfile } from "@/lib/regulatory/types";
import type { FuelEuVoyageScopeType } from "@/lib/fueleu/types";
import { classifyVoyagePortStatusWithHints } from "@/lib/eu-ets/port-classifier";
import type { VesselRepository } from "@/lib/supabase/repositories/vessels";
import type { VoyageRepository } from "@/lib/supabase/repositories/voyages";
import type { FuelDeliveryRepository } from "@/lib/supabase/repositories/fuel_deliveries";
import type { FuelDeliveryRow } from "@/lib/supabase/types";
import type { NoonReportRepository } from "@/lib/supabase/repositories/noon_reports";
import type { PortCallRepository } from "@/lib/supabase/repositories/port_calls";
import type { RegulatoryRuleRepository } from "@/lib/supabase/repositories/regulatory_rules";
import type { RegulationApplicabilityRepository } from "@/lib/supabase/repositories/regulation_applicability";
import type { VoyageConsumptionRepository } from "@/lib/supabase/repositories/voyage_consumption";
import type { FuelEuRecordRepository } from "@/lib/supabase/repositories/fuel_eu_records";
import type { AuditLogRepository } from "@/lib/supabase/repositories/audit_log";
import type { CertificateRepository } from "@/lib/supabase/repositories/certificates";
import { getLhv } from "@/lib/fueleu/parameters";

/**
 * Orchestrates the FuelEU production pipeline end-to-end so a real vessel/year
 * yields a defensible, scope-aware, fully reconstructable result.
 */
export class FuelEuPipelineService {
  private readonly fueleu: FuelEUComplianceService;

  constructor(private readonly deps: FuelEuPipelineDependencies) {
    this.fueleu = new FuelEUComplianceService(deps.fuelEuRecords, {
      auditLog: deps.auditLog,
      organizationId: deps.organizationId,
    });
  }

  async run(vesselId: string, reportingYear: number): Promise<FuelEuCalculationResult> {
    const vessel = await this.deps.vessels.findById(vesselId);
    if (!vessel) {
      throw new FuelEuPipelineError(`vessel_required`, `Vessel ${vesselId} not found.`);
    }

    const asOf = `${reportingYear}-01-01`;
    const facts: VesselProfile = {
      vessel_id: vesselId,
      imo: vessel.imo,
      gt: vessel.gross_tonnage ?? null,
      flag: vessel.flag ?? null,
      vesselType: vessel.vessel_type ?? null,
      vesselCategory: vessel.vessel_category ?? null,
    };

    // ── Rules (authoritative, from regulatory_rules) ──────────────────────
    const scopeVersions = await this.deps.regulatoryRules.findByKey("FUEL_EU", "fueleu_scope");
    const baselineVersions = await this.deps.regulatoryRules.findByKey("FUEL_EU", "fueleu_baseline");
    const targetVersions = await this.deps.regulatoryRules.findByKey("FUEL_EU", "fueleu_target");
    const penaltyVersions = await this.deps.regulatoryRules.findByKey("FUEL_EU", "fueleu_penalty");

    const scopeRule = ruleEffectiveOn(scopeVersions, asOf);
    const baselineRule = ruleEffectiveOn(baselineVersions, asOf);
    const targetRule = ruleEffectiveOn(targetVersions, asOf);
    const penaltyRule = ruleEffectiveOn(penaltyVersions, asOf);

    const baselineParams = (baselineRule?.parameters ?? {}) as
      | { baseline_ghg_intensity_gco2e_per_mj?: number; value?: number }
      | undefined;
    const baseline =
      typeof baselineParams?.baseline_ghg_intensity_gco2e_per_mj === "number"
        ? baselineParams.baseline_ghg_intensity_gco2e_per_mj
        : typeof baselineParams?.value === "number"
          ? baselineParams.value
          : null;
    const targetParams = (targetRule?.parameters ?? {}) as { reduction_pct?: number } | undefined;
    const reductionPct =
      typeof targetParams?.reduction_pct === "number" ? targetParams.reduction_pct : null;
    const target =
      baseline !== null && reductionPct !== null ? baseline * (1 - reductionPct) : null;
    const penaltyParams = (penaltyRule?.parameters ?? {}) as
      | {
          penalty_eur_per_tonne?: number;
          penalty_eur_per_tonne_vlsfoe?: number;
          is_estimate?: boolean;
        }
      | undefined;
    const penaltyPerTonne =
      typeof penaltyParams?.penalty_eur_per_tonne === "number"
        ? penaltyParams.penalty_eur_per_tonne
        : typeof penaltyParams?.penalty_eur_per_tonne_vlsfoe === "number"
          ? penaltyParams.penalty_eur_per_tonne_vlsfoe
          : null;

    if (scopeRule === null) {
      throw new FuelEuPipelineError(
        "scope_rule_unavailable",
        `No effective FUEL_EU fuelEu_scope rule as of ${asOf}.`,
      );
    }
    if (baselineRule === null || baseline === null) {
      throw new FuelEuPipelineError(
        "baseline_rule_unavailable",
        `No effective FUEL_EU fuelEu_baseline rule (with a numeric value) as of ${asOf}. Refusing to compute a target with a fabricated baseline.`,
      );
    }
    if (targetRule === null || reductionPct === null) {
      throw new FuelEuPipelineError(
        "target_rule_unavailable",
        `No effective FUEL_EU fuelEu_target rule (with a reduction_pct) as of ${asOf}.`,
      );
    }

    // ── Applicability (produce + persist) ─────────────────────────────────
    const decision = determineApplicability({ rule: scopeRule, facts }, "FUEL_EU", asOf);
    await this.deps.regulationApplicability.upsert({
      vessel_id: vesselId,
      regulation: "FUEL_EU",
      reporting_year: reportingYear,
      applicability: decision.applicability,
      is_decision_final: decision.is_decision_final,
      rule_version: decision.rule_version,
      rule_effective_from: decision.rule_effective_from,
      rule_effective_until: decision.rule_effective_until,
      basis: decision.basis,
      notes: decision.notes,
    });

    // ── Consumption (produce + persist) ───────────────────────────────────
    const voyages = await this.deps.voyages.findByVesselAndYear(vesselId, reportingYear);
    const deliveries = await this.deps.fuelDeliveries.findByVesselAndYear(vesselId, reportingYear);
    const noonReports = await this.deps.noonReports.listByVesselId(vesselId);
    const robsByDate = noonReports
      .filter((r) => r.fuel_robs_tonnes !== null && r.fuel_robs_tonnes !== undefined)
      .map((r) => ({
        date: r.report_date,
        fuel_type: "",
        rob_mt: (r.fuel_robs_tonnes as number) ?? 0,
      }));

    for (const voyage of voyages) {
      const evidence = this.deliveriesForVoyage(
        deliveries,
        voyage.id,
        voyage.departure_time,
        voyage.arrival_time,
      );
      const fuels = new Set(evidence.map((d) => d.fuel_type));
      for (const fuelType of fuels) {
        const fuelEvidence = evidence.filter((d) => d.fuel_type === fuelType);
        const attribution = attributeVoyageConsumption({
          vessel_id: vesselId,
          voyage,
          reporting_year: reportingYear,
          noonReports,
          deliveries: fuelEvidence,
          robsByDate,
          fuelType,
        });
        // Persist only evidenced attribution (BDN path → real quantity).
        // Voyages without BDN evidence produce no row here; the engine then
        // reports MISSING_CONSUMPTION → UNKNOWN instead of a fabricated 0.
        await this.deps.voyageConsumption.upsert({
          vessel_id: vesselId,
          voyage_id: voyage.id,
          reporting_year: reportingYear,
          fuel_type: attribution.fuel_type ?? fuelType,
          quantity_mt: attribution.quantity_mt,
          method: attribution.method,
          confidence: attribution.confidence,
          status: attribution.status,
          source_type: attribution.source_type,
          source_record_ids: attribution.source_record_ids,
          attribution_method: attribution.attribution_method,
          traceability: attribution.traceability,
          notes: attribution.notes,
        });
      }
    }

    const consumptionRows = await this.deps.voyageConsumption.listByVessel(
      vesselId,
      reportingYear,
    );

    // ── Authoritative port countries (port_calls) + FuelEU scope weighting ─
    const portCalls = await this.deps.portCalls.findByVesselId(vesselId);
    const voyagesScope = voyages.map((v) => {
      const depCountry = portCountry(portCalls, v.departure_port_name);
      const arrCountry = portCountry(portCalls, v.arrival_port_name);
      const status = classifyVoyagePortStatusWithHints(
        v.departure_port_name,
        v.arrival_port_name,
        depCountry,
        arrCountry,
      );
      const { scope_type, scope_factor } = scopeForType(status.type);
      return {
        id: v.id,
        departure_port: v.departure_port_name,
        arrival_port: v.arrival_port_name,
        departure_country: depCountry,
        arrival_country: arrCountry,
        scope_type,
        scope_factor,
        unknown_ports: [...status.unknownPorts],
      };
    });

    // ── Biofuel (ISCC) certification evidence from the certificate registry ─
    const biofuelCertification = await this.buildBiofuelCertification(
      vesselId,
      consumptionRows.map((c) => c.fuel_type),
      asOf,
    );

    // ── OPS (shore power) — regulatory sub-component tied to the canonical
    //    activity model. With no separate OPS consumption source wired, OPS is
    //    surfaced as data-unavailable so the berth energy gap is visible. ─────
    const opsEnergyMj = 0;
    const opsDataAvailable = false;

    // ── Engine (persists fuel_eu_record + audit trail) ────────────────────
    return this.fueleu.calculateAndSave({
      vessel_id: vesselId,
      reporting_year: reportingYear,
      gt: facts.gt,
      status: "draft",
      vessel_profile: {
        flag: facts.flag,
        vessel_type: facts.vesselType,
        vessel_category: facts.vesselCategory,
      },
      applicability: {
        status: decision.applicability,
        is_decision_final: decision.is_decision_final,
        rule_version: decision.rule_version,
        rule_effective_from: decision.rule_effective_from,
        rule_effective_until: decision.rule_effective_until,
        basis: decision.basis,
        notes: decision.notes,
      },
      consumption: consumptionRows,
      voyages: voyagesScope,
      rules: {
        baseline_gco2e_per_mj: baseline,
        target_gco2e_per_mj: target,
        target_source:
          targetRule.source_reference ?? `regulatory_rules.fueleu_target v${targetRule.version}`,
        reduction_pct: reductionPct,
        penalty_eur_per_tonne_vlsfoe: penaltyPerTonne,
        penalty_formula_version: penaltyRule
          ? `fueleu_penalty v${penaltyRule.version}`
          : null,
      },
      ops_energy_mj: opsEnergyMj,
      ops_data_available: opsDataAvailable,
      biofuel_certification: biofuelCertification,
    });
  }

  private deliveriesForVoyage(
    deliveries: FuelDeliveryRow[],
    voyageId: string,
    departureTime: string | null,
    arrivalTime: string | null,
  ): FuelDeliveryRow[] {
    return deliveries.filter((d) => {
      if (d.reconciled_voyage_id === voyageId) return true;
      if (departureTime && arrivalTime) {
        const t = new Date(d.delivery_date + "T00:00:00Z").getTime();
        const dep = new Date(departureTime).getTime();
        const arr = new Date(arrivalTime).getTime();
        if (t >= dep - 7 * 86400000 && t <= arr + 7 * 86400000) return true;
      }
      return false;
    });
  }

  private async buildBiofuelCertification(
    vesselId: string,
    fuelTypes: readonly string[],
    asOf: string,
  ): Promise<
    ReadonlyArray<{
      fuel_type: string;
      voyage_id: string | null;
      certificate_status:
        | "VALID"
        | "MISSING"
        | "EXPIRED"
        | "UNSUPPORTED"
        | "CONFLICT";
      detail: string;
    }>
  > {
    const biofuelSet = new Set<string>();
    for (const f of fuelTypes) {
      const lhv = getLhv(f);
      if (lhv?.category === "biofuel") biofuelSet.add(f);
    }
    if (biofuelSet.size === 0) return [];

    // ISCC certificates for this vessel (authoritative registry).
    const certificates = await this.deps.certificates.findByVesselId(vesselId, {
      certificateType: "ISCC",
      onlyCurrent: true,
    });

    const out: Array<{
      fuel_type: string;
      voyage_id: string | null;
      certificate_status: "VALID" | "MISSING" | "EXPIRED" | "UNSUPPORTED" | "CONFLICT";
      detail: string;
    }> = [];

    for (const fuelType of biofuelSet) {
      const relevant = certificates.filter(
        (c) => !c.expiry_date || new Date(c.expiry_date + "T00:00:00Z").getTime() >= new Date(asOf + "T00:00:00Z").getTime(),
      );
      if (relevant.length === 0) {
        out.push({
          fuel_type: fuelType,
          voyage_id: null,
          certificate_status: "MISSING",
          detail: `No current ISCC certificate for vessel; biofuel "${fuelType}" low-carbon credit cannot be assumed.`,
        });
        continue;
      }
      const valid = relevant.filter((c) => c.status === "valid" || c.status === "VALID");
      if (valid.length === 0) {
        out.push({
          fuel_type: fuelType,
          voyage_id: null,
          certificate_status: "EXPIRED",
          detail: `ISCC certificate(s) found but none is currently valid; biofuel "${fuelType}" low-carbon credit cannot be assumed.`,
        });
        continue;
      }
      if (valid.length > 1) {
        out.push({
          fuel_type: fuelType,
          voyage_id: null,
          certificate_status: "CONFLICT",
          detail: `Multiple current ISCC certificates exist for biofuel "${fuelType}" — reconciliation required.`,
        });
        continue;
      }
      // Valid single certificate → low-carbon credit assumed.
      out.push({
        fuel_type: fuelType,
        voyage_id: null,
        certificate_status: "VALID",
        detail: `ISCC certificate (${valid[0]?.certificate_number ?? "n/a"}) supports biofuel "${fuelType}".`,
      });
    }
    return out;
  }
}

/** FuelEU geographic scope weighting (FuelEU applies 100% intra-EU, 50% to/from EU, 0% non-EU). */
function scopeForType(type: string): {
  scope_type: FuelEuVoyageScopeType;
  scope_factor: number | null;
} {
  switch (type) {
    case "INTRA_EU":
      return { scope_type: "INTRA_EU", scope_factor: 1 };
    case "EU_TO_THIRD":
      return { scope_type: "EU_TO_THIRD", scope_factor: 0.5 };
    case "THIRD_TO_EU":
      return { scope_type: "THIRD_TO_EU", scope_factor: 0.5 };
    case "NON_EU":
      return { scope_type: "NON_EU", scope_factor: 0 };
    case "UNKNOWN":
      return { scope_type: "UNKNOWN", scope_factor: null };
    default:
      return { scope_type: "UNKNOWN", scope_factor: null };
  }
}

/** Look up the authoritative country for a port from port_calls (case-insensitive). */
function portCountry(
  portCalls: Array<{ port_name: string; port_country: string | null }>,
  portName: string,
): string | null {
  if (!portName) return null;
  const key = portName.trim().toLowerCase();
  const hit = portCalls.find((p) => p.port_name?.trim().toLowerCase() === key);
  return hit?.port_country ?? null;
}

export interface FuelEuPipelineDependencies {
  readonly vessels: VesselRepository;
  readonly voyages: VoyageRepository;
  readonly fuelDeliveries: FuelDeliveryRepository;
  readonly noonReports: NoonReportRepository;
  readonly portCalls: PortCallRepository;
  readonly regulatoryRules: RegulatoryRuleRepository;
  readonly regulationApplicability: RegulationApplicabilityRepository;
  readonly voyageConsumption: VoyageConsumptionRepository;
  readonly fuelEuRecords: FuelEuRecordRepository;
  readonly certificates: CertificateRepository;
  readonly auditLog?: AuditLogRepository;
  readonly organizationId?: string;
}

export class FuelEuPipelineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "FuelEuPipelineError";
  }
}

// Re-export for consumers that only need the versioned rule helper.
export { ruleEffectiveOn };
