import { apiFetch, type Page, type PaginationParams } from "./api-client";
import type { VesselRow } from "@/lib/supabase/types";

export async function getVessels(
  params?: PaginationParams,
): Promise<Page<VesselRow>> {
  const searchParams = new URLSearchParams();
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();
  return apiFetch<Page<VesselRow>>(`vessels${qs ? `?${qs}` : ""}`);
}

export async function getVesselByImo(imo: string): Promise<VesselRow> {
  return apiFetch<VesselRow>(`vessels/${imo}`);
}
