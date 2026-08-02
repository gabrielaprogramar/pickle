/**
 * noon-report/types.ts — Noon Report intelligence domain types
 * ────────────────────────────────────────────────────────────────────────────
 *
 * A noon report is the daily position + fuel + engine report a vessel files at
 * 12:00 ship's time. This module turns a (possibly noisy) extraction into a
 * *deterministic* operational intelligence analysis:
 *
 *   - parser          normalises an AI extraction into the NoonReportDomain
 *   - engine          computes consumption, engine, weather, voyage, slip, rpm,
 *                     speed, prediction and deviation analysis (pure function)
 *   - validator       runs the shared RuleRegistry for documentType "noon_report"
 *                     plus data-quality cross-checks → findings
 *   - correlations    compare the report against fuel deliveries, voyage plan,
 *                     and the FuelEU / EU-ETS engines (feed-only, no duplicates)
 *
 * Determinism rule: never invent a missing value, never extrapolate beyond the
 * inputs. Everything is a pure function of its inputs. A missing value is
 * `null` and lowers the associated `confidence` — it is never guessed.
 */

export const NOON_REPORT_VERSION = "1.0.0";

export const NOON_REPORT_ENGINE_VERSION = "1.0.0";

// ── Lifecycle ──────────────────────────────────────────────────────────────

export type NoonReportStatus =
  | "EXTRACTED" // raw report stored, not yet analysed
  | "EVALUATED" // analysis + findings computed and persisted
  | "REVIEWED" // human review acknowledged the findings
  | "BLOCKED"; // blocking findings prevent use of the report

// ── Parsed domain report ────────────────────────────────────────────────────

/**
 * Normalised, validated values of a single noon report. All numeric values are
 * either present or `null` — never estimated. `fuelConsumptionTonnes` is the
 * consumption *since the previous noon report*; `fuelRobsTonnes` is the total
 * remaining on board at the report instant.
 */
export interface NoonReportDomain {
  readonly id: string | null;
  readonly vesselId: string | null;
  readonly imo: string;
  readonly vesselName: string | null;
  readonly reportDate: string;
  readonly positionLatitude: number | null;
  readonly positionLongitude: number | null;
  readonly speedKnots: number | null;
  readonly courseDegrees: number | null;
  readonly distanceToGoNm: number | null;
  readonly fuelConsumptionTonnes: number | null;
  readonly fuelRobsTonnes: number | null;
  readonly engineRpm: number | null;
  readonly seaState: string | null;
  readonly windSpeedKnots: number | null;
  readonly windDirection: string | null;
  readonly summary: string | null;
  readonly warnings: ReadonlyArray<string>;
  /** Aggregate extraction confidence 0..1. */
  readonly confidence: number;
  readonly source: string;
  readonly sourceDocumentId: string | null;
  readonly reviewState: string | null;
  readonly isBlocked: boolean;
}

/** Raw extraction shape fed to the parser (matches the AI extraction pipeline). */
export interface NoonReportExtractionInput {
  readonly extractionFields: Readonly<Record<string, unknown>>;
  readonly confidence: number;
  readonly warnings: ReadonlyArray<string>;
  readonly missingFields: ReadonlyArray<string>;
  readonly documentId: string | null;
  readonly source?: string;
}

/** Parser output — the domain report plus the data-quality story. */
export interface NoonReportParsed {
  readonly report: NoonReportDomain;
  readonly missingFields: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly dataConfidence: number;
  readonly rawFields: Readonly<Record<string, unknown>>;
}

// ── Engine reference / voyage context ───────────────────────────────────────

/** Vessel design characteristics used as reference baselines. */
export interface EngineReference {
  readonly designRpm: number | null;
  readonly designSpeedKnots: number | null;
  readonly propellerPitchMeters: number | null;
  readonly maxContinuousRatingKw: number | null;
}

/** Planned-voyage context for the current sea leg. */
export interface VoyagePlanInput {
  readonly plannedDistanceNm: number | null;
  readonly plannedSpeedKnots: number | null;
  readonly plannedArrival: string | null;
  readonly departurePort: string | null;
  readonly destinationPort: string | null;
}

/** Per-fuel-type consumption attribution (produced by fuel-correlation). */
export interface FuelAttributionInput {
  readonly fuelType: string;
  readonly tonnes: number;
}

// ── Engine input ────────────────────────────────────────────────────────────

export interface NoonReportEngineInput {
  readonly report: NoonReportDomain;
  readonly vessel: { readonly vesselId: string; readonly imo: string; readonly name: string };
  readonly previous: NoonReportDomain | null;
  readonly engineReference?: EngineReference | null;
  readonly voyagePlan?: VoyagePlanInput | null;
  readonly fuelAttribution?: ReadonlyArray<FuelAttributionInput> | null;
  readonly now?: string;
}

// ── Operational state ───────────────────────────────────────────────────────

export type OperationalState = "AT_SEA" | "IN_PORT" | "WAITING" | "UNKNOWN";

// ── Analysis sections ───────────────────────────────────────────────────────

/** Consumption since the previous report, plus the derived daily rate. */
export interface ConsumptionSummary {
  readonly totalTonnes: number | null;
  /** ROB delta vs the previous report (cross-check source). */
  readonly sinceLastReportTonnes: number | null;
  readonly intervalDays: number | null;
  readonly rateTonnesPerDay: number | null;
  /** % change of reported consumption vs the previous report (+/−). */
  readonly trendPct: number | null;
  readonly confidence: number;
}

/** Per-fuel-type split of the reported consumption (may be unresolved). */
export interface FuelConsumptionBreakdown {
  readonly items: ReadonlyArray<{
    readonly fuelType: string;
    readonly tonnes: number;
    readonly sharePct: number | null;
  }>;
  readonly resolved: boolean;
  readonly unresolvedFuelTypes: ReadonlyArray<string>;
}

/** Remaining fuel on board and the implied endurance. */
export interface RemainingOnBoard {
  readonly robTonnes: number | null;
  readonly enduranceDays: number | null;
  readonly confidence: number;
}

export interface EnginePerformance {
  readonly rpm: number | null;
  readonly rpmConfidence: number;
  /** rpm / designRpm × 100. */
  readonly loadPct: number | null;
  /** Within ±2% of design RPM. */
  readonly atDesign: boolean | null;
}

export interface WeatherState {
  readonly seaState: string | null;
  readonly windSpeedKnots: number | null;
  readonly windDirection: string | null;
  /** True when wind ≥ 28 kt (roughly Beaufort 7+). */
  readonly significant: boolean | null;
  readonly confidence: number;
}

export interface VoyageProgress {
  readonly position: { readonly latitude: number | null; readonly longitude: number | null };
  readonly courseDegrees: number | null;
  /** Great-circle distance since the previous report position. */
  readonly distanceMadeGoodNm: number | null;
  /** distanceMadeGood / elapsed hours. */
  readonly speedMadeGoodKnots: number | null;
  readonly confidence: number;
}

export interface DistanceProgress {
  readonly plannedDistanceNm: number | null;
  readonly distanceMadeGoodNm: number | null;
  readonly distanceToGoNm: number | null;
  readonly progressPct: number | null;
  readonly remainingPct: number | null;
}

export interface SlipAnalysis {
  /** Apparent slip = (1 − speedMadeGood / theoreticalSpeed) × 100. */
  readonly slipPct: number | null;
  readonly theoreticalSpeedKnots: number | null;
  readonly actualSpeedKnots: number | null;
  readonly confidence: number;
}

export interface RPMAnalysis {
  readonly rpm: number | null;
  readonly designRpm: number | null;
  readonly deviationFromDesignPct: number | null;
  /** Within ±2% of design RPM. */
  readonly atReference: boolean | null;
}

export interface SpeedAnalysis {
  readonly speedKnots: number | null;
  readonly designSpeedKnots: number | null;
  readonly plannedSpeedKnots: number | null;
  readonly deviationFromDesignPct: number | null;
  readonly deviationFromPlannedPct: number | null;
  /** True when actual speed is >10% below design speed. */
  readonly slowSteaming: boolean | null;
}

export interface WaitingState {
  readonly stationary: boolean;
  readonly speedKnots: number | null;
  readonly distanceToGoNm: number | null;
  readonly note: string | null;
}

export interface PortOperations {
  readonly inPort: boolean;
  readonly destinationPort: string | null;
  readonly note: string | null;
}

export type DeviationKind =
  | "CONSUMPTION"
  | "SPEED"
  | "RPM"
  | "SLIP"
  | "ARRIVAL"
  | "ROB";

export type DeviationSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";

/** A single deterministic deviation from a reference value. */
export interface DeviationAnalysis {
  readonly kind: DeviationKind;
  readonly severity: DeviationSeverity;
  readonly actual: number | null;
  readonly expected: number | null;
  readonly deviationPct: number | null;
  readonly reason: string;
  readonly confidence: number;
}

export interface ConsumptionPrediction {
  readonly arrivalDate: string | null;
  readonly remainingConsumptionTonnes: number | null;
  readonly predictedArrivalRobTonnes: number | null;
  readonly confidence: number;
}

// ── Complete analysis ───────────────────────────────────────────────────────

export interface NoonReportAnalysis {
  readonly engineVersion: string;
  readonly evaluatedAt: string;
  readonly vessel: { readonly vesselId: string; readonly imo: string; readonly name: string };
  readonly operationalState: OperationalState;
  readonly consumption: ConsumptionSummary;
  readonly fuelBreakdown: FuelConsumptionBreakdown;
  readonly remainingOnBoard: RemainingOnBoard;
  readonly engine: EnginePerformance;
  readonly weather: WeatherState;
  readonly voyage: VoyageProgress;
  readonly distance: DistanceProgress;
  readonly slip: SlipAnalysis;
  readonly rpm: RPMAnalysis;
  readonly speed: SpeedAnalysis;
  readonly waiting: WaitingState | null;
  readonly port: PortOperations | null;
  readonly prediction: ConsumptionPrediction;
  readonly deviations: ReadonlyArray<DeviationAnalysis>;
  /** Stable key used to de-duplicate repeated evaluations. */
  readonly dedupKey: string;
}

// ── Findings / validation ───────────────────────────────────────────────────

export type NoonFindingSeverity = "BLOCKING" | "ERROR" | "WARNING" | "INFO";

export type NoonFindingCategory =
  | "data_quality"
  | "structural"
  | "fuel"
  | "engine"
  | "weather"
  | "voyage"
  | "compliance";

export interface NoonFinding {
  readonly id: string;
  readonly severity: NoonFindingSeverity;
  /** Confidence in the finding itself 0..1 (lower = more speculative). */
  readonly confidence: number;
  readonly reason: string;
  readonly remediation: string | null;
  readonly category: NoonFindingCategory;
  readonly ruleId: string | null;
  readonly field: string | null;
}

export interface NoonValidatorResult {
  readonly status: "PASSED" | "WARNING" | "FAILED";
  readonly score: number;
  readonly findings: ReadonlyArray<NoonFinding>;
  readonly blocked: boolean;
  readonly readyForReview: boolean;
}

// ── Correlations ────────────────────────────────────────────────────────────

/** Fuel attribution + delivery/ROB consistency against the report. */
export interface NoonFuelCorrelation {
  readonly attribution: ReadonlyArray<FuelAttributionInput>;
  readonly attributionResolved: boolean;
  readonly deliveredTonnes: number | null;
  readonly consumedTonnes: number | null;
  readonly deliveryDiscrepancyTonnes: number | null;
  readonly deliveryDiscrepancyPct: number | null;
  readonly deliveryState: "CONSISTENT" | "INCONSISTENT" | "INSUFFICIENT_DATA";
  readonly robDeltaTonnes: number | null;
  readonly robExpectedConsumptionTonnes: number | null;
  readonly robDiscrepancyPct: number | null;
  readonly robState: "CONSISTENT" | "INCONSISTENT" | "INSUFFICIENT_DATA";
  readonly findings: ReadonlyArray<NoonFinding>;
}

/** Voyage-plan correlation: actual vs planned progress / speed / ETA. */
export interface NoonVoyageCorrelation {
  readonly distanceMadeGoodNm: number | null;
  readonly plannedDistanceNm: number | null;
  readonly progressPct: number | null;
  readonly speedMadeGoodKnots: number | null;
  readonly plannedSpeedKnots: number | null;
  readonly speedDeviationPct: number | null;
  readonly etaDeviationHours: number | null;
  readonly plannedArrival: string | null;
  readonly predictedArrival: string | null;
  readonly lateHours: number | null;
  readonly state: "ON_SCHEDULE" | "AHEAD" | "BEHIND" | "INSUFFICIENT_DATA";
  readonly findings: ReadonlyArray<NoonFinding>;
}

/** Operational inputs extracted from noon reports for the FuelEU engine. */
export interface NoonFuelEuOperationalInput {
  readonly reportingYear: number;
  readonly reportCount: number;
  readonly daysCovered: number | null;
  readonly energyMeters: ReadonlyArray<{
    readonly fuelType: string;
    readonly tonnes: number;
    readonly energyMj: number | null;
    readonly lhvSource: string | null;
    readonly resolved: boolean;
  }>;
  readonly totalEnergyMj: number | null;
  readonly totalTonnes: number;
  readonly dataAvailable: boolean;
  readonly findings: ReadonlyArray<NoonFinding>;
}

/** Operational inputs extracted from noon reports for the EU-ETS engine. */
export interface NoonEtsOperationalInput {
  readonly reportingYear: number;
  readonly reportCount: number;
  readonly daysCovered: number | null;
  readonly emissions: ReadonlyArray<{
    readonly fuelType: string;
    readonly tonnes: number;
    readonly co2Tonnes: number | null;
    readonly factorSource: string | null;
    readonly resolved: boolean;
  }>;
  readonly totalCo2Tonnes: number | null;
  readonly totalTonnes: number;
  readonly dataAvailable: boolean;
  readonly findings: ReadonlyArray<NoonFinding>;
}

// ── Persistence (supabase noon_reports) ─────────────────────────────────────

export interface NoonReportRow {
  readonly id: string;
  readonly vessel_id: string;
  readonly imo: string;
  readonly vessel_name: string | null;
  readonly report_date: string;
  readonly position_latitude: number | null;
  readonly position_longitude: number | null;
  readonly speed_knots: number | null;
  readonly course_degrees: number | null;
  readonly distance_to_go_nm: number | null;
  readonly fuel_consumption_tonnes: number | null;
  readonly fuel_robs_tonnes: number | null;
  readonly engine_rpm: number | null;
  readonly sea_state: string | null;
  readonly wind_speed_knots: number | null;
  readonly wind_direction: string | null;
  readonly summary: string | null;
  readonly warnings: ReadonlyArray<string>;
  readonly confidence: number;
  readonly source: string;
  readonly source_document_id: string | null;
  readonly review_state: string | null;
  readonly is_blocked: boolean;
  readonly analysis: Record<string, unknown> | null;
  readonly findings: ReadonlyArray<Record<string, unknown>>;
  readonly fuel_correlation: Record<string, unknown> | null;
  readonly voyage_correlation: Record<string, unknown> | null;
  readonly fueleu_operational: Record<string, unknown> | null;
  readonly ets_operational: Record<string, unknown> | null;
  readonly evaluated_at: string | null;
  readonly evaluation_version: string | null;
  readonly dedup_key: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface NoonReportInsert {
  readonly vessel_id: string;
  readonly imo: string;
  readonly vessel_name?: string | null;
  readonly report_date: string;
  readonly position_latitude?: number | null;
  readonly position_longitude?: number | null;
  readonly speed_knots?: number | null;
  readonly course_degrees?: number | null;
  readonly distance_to_go_nm?: number | null;
  readonly fuel_consumption_tonnes?: number | null;
  readonly fuel_robs_tonnes?: number | null;
  readonly engine_rpm?: number | null;
  readonly sea_state?: string | null;
  readonly wind_speed_knots?: number | null;
  readonly wind_direction?: string | null;
  readonly summary?: string | null;
  readonly warnings?: ReadonlyArray<string>;
  readonly confidence?: number;
  readonly source?: string;
  readonly source_document_id?: string | null;
  readonly review_state?: string | null;
  readonly is_blocked?: boolean;
  readonly analysis?: Record<string, unknown> | null;
  readonly findings?: ReadonlyArray<Record<string, unknown>>;
  readonly fuel_correlation?: Record<string, unknown> | null;
  readonly voyage_correlation?: Record<string, unknown> | null;
  readonly fueleu_operational?: Record<string, unknown> | null;
  readonly ets_operational?: Record<string, unknown> | null;
  readonly evaluated_at?: string | null;
  readonly evaluation_version?: string | null;
  readonly dedup_key?: string | null;
}

export interface NoonReportUpdate {
  readonly vessel_name?: string | null;
  readonly report_date?: string;
  readonly position_latitude?: number | null;
  readonly position_longitude?: number | null;
  readonly speed_knots?: number | null;
  readonly course_degrees?: number | null;
  readonly distance_to_go_nm?: number | null;
  readonly fuel_consumption_tonnes?: number | null;
  readonly fuel_robs_tonnes?: number | null;
  readonly engine_rpm?: number | null;
  readonly sea_state?: string | null;
  readonly wind_speed_knots?: number | null;
  readonly wind_direction?: string | null;
  readonly summary?: string | null;
  readonly warnings?: ReadonlyArray<string>;
  readonly confidence?: number;
  readonly source?: string;
  readonly source_document_id?: string | null;
  readonly review_state?: string | null;
  readonly is_blocked?: boolean;
  readonly analysis?: Record<string, unknown> | null;
  readonly findings?: ReadonlyArray<Record<string, unknown>>;
  readonly fuel_correlation?: Record<string, unknown> | null;
  readonly voyage_correlation?: Record<string, unknown> | null;
  readonly fueleu_operational?: Record<string, unknown> | null;
  readonly ets_operational?: Record<string, unknown> | null;
  readonly evaluated_at?: string | null;
  readonly evaluation_version?: string | null;
  readonly dedup_key?: string | null;
}
