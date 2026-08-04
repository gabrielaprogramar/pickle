import { apiFetch } from "./api-client";
import type { DashboardSummary } from "@/app/api/dashboard/summary/route";

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>("dashboard/summary");
}

export type { DashboardSummary };
