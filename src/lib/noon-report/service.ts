/**
 * noon-report/service.ts — orchestration for noon report intelligence
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Wires the pure analysis + correlations to persistence and notifications:
 *   in  ← noon_reports (this report + previous), fuel_deliveries, voyage plan
 *   out ← analyzeNoonReport → validator + correlations → persisted evaluation
 *   notifications ← noon-report notifications (only for new evaluations)
 *
 * Deduplication: re-evaluating a report whose content is unchanged yields
 * `wasDuplicated: true` and skips persistence + notifications.
 */

import { analyzeNoonReport } from "./engine";
import { correlateNoonFuel, type FuelDeliveryLike } from "./fuel-correlation";
import { correlateNoonVoyage } from "./voyage-correlation";
import { correlateNoonFuelEu } from "./fueleu-correlation";
import { correlateNoonEts } from "./ets-correlation";
import { validateNoonReport } from "./validator";
import { buildNoonNotifications } from "./notifications";
import { noonReportFromRow } from "./parser";
import type {
  EngineReference,
  NoonFinding,
  NoonFuelCorrelation,
  NoonFuelEuOperationalInput,
  NoonEtsOperationalInput,
  NoonReportAnalysis,
  NoonReportDomain,
  NoonReportInsert,
  NoonReportRow,
  NoonReportUpdate,
  NoonValidatorResult,
  NoonVoyageCorrelation,
  VoyagePlanInput,
} from "./types";
import type { NotificationEvent } from "@/lib/notifications";

export interface NoonReportRepository {
  findById(id: string): Promise<NoonReportRow | null>;
  /** Ordered by report_date descending. */
  listByVesselId(vesselId: string, limit?: number): Promise<NoonReportRow[]>;
  findLatestByVesselId(vesselId: string): Promise<NoonReportRow | null>;
  insert(input: NoonReportInsert): Promise<NoonReportRow>;
  update(id: string, patch: NoonReportUpdate): Promise<NoonReportRow>;
}

export interface NoonServiceDeps {
  readonly noonRepo: NoonReportRepository;
  readonly vesselRepo: { findByImo(imo: string): Promise<{ id: string; name: string } | null> };
  readonly fuelRepo?: {
    findByVesselId(vesselId: string, from: string, to: string): Promise<ReadonlyArray<FuelDeliveryLike>>;
  };
  readonly notify?: { dispatch(event: NotificationEvent): Promise<unknown> };
  readonly engineReference?: EngineReference | null;
  readonly voyagePlanResolver?: (vesselId: string, reportDate: string) => Promise<VoyagePlanInput | null>;
}

export interface NoonCreateOptions {
  readonly now?: string;
  readonly notifyReportReceived?: boolean;
}

export interface NoonEvaluateOptions {
  readonly reportId?: string;
  readonly now?: string;
  readonly voyagePlan?: VoyagePlanInput | null;
  readonly deliveries?: ReadonlyArray<FuelDeliveryLike>;
  readonly persist?: boolean;
}

export interface NoonEvaluateOutcome {
  readonly report: NoonReportRow;
  readonly domain: NoonReportDomain;
  readonly analysis: NoonReportAnalysis;
  readonly validator: NoonValidatorResult;
  readonly fuel: NoonFuelCorrelation;
  readonly voyage: NoonVoyageCorrelation;
  readonly fueleu: NoonFuelEuOperationalInput;
  readonly ets: NoonEtsOperationalInput;
  readonly findings: ReadonlyArray<NoonFinding>;
  readonly wasDuplicated: boolean;
  readonly dispatchedNotifications: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

export class NoonReportService {
  constructor(private readonly deps: NoonServiceDeps) {}

  async create(imo: string, report: NoonReportDomain, opts: NoonCreateOptions = {}): Promise<NoonReportRow> {
    const vessel = await this.deps.vesselRepo.findByImo(imo);
    if (!vessel) {
      throw new Error(`Vessel not found for IMO ${imo}`);
    }

    const insert: NoonReportInsert = {
      vessel_id: vessel.id,
      imo,
      vessel_name: report.vesselName ?? vessel.name,
      report_date: report.reportDate,
      position_latitude: report.positionLatitude,
      position_longitude: report.positionLongitude,
      speed_knots: report.speedKnots,
      course_degrees: report.courseDegrees,
      distance_to_go_nm: report.distanceToGoNm,
      fuel_consumption_tonnes: report.fuelConsumptionTonnes,
      fuel_robs_tonnes: report.fuelRobsTonnes,
      engine_rpm: report.engineRpm,
      sea_state: report.seaState,
      wind_speed_knots: report.windSpeedKnots,
      wind_direction: report.windDirection,
      summary: report.summary,
      warnings: report.warnings,
      confidence: report.confidence,
      source: report.source,
      source_document_id: report.sourceDocumentId,
      review_state: report.reviewState,
      is_blocked: report.isBlocked,
    };

    const row = await this.deps.noonRepo.insert(insert);

    if (opts.notifyReportReceived && this.deps.notify) {
      const domain = noonReportFromRow(row);
      const analysis = analyzeNoonReport({
        report: domain,
        vessel: { vesselId: vessel.id, imo, name: vessel.name },
        previous: null,
        now: opts.now,
      });
      for (const notification of buildNoonNotifications({
        report: domain,
        analysis,
        findings: [],
        reportReceived: true,
      })) {
        await this.deps.notify.dispatch(notification);
      }
    }

    return row;
  }

  async latest(imo: string): Promise<NoonReportRow | null> {
    const vessel = await this.deps.vesselRepo.findByImo(imo);
    if (!vessel) return null;
    return this.deps.noonRepo.findLatestByVesselId(vessel.id);
  }

  async history(imo: string, limit = 50): Promise<NoonReportRow[]> {
    const vessel = await this.deps.vesselRepo.findByImo(imo);
    if (!vessel) return [];
    return this.deps.noonRepo.listByVesselId(vessel.id, limit);
  }

  async evaluate(imo: string, opts: NoonEvaluateOptions = {}): Promise<NoonEvaluateOutcome> {
    const vessel = await this.deps.vesselRepo.findByImo(imo);
    if (!vessel) {
      throw new Error(`Vessel not found for IMO ${imo}`);
    }

    const persist = opts.persist ?? true;
    const now = opts.now ?? new Date().toISOString();

    const list = await this.deps.noonRepo.listByVesselId(vessel.id, 100);
    if (list.length === 0) {
      throw new Error(`No noon reports on file for vessel ${vessel.name} (IMO ${imo})`);
    }

    const current = opts.reportId ? list.find((r) => r.id === opts.reportId) ?? null : list[0] ?? null;
    if (!current) {
      throw new Error(`Noon report ${opts.reportId ?? ""} not found for vessel ${vessel.name}`);
    }

    const currentIndex = list.findIndex((r) => r.id === current.id);
    const previous = currentIndex >= 0 ? list[currentIndex + 1] ?? null : null;

    const report = noonReportFromRow(current);
    const previousDomain = previous ? noonReportFromRow(previous) : null;

    const engineReference = this.deps.engineReference ?? null;
    const voyagePlan =
      opts.voyagePlan !== undefined
        ? opts.voyagePlan
        : (this.deps.voyagePlanResolver ? await this.deps.voyagePlanResolver(vessel.id, report.reportDate) : null);

    let deliveries: ReadonlyArray<FuelDeliveryLike> = opts.deliveries ?? [];
    if (opts.deliveries === undefined && this.deps.fuelRepo) {
      const from = previousDomain?.reportDate ?? report.reportDate;
      deliveries = await this.deps.fuelRepo.findByVesselId(vessel.id, from, report.reportDate);
    }

    const fuel = correlateNoonFuel({ report, previous: previousDomain, deliveries });

    const analysis = analyzeNoonReport({
      report,
      vessel: { vesselId: vessel.id, imo, name: vessel.name },
      previous: previousDomain,
      engineReference,
      voyagePlan,
      fuelAttribution: fuel.attribution.length > 0 ? fuel.attribution : null,
      now,
    });

    const validator = validateNoonReport({ report, analysis });
    const voyage = correlateNoonVoyage({ report, previous: previousDomain, analysis, voyagePlan });
    const fueleu = correlateNoonFuelEu({ report, analysis });
    const ets = correlateNoonEts({ report, analysis });

    const findings: NoonFinding[] = [
      ...validator.findings,
      ...fuel.findings,
      ...voyage.findings,
      ...fueleu.findings,
      ...ets.findings,
    ];

    if (!persist) {
      return {
        report: current,
        domain: report,
        analysis,
        validator,
        fuel,
        voyage,
        fueleu,
        ets,
        findings,
        wasDuplicated: false,
        dispatchedNotifications: 0,
      };
    }

    // ── Deduplication ──────────────────────────────────────────────────────
    const duplicated =
      current.evaluated_at !== null &&
      current.dedup_key !== null &&
      current.dedup_key === analysis.dedupKey;

    if (duplicated) {
      return {
        report: current,
        domain: report,
        analysis,
        validator,
        fuel,
        voyage,
        fueleu,
        ets,
        findings,
        wasDuplicated: true,
        dispatchedNotifications: 0,
      };
    }

    const patch: NoonReportUpdate = {
      analysis: asRecord(analysis),
      findings: findings as unknown as ReadonlyArray<Record<string, unknown>>,
      fuel_correlation: asRecord(fuel),
      voyage_correlation: asRecord(voyage),
      fueleu_operational: asRecord(fueleu),
      ets_operational: asRecord(ets),
      evaluated_at: now,
      evaluation_version: analysis.engineVersion,
      dedup_key: analysis.dedupKey,
    };
    const updated = await this.deps.noonRepo.update(current.id, patch);

    // ── Notifications (new evaluations only) ───────────────────────────────
    let dispatchedNotifications = 0;
    if (this.deps.notify) {
      const notifications = buildNoonNotifications({
        report,
        analysis,
        findings,
        reportReceived: false,
      });
      for (const notification of notifications) {
        await this.deps.notify.dispatch(notification);
        dispatchedNotifications += 1;
      }
    }

    return {
      report: updated,
      domain: report,
      analysis,
      validator,
      fuel,
      voyage,
      fueleu,
      ets,
      findings,
      wasDuplicated: false,
      dispatchedNotifications,
    };
  }
}
