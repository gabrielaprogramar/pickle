import type { FuelDeliveryRow, ReconciliationLogRow } from "@/lib/supabase/types";

/** Standard fuel type identifiers used for normalization. */
export const STANDARD_FUEL_TYPES = [
  "hfo_380", "hfo_180", "hfo",
  "rmg_380", "rmk_380",
  "vlsfo", "ulsfo",
  "lsmgo", "mgo", "mdo",
  "lng", "lpg",
  "methanol",
  "biodiesel", "b30",
  "hydrogen", "ammonia",
] as const;

export type StandardFuelType = (typeof STANDARD_FUEL_TYPES)[number];

/** Fuel category classifications. */
export const FUEL_CATEGORIES = [
  "residual", "distillate", "alternative",
  "biofuel", "lng", "lpg",
  "methanol", "hydrogen", "ammonia", "other",
] as const;

export type FuelCategory = (typeof FUEL_CATEGORIES)[number];

/** Delivery lifecycle status. */
export const DELIVERY_STATUSES = [
  "pending", "verified", "reconciled", "disputed", "rejected",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Reconciliation match type. */
export const MATCH_TYPES = [
  "auto", "manual", "override", "break",
] as const;

export type MatchType = (typeof MATCH_TYPES)[number];

/** Simplified fuel delivery for domain use (wraps the DB row). */
export interface FuelDelivery extends FuelDeliveryRow {
  readonly vessel_name?: string;
  readonly document_title?: string;
}

/** Reconciliation event with optional voyage info. */
export interface ReconciliationEvent extends ReconciliationLogRow {
  readonly voyage_departure_port?: string;
  readonly voyage_arrival_port?: string;
}

/** Input for creating a fuel delivery from a BDN extraction. */
export interface BdnToFuelDeliveryInput {
  readonly document_id: string;
  readonly ocr_result_id?: string;
  readonly ai_extraction_id?: string;
  readonly vessel_id: string;
  readonly supplier: string;
  readonly delivery_port: string;
  readonly delivery_date: string;
  readonly fuel_type: string;
  readonly quantity_mt: number;
  readonly density_kgm3?: number | null;
  readonly sulphur_content_pct?: number | null;
  readonly bdn_reference?: string | null;
}

/** A reconciliation match suggestion from the engine. */
export interface ReconciliationSuggestion {
  readonly fuel_delivery_id: string;
  readonly voyage_id: string;
  readonly confidence: number;
  readonly reason: string;
  readonly match_type: MatchType;
}
