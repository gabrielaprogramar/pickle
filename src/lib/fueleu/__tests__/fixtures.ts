import type { FuelDeliveryRow } from "@/lib/supabase/types";

export const VESSEL_ID = "vessel-uuid-001";

export function makeDeliveryRow(
  overrides: Partial<FuelDeliveryRow> = {},
): FuelDeliveryRow {
  return {
    id: overrides.id ?? "fd-eu-001",
    document_id: overrides.document_id ?? "doc-uuid-001",
    vessel_id: overrides.vessel_id ?? VESSEL_ID,
    supplier: overrides.supplier ?? "BunkerSupplier Ltd",
    delivery_port: overrides.delivery_port ?? "Rotterdam",
    delivery_date: overrides.delivery_date ?? "2026-07-10T08:00:00.000Z",
    fuel_type: overrides.fuel_type ?? "vlsfo_rme180",
    quantity_mt: overrides.quantity_mt ?? 250.0,
    density_kgm3: overrides.density_kgm3 ?? null,
    sulphur_content_pct: overrides.sulphur_content_pct ?? null,
    bdn_reference: overrides.bdn_reference ?? null,
    status: overrides.status ?? "verified",
    reconciled_voyage_id: overrides.reconciled_voyage_id ?? null,
    reconciled_at: overrides.reconciled_at ?? null,
    notes: overrides.notes ?? null,
    ocr_result_id: overrides.ocr_result_id ?? null,
    ai_extraction_id: overrides.ai_extraction_id ?? null,
    created_at: overrides.created_at ?? "2026-07-10T08:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-07-10T08:00:00.000Z",
  };
}
