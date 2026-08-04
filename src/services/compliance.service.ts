import { apiFetch } from "./api-client";
import type { VerifierPackageRow } from "@/lib/supabase/types";

export interface SoxWatchVessel {
  readonly vesselId: string;
  readonly imo: string | null;
  readonly name: string | null;
  readonly status: string;
  readonly severity: string;
  readonly insideEca: boolean | null;
  readonly ecaEffective: boolean | null;
  readonly zoneState: string | null;
  readonly evidenceStatus: string | null;
  readonly applicableLimitPct: number | null;
  readonly sulphurContentPct: number | null;
  readonly selectedDeliveryId: string | null;
  readonly lastEvaluatedAt: string | null;
  readonly latestEvent: {
    readonly id: string;
    readonly eventType: string;
    readonly eventTs: string;
    readonly severity: string;
    readonly watchStatus: string;
    readonly evidenceStatus: string;
    readonly ruleId: string;
  } | null;
}

export interface ComplianceReportSummary {
  readonly id: string;
  readonly report_type: string;
  readonly title: string;
  readonly reporting_year: number;
  readonly status: string;
  readonly generated_at: string | null;
}

export async function getVerifierPackages(): Promise<{ packages: VerifierPackageRow[] }> {
  return apiFetch<{ packages: VerifierPackageRow[] }>("verifier-packages");
}

export async function getSoxWatch(): Promise<{ watch: SoxWatchVessel[] }> {
  return apiFetch<{ watch: SoxWatchVessel[] }>("sox-watch");
}

export async function getComplianceReports(): Promise<{ reports: ComplianceReportSummary[] }> {
  return apiFetch<{ reports: ComplianceReportSummary[] }>("reports");
}
