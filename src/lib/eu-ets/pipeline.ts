import { EtsComplianceService } from "@/lib/eu-ets/service";
import type { EtsCalculationResult } from "@/lib/eu-ets/types";
import {
  determineApplicability,
  ruleEffectiveOn,
} from "@/lib/regulatory/applicability";
import { attributeVoyageConsumption } from "@/lib/regulatory/consumption";
import type { VesselProfile } from "@/lib/regulatory/types";
import type { EuaPriceProvider } from "@/lib/eua-price/provider";
import type { VesselRepository } from "@/lib/supabase/repositories/vessels";
import type { VoyageRepository } from "@/lib/supabase/repositories/voyages";
import type { FuelDeliveryRepository } from "@/lib/supabase/repositories/fuel_deliveries";
import type { FuelDeliveryRow } from "@/lib/supabase/types";
import type { NoonReportRepository } from "@/lib/supabase/repositories/noon_reports";
import type { PortCallRepository } from "@/lib/supabase/repositories/port_calls";
import type { RegulatoryRuleRepository } from "@/lib/supabase/repositories/regulatory_rules";
import type { RegulationApplicabilityRepository } from "@/lib/supabase/repositories/regulation_applicability";
import type { VoyageConsumptionRepository } from "@/lib/supabase/repositories/voyage_consumption";
import type { EuEtsRecordRepository } from "@/lib/supabase/repositories/eu_ets_records";
import type { AuditLogRepository } from "@/lib/supabase/repositories/audit_log";

/**
 * Orchestrates the EU ETS production pipeline end-to-end so a real
 * vessel/voyage yields a defensible result.
 *
 * Part 1 established the foundation (regulatory rules → applicability →
 * canonical consumption). Part 2.1's RED verdict was that NOTHING in
 * production wired that foundation into the engine — applicability and
 * consumption were never produced, and UNKNOWN/unknown were coerced to 0 /
 * NON_EU at persistence boundaries. This service is the missing producer:
 *
 *   1. reads the effective `ets_scope` + `ets_coverage` RULES from
 *      `regulatory_rules` (a fresh DB is bootstrapped by migration 0020); no
 *      hardcoded phase-in schedule is used;
 *   2. computes + persists `regulation_applicability` (idempotent upsert);
 *   3. attributes BDN-evidenced consumption per (voyage, fuel) via the Part 1
 *      `attributeVoyageConsumption` producer and persists it;
 *   4. resolves authoritative port countries from `port_calls`;
 *   5. delegates to `EtsComplianceService.calculateAndSave`, which persists the
 *      `eu_ets_record` and an immutable audit trail.
 *
 * UNKNOWN/unknown are preserved end-to-end (NULL obligation, UNKNOWN coverage,
 * missing-consumption → UNKNOWN) — they are never coerced to 0 / NON_EU.
 */
export class EtsPipelineService {
  private readonly ets: EtsComplianceService;

  constructor(private readonly deps: EtsPipelineDependencies) {
    this.ets = new EtsComplianceService(deps.euEtsRecords, {
      euaPriceProvider: deps.euaPriceProvider,
      auditLog: deps.auditLog,
      organizationId: deps.organizationId,
    });
  }

  /**
   * Compute + persist + return the EU ETS record for a vessel and year.
   * Throws `EtsPipelineError` when a required rule/fact is missing rather than
   * silently fabricating a fallback number.
   */
  async run(vesselId: string, reportingYear: number): Promise<EtsCalculationResult> {
    const vessel = await this.deps.vessels.findById(vesselId);
    if (!vessel) {
      throw new EtsPipelineError(`vessel_required`, `Vessel ${vesselId} not found.`);
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
    // Read all versions for each key and resolve the governing version with the
    // pure, Part-1 effective-date helper (single source of truth). This avoids
    // re-implementing effective-date logic in the pipeline.
    const scopeVersions = await this.deps.regulatoryRules.findByKey(
      "EU_ETS",
      "ets_scope",
    );
    const coverageVersions = await this.deps.regulatoryRules.findByKey(
      "EU_ETS",
      "ets_coverage",
    );
    const scopeRule = ruleEffectiveOn(scopeVersions, asOf);
    const coverageRule = ruleEffectiveOn(coverageVersions, asOf);
    const coverageParams = (coverageRule?.parameters ?? {}) as { rate?: number };
    const coverageRate =
      typeof coverageParams.rate === "number" ? coverageParams.rate : null;
    if (coverageRule === null || coverageRate === null) {
      throw new EtsPipelineError(
        "coverage_rule_unavailable",
        `No effective EU_ETS ets_coverage rule (with a numeric rate) as of ${asOf}. Refusing to compute an obligation with a fabricated/fixed coverage rate.`,
      );
    }

    // ── Applicability (produce + persist) ─────────────────────────────────
    const decision = determineApplicability(
      { rule: scopeRule ?? null, facts },
      "EU_ETS",
      asOf,
    );
    await this.deps.regulationApplicability.upsert({
      vessel_id: vesselId,
      regulation: "EU_ETS",
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
    const deliveries = await this.deps.fuelDeliveries.findByVesselAndYear(
      vesselId,
      reportingYear,
    );
    const noonReports = await this.deps.noonReports.listByVesselId(vesselId);
    const robsByDate = noonReports
      .filter((r) => r.fuel_robs_tonnes !== null && r.fuel_robs_tonnes !== undefined)
      .map((r) => ({
        date: r.report_date,
        fuel_type: "",
        rob_mt: (r.fuel_robs_tonnes as number) ?? 0,
      }));

    for (const voyage of voyages) {
      const evidence = this.deliveriesForVoyage(deliveries, voyage.id, voyage.departure_time, voyage.arrival_time);
      const fuels = new Set(evidence.map((d) => d.fuel_type));
      for (const fuelType of fuels) {
        // NOTE: pass the FULL per-voyage delivery set (not a per-fuel subset) so
        // the shared attribution layer can split aggregate noon consumption
        // across fuel types by BDN ratio (Part 3.6 double-count fix). The
        // requested fuelType selects the fuel; the engine resolves per-fuel.
        const attribution = attributeVoyageConsumption({
          vessel_id: vesselId,
          voyage,
          reporting_year: reportingYear,
          noonReports,
          deliveries: evidence,
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

    // ── Authoritative port countries (port_calls) ─────────────────────────
    const portCalls = await this.deps.portCalls.findByVesselId(vesselId);

    // ── Engine (persists eu_ets_record + audit trail) ─────────────────────
    return this.ets.calculateAndSave({
      vessel_id: vesselId,
      reporting_year: reportingYear,
      gt: facts.gt,
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
      deliveries: deliveries.map((d) => ({
        id: d.id,
        fuel_type: d.fuel_type,
        quantity_mt: d.quantity_mt,
        delivery_date: d.delivery_date,
      })),
      voyages: voyages.map((v) => {
        const depCountry = portCountry(portCalls, v.departure_port_name);
        const arrCountry = portCountry(portCalls, v.arrival_port_name);
        return {
          id: v.id,
          departure_port: v.departure_port_name,
          arrival_port: v.arrival_port_name,
          departure_country: depCountry,
          arrival_country: arrCountry,
        };
      }),
      coverage_rate: coverageRate,
      coverage_rate_source:
        coverageRule.source_reference ?? `regulatory_rules.ets_coverage v${coverageRule.version}`,
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
}

/** Look up the authoritative country for a port from port_calls (case-insensitive). */
function portCountry(portCalls: Array<{ port_name: string; port_country: string | null }>, portName: string): string | null {
  if (!portName) return null;
  const key = portName.trim().toLowerCase();
  const hit = portCalls.find((p) => p.port_name?.trim().toLowerCase() === key);
  return hit?.port_country ?? null;
}

export interface EtsPipelineDependencies {
  readonly vessels: VesselRepository;
  readonly voyages: VoyageRepository;
  readonly fuelDeliveries: FuelDeliveryRepository;
  readonly noonReports: NoonReportRepository;
  readonly portCalls: PortCallRepository;
  readonly regulatoryRules: RegulatoryRuleRepository;
  readonly regulationApplicability: RegulationApplicabilityRepository;
  readonly voyageConsumption: VoyageConsumptionRepository;
  readonly euEtsRecords: EuEtsRecordRepository;
  readonly euaPriceProvider?: EuaPriceProvider;
  readonly auditLog?: AuditLogRepository;
  readonly organizationId?: string;
}

export class EtsPipelineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EtsPipelineError";
  }
}

// Re-export for consumers that only need the versioned rule helper. Kept for
// future rule-drift checks; the pipeline uses `findEffective` directly.
export { ruleEffectiveOn };
