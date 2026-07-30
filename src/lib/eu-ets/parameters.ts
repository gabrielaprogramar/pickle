export const ETS_CURRENT_PARAMETER_VERSION = "2025.1";

// ── ETS coverage phase-in ──────────────────────────────────────────────────

export interface EtsCoverageEntry {
  readonly year: number;
  /** Coverage rate as a decimal fraction (0.40 = 40%). */
  readonly rate: number;
  readonly label: string;
  readonly source: string;
}

export const ETS_COVERAGE_SCHEDULE: ReadonlyArray<EtsCoverageEntry> = [
  { year: 2024, rate: 0.40, label: "2024 phase-in (40%)", source: "EU ETS Directive 2023/959" },
  { year: 2025, rate: 0.70, label: "2025 phase-in (70%)", source: "EU ETS Directive 2023/959" },
  { year: 2026, rate: 1.00, label: "2026+ full (100%)", source: "EU ETS Directive 2023/959" },
];

export function getEtsCoverageRate(year: number): EtsCoverageEntry {
  const sorted = [...ETS_COVERAGE_SCHEDULE].sort((a, b) => a.year - b.year);
  const first = sorted[0];
  if (!first) throw new Error("ETS_COVERAGE_SCHEDULE is empty");
  if (year <= first.year) return first;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const entry = sorted[i];
    if (entry && year >= entry.year) return entry;
  }
  return first;
}

// ── Voyage coverage factors ────────────────────────────────────────────────

export type VoyageCoverageType = "INTRA_EU" | "EU_TO_THIRD" | "THIRD_TO_EU" | "NON_EU";

export function getVoyageCoverageFactor(type: VoyageCoverageType): number {
  switch (type) {
    case "INTRA_EU":      return 1.0;
    case "EU_TO_THIRD":   return 0.5;
    case "THIRD_TO_EU":   return 0.5;
    case "NON_EU":        return 0.0;
  }
}

export function getVoyageCoverageLabel(type: VoyageCoverageType): string {
  switch (type) {
    case "INTRA_EU":      return "Intra-EU (100%)";
    case "EU_TO_THIRD":   return "EU → Third country (50%)";
    case "THIRD_TO_EU":   return "Third country → EU (50%)";
    case "NON_EU":        return "Non-EU (0%)";
  }
}

// ── Deadline parameters ────────────────────────────────────────────────────

export interface DeadlineConfig {
  readonly type: "surrender" | "mrv_reporting";
  readonly label: string;
  /** Month (1-12). */
  readonly month: number;
  /** Day of month (1-31). */
  readonly day: number;
}

export const DEADLINES: ReadonlyArray<DeadlineConfig> = [
  { type: "mrv_reporting", label: "MRV Annual Report", month: 3, day: 31 },
  { type: "surrender",      label: "EUA Surrender",    month: 9, day: 30 },
];

export function getDeadlineForYear(
  type: "surrender" | "mrv_reporting",
  year: number,
): { date: Date; label: string } {
  for (const d of DEADLINES) {
    if (d.type === type) {
      return { date: new Date(year, d.month - 1, d.day), label: d.label };
    }
  }
  throw new Error(`Unknown deadline type: ${type}`);
}
