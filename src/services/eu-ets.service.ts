import { apiFetch } from "./api-client";
import type { EtsSummary } from "@/app/api/eu-ets/summary/route";

export async function getEtsSummary(): Promise<EtsSummary> {
  return apiFetch<EtsSummary>("eu-ets/summary");
}

export type { EtsSummary };
