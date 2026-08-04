import { apiFetch } from "./api-client";
import type { AnalyticsSummary } from "@/app/api/analytics/summary/route";

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return apiFetch<AnalyticsSummary>("analytics/summary");
}

export type { AnalyticsSummary };
