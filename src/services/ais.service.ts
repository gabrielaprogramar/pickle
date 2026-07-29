import { apiFetch, type Page, type PaginationParams } from "./api-client";
import type { AisPositionRow } from "@/lib/supabase/types";

export async function getAisPositions(
  imo: string,
  params?: PaginationParams,
): Promise<Page<AisPositionRow>> {
  const searchParams = new URLSearchParams();
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();
  return apiFetch<Page<AisPositionRow>>(`vessels/${imo}/ais-positions${qs ? `?${qs}` : ""}`);
}

export async function getLatestAisPosition(
  vesselId: string,
): Promise<AisPositionRow> {
  return apiFetch<AisPositionRow>(`ais-positions/latest?vesselId=${encodeURIComponent(vesselId)}`);
}
