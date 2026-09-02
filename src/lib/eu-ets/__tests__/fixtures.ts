export const VESSEL_ID = "vessel-uuid-001";

export function makeDeliveryInput(
  overrides: Partial<{
    id: string;
    fuel_type: string;
    quantity_mt: number;
    delivery_date: string;
  }> = {},
) {
  return {
    id: overrides.id ?? "fd-ets-001",
    fuel_type: overrides.fuel_type ?? "hfo_380",
    quantity_mt: overrides.quantity_mt ?? 100,
    delivery_date: overrides.delivery_date ?? "2026-01-15",
  };
}

export function makeVoyageInput(
  overrides: Partial<{
    id: string;
    departure_port: string;
    arrival_port: string;
  }> = {},
) {
  return {
    id: overrides.id ?? "voy-ets-001",
    departure_port: overrides.departure_port ?? "Rotterdam",
    arrival_port: overrides.arrival_port ?? "Hamburg",
  };
}

export function makeConsumptionRow(
  overrides: Partial<{
    id: string;
    vessel_id: string;
    voyage_id: string;
    reporting_year: number;
    fuel_type: string;
    quantity_mt: number;
    method: string;
    confidence: string;
    status: string;
    notes: string | null;
  }> = {},
) {
  return {
    id: overrides.id ?? "cons-ets-001",
    vessel_id: overrides.vessel_id ?? VESSEL_ID,
    voyage_id: overrides.voyage_id ?? "voy-ets-001",
    reporting_year: overrides.reporting_year ?? 2026,
    fuel_type: overrides.fuel_type ?? "hfo_380",
    quantity_mt: overrides.quantity_mt ?? 100,
    method: overrides.method ?? "BDN_TO_VOYAGE",
    confidence: overrides.confidence ?? "MEDIUM",
    status: overrides.status ?? "PENDING",
    source_type: "fuel_deliveries",
    source_record_ids: ["fd-ets-001"],
    attribution_method: "BDN_TO_VOYAGE",
    traceability: {},
    notes: overrides.notes ?? null,
    created_at: "2026-01-16T00:00:00Z",
    updated_at: "2026-01-16T00:00:00Z",
  };
}
