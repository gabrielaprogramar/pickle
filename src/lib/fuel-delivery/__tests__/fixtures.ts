import type { FuelDeliveryRow, VoyageRow, FuelTypeRow } from "@/lib/supabase/types";

export const NOW = "2026-07-15T12:00:00.000Z";

export const VESSEL_ID = "vessel-uuid-001";
export const DOC_ID = "doc-uuid-001";
export const OCR_ID = "ocr-uuid-001";
export const AI_ID = "ai-uuid-001";

function val<T>(override: T | undefined, fallback: T): T {
  return override === undefined ? fallback : override;
}

export function makeDeliveryRow(
  overrides: Partial<FuelDeliveryRow> = {},
): FuelDeliveryRow {
  return {
    id: val(overrides.id, "fd-uuid-001"),
    document_id: val(overrides.document_id, DOC_ID),
    ocr_result_id: val(overrides.ocr_result_id, OCR_ID),
    ai_extraction_id: val(overrides.ai_extraction_id, AI_ID),
    vessel_id: val(overrides.vessel_id, VESSEL_ID),
    supplier: val(overrides.supplier, "BunkerSupplier Ltd"),
    delivery_port: val(overrides.delivery_port, "Rotterdam"),
    delivery_date: val(overrides.delivery_date, "2026-07-10T08:00:00.000Z"),
    fuel_type: val(overrides.fuel_type, "vlsfo"),
    quantity_mt: val(overrides.quantity_mt, 250.000),
    density_kgm3: val(overrides.density_kgm3, 920.0),
    sulphur_content_pct: val(overrides.sulphur_content_pct, 0.50),
    bdn_reference: val(overrides.bdn_reference, "BDN-2026-001"),
    status: val(overrides.status, "pending"),
    reconciled_voyage_id: val(overrides.reconciled_voyage_id, null),
    reconciled_at: val(overrides.reconciled_at, null),
    notes: val(overrides.notes, null),
    created_at: val(overrides.created_at, NOW),
    updated_at: val(overrides.updated_at, NOW),
  };
}

export function makeVoyageRow(
  overrides: Partial<VoyageRow> = {},
): VoyageRow {
  return {
    id: overrides.id ?? "voy-uuid-001",
    vessel_id: overrides.vessel_id ?? VESSEL_ID,
    source_fetched_at: overrides.source_fetched_at ?? NOW,
    source_is_mock: overrides.source_is_mock ?? true,
    departure_port_name: overrides.departure_port_name ?? "Rotterdam",
    departure_port_id: overrides.departure_port_id ?? null,
    departure_time: overrides.departure_time ?? "2026-07-08T06:00:00.000Z",
    arrival_port_name: overrides.arrival_port_name ?? "Hamburg",
    arrival_port_id: overrides.arrival_port_id ?? null,
    arrival_time: overrides.arrival_time ?? "2026-07-11T14:00:00.000Z",
    distance_nm: overrides.distance_nm ?? 350.0,
    created_at: overrides.created_at ?? NOW,
  };
}

export function makeFuelTypeRow(
  overrides: Partial<FuelTypeRow> = {},
): FuelTypeRow {
  return {
    id: overrides.id ?? "vlsfo",
    display_name: overrides.display_name ?? "VLSFO",
    category: overrides.category ?? "residual",
    description: overrides.description ?? "Very Low Sulphur Fuel Oil",
    co2_factor: overrides.co2_factor ?? 3.151,
    sox_factor: overrides.sox_factor ?? 0.005,
    pm_factor: overrides.pm_factor ?? 0.0010,
    density_default: overrides.density_default ?? 920.0,
    is_drop_in: overrides.is_drop_in ?? true,
    created_at: overrides.created_at ?? NOW,
  };
}

export function makeBdnExtractionData(overrides?: Record<string, unknown>) {
  return {
    imoNumber: "9876543",
    vesselName: "Aurelia",
    port: "Rotterdam",
    deliveryDate: "2026-07-10",
    fuelType: "VLSFO",
    quantityTonnes: 250,
    sulphurContentPct: 0.5,
    densityKgM3: 920.0,
    supplier: "BunkerSupplier Ltd",
    bdnReference: "BDN-2026-001",
    ...overrides,
  };
}
