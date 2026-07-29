import { apiFetch, type Page, type PaginationParams } from "./api-client";
import type { VoyageRow } from "@/lib/supabase/types";

export async function getVoyages(
  imo: string,
  params?: PaginationParams,
): Promise<Page<VoyageRow>> {
  const searchParams = new URLSearchParams();
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();
  return apiFetch<Page<VoyageRow>>(`vessels/${imo}/voyages${qs ? `?${qs}` : ""}`);
}

export async function getLatestVoyage(imo: string): Promise<VoyageRow> {
  return apiFetch<VoyageRow>(`vessels/${imo}/voyages/latest`);
}
