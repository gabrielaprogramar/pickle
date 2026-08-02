import { apiFetch } from "./api-client";
import type { NoonReportRow } from "@/lib/supabase/types";
import type {
  NoonFinding,
  NoonFuelCorrelation,
  NoonFuelEuOperationalInput,
  NoonEtsOperationalInput,
  NoonReportAnalysis,
  NoonReportDomain,
  NoonReportExtractionInput,
  NoonValidatorResult,
  NoonVoyageCorrelation,
} from "@/lib/noon-report";

export interface NoonLatestResponse {
  readonly vesselId: string;
  readonly imo: string;
  readonly latest: NoonReportRow | null;
}

export interface NoonHistoryResponse {
  readonly vesselId: string;
  readonly imo: string;
  readonly history: readonly NoonReportRow[];
  readonly count: number;
}

export interface NoonCreateResponse {
  readonly vesselId: string;
  readonly imo: string;
  readonly report: NoonReportRow;
  readonly missingFields: readonly string[];
  readonly warnings: readonly string[];
  readonly dataConfidence: number;
}

export interface NoonEvaluateResponse {
  readonly imo: string;
  readonly vesselId: string;
  readonly wasDuplicated: boolean;
  readonly dispatchedNotifications: number;
  readonly report: NoonReportRow;
  readonly domain: NoonReportDomain;
  readonly analysis: NoonReportAnalysis;
  readonly validator: NoonValidatorResult;
  readonly fuel: NoonFuelCorrelation;
  readonly voyage: NoonVoyageCorrelation;
  readonly fueleu: NoonFuelEuOperationalInput;
  readonly ets: NoonEtsOperationalInput;
  readonly findings: readonly NoonFinding[];
}

export async function getNoonLatest(imo: string): Promise<NoonLatestResponse> {
  return apiFetch<NoonLatestResponse>(`vessels/${imo}/noon/latest`);
}

export async function getNoonHistory(
  imo: string,
  limit = 20,
): Promise<NoonHistoryResponse> {
  return apiFetch<NoonHistoryResponse>(`vessels/${imo}/noon/history?limit=${limit}`);
}

export async function createNoonReport(
  imo: string,
  report: NoonReportExtractionInput,
  notifyReportReceived = false,
): Promise<NoonCreateResponse> {
  return apiFetch<NoonCreateResponse>(`vessels/${imo}/noon`, {
    method: "POST",
    body: JSON.stringify({ report, notifyReportReceived }),
  });
}

export async function evaluateNoonReport(
  imo: string,
  opts: { readonly reportId?: string; readonly now?: string; readonly persist?: boolean } = {},
): Promise<NoonEvaluateResponse> {
  return apiFetch<NoonEvaluateResponse>(`vessels/${imo}/noon/evaluate`, {
    method: "POST",
    body: JSON.stringify(opts),
  });
}
