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
