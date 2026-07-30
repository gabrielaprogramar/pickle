import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createFuelDeliveryRepository } from "../repositories/fuel_deliveries";
import { RepositoryUpstreamError } from "../errors";
import type { FuelDeliveryRow, FuelTypeRow } from "../types";

const NOW = "2026-07-15T12:00:00.000Z";
const DOC_ID = "doc-uuid-001";
const VESSEL_ID = "vessel-uuid-001";
const OCR_ID = "ocr-uuid-001";

function val<T>(override: T | undefined, fallback: T): T {
  return override === undefined ? fallback : override;
}

function makeDeliveryRow(
  overrides: Partial<FuelDeliveryRow> = {},
): FuelDeliveryRow {
  return {
    id: val(overrides.id, "fd-uuid-001"),
    document_id: val(overrides.document_id, DOC_ID),
    ocr_result_id: val(overrides.ocr_result_id, OCR_ID),
    ai_extraction_id: val(overrides.ai_extraction_id, null),
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

describe("FuelDeliveryRepository — insert", () => {
  it("inserts a fuel delivery and returns the row", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createFuelDeliveryRepository({ client: fake });

    const row = await repo.insert({
      document_id: DOC_ID,
      ocr_result_id: OCR_ID,
      vessel_id: VESSEL_ID,
      supplier: "Test Supplier",
      delivery_port: "Rotterdam",
      delivery_date: "2026-07-10T08:00:00.000Z",
      fuel_type: "vlsfo",
      quantity_mt: 250.0,
      density_kgm3: 920.0,
      sulphur_content_pct: 0.5,
      bdn_reference: "BDN-TEST-001",
    });

    expect(row.document_id).toBe(DOC_ID);
    expect(row.vessel_id).toBe(VESSEL_ID);
    expect(row.supplier).toBe("Test Supplier");
    expect(row.fuel_type).toBe("vlsfo");
    expect(row.quantity_mt).toBe(250.0);
    expect(row.status).toBe("pending");
    expect(row.id).toBeTruthy();
  });

  it("defaults fields when not provided", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createFuelDeliveryRepository({ client: fake });

    const row = await repo.insert({
      document_id: DOC_ID,
      vessel_id: VESSEL_ID,
      supplier: "Test",
      delivery_port: "Port A",
      delivery_date: "2026-07-10T08:00:00.000Z",
      fuel_type: "mgo",
      quantity_mt: 100,
    });

    expect(row.status).toBe("pending");
    expect(row.ocr_result_id).toBeNull();
    expect(row.reconciled_voyage_id).toBeNull();
    expect(row.reconciled_at).toBeNull();
    expect(row.notes).toBeNull();
  });
});

describe("FuelDeliveryRepository — findById", () => {
  it("returns the delivery when it exists", async () => {
    const existing = makeDeliveryRow({ id: "fd-001" });
    const fake = createFakeSupabaseClient({
      tables: { fuel_deliveries: [existing] },
    });
    const repo = createFuelDeliveryRepository({ client: fake });

    const row = await repo.findById("fd-001");
    expect(row).toBeTruthy();
    expect(row!.id).toBe("fd-001");
    expect(row!.supplier).toBe("BunkerSupplier Ltd");
  });

  it("returns null when not found", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createFuelDeliveryRepository({ client: fake });

    const row = await repo.findById("nonexistent-id");
    expect(row).toBeNull();
  });
});

describe("FuelDeliveryRepository — findByDocumentId", () => {
  it("returns deliveries for the given document", async () => {
    const d1 = makeDeliveryRow({ id: "d1", document_id: DOC_ID });
    const d2 = makeDeliveryRow({ id: "d2", document_id: DOC_ID });
    const other = makeDeliveryRow({ id: "d3", document_id: "other-doc" });
    const fake = createFakeSupabaseClient({
      tables: { fuel_deliveries: [d1, d2, other] },
    });
    const repo = createFuelDeliveryRepository({ client: fake });

    const rows = await repo.findByDocumentId(DOC_ID);
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.id).sort()).toEqual(["d1", "d2"]);
  });
});

describe("FuelDeliveryRepository — findByVesselId", () => {
  it("returns deliveries for the given vessel", async () => {
    const d1 = makeDeliveryRow({ id: "d1", vessel_id: VESSEL_ID });
    const d2 = makeDeliveryRow({ id: "d2", vessel_id: VESSEL_ID });
    const other = makeDeliveryRow({ id: "d3", vessel_id: "other-vessel" });
    const fake = createFakeSupabaseClient({
      tables: { fuel_deliveries: [d1, d2, other] },
    });
    const repo = createFuelDeliveryRepository({ client: fake });

    const rows = await repo.findByVesselId(VESSEL_ID);
    expect(rows.length).toBe(2);
  });
});

describe("FuelDeliveryRepository — updateStatus", () => {
  it("updates the status field", async () => {
    const existing = makeDeliveryRow({ id: "fd-001", status: "pending" });
    const fake = createFakeSupabaseClient({
      tables: { fuel_deliveries: [existing] },
    });
    const repo = createFuelDeliveryRepository({ client: fake });

    const updated = await repo.updateStatus("fd-001", "verified");
    expect(updated.status).toBe("verified");
  });
});

describe("FuelDeliveryRepository — reconcile / unreconcile", () => {
  it("reconciles a delivery with a voyage", async () => {
    const existing = makeDeliveryRow({ id: "fd-001", status: "pending" });
    const fake = createFakeSupabaseClient({
      tables: { fuel_deliveries: [existing] },
    });
    const repo = createFuelDeliveryRepository({ client: fake });

    const updated = await repo.reconcile("fd-001", "voy-uuid-001");
    expect(updated.status).toBe("reconciled");
    expect(updated.reconciled_voyage_id).toBe("voy-uuid-001");
    expect(updated.reconciled_at).toBeTruthy();
  });

  it("unreconciles a delivery", async () => {
    const existing = makeDeliveryRow({
      id: "fd-001",
      status: "reconciled",
      reconciled_voyage_id: "voy-uuid-001",
      reconciled_at: NOW,
    });
    const fake = createFakeSupabaseClient({
      tables: { fuel_deliveries: [existing] },
    });
    const repo = createFuelDeliveryRepository({ client: fake });

    const updated = await repo.unreconcile("fd-001");
    expect(updated.status).toBe("verified");
    expect(updated.reconciled_voyage_id).toBeNull();
    expect(updated.reconciled_at).toBeNull();
  });
});

describe("FuelDeliveryRepository — insertLogEntry / getLogEntries", () => {
  it("inserts and retrieves reconciliation log entries", async () => {
    const delivery = makeDeliveryRow({ id: "fd-001" });
    const fake = createFakeSupabaseClient({
      tables: { fuel_deliveries: [delivery] },
    });
    const repo = createFuelDeliveryRepository({ client: fake });

    const logEntry = await repo.insertLogEntry({
      fuel_delivery_id: "fd-001",
      match_type: "auto",
      match_reason: "Port and date match",
      previous_status: "pending",
      new_status: "reconciled",
    });

    expect(logEntry.id).toBeTruthy();
    expect(logEntry.match_type).toBe("auto");
    expect(logEntry.match_reason).toBe("Port and date match");

    const entries = await repo.getLogEntries("fd-001");
    expect(entries.length).toBe(1);
    expect(entries[0]!.match_reason).toBe("Port and date match");
  });
});

describe("FuelDeliveryRepository — findByVoyageId", () => {
  it("returns deliveries reconciled to a specific voyage", async () => {
    const d1 = makeDeliveryRow({ id: "d1", reconciled_voyage_id: "voy-001" });
    const d2 = makeDeliveryRow({ id: "d2", reconciled_voyage_id: "voy-001" });
    const other = makeDeliveryRow({ id: "d3", reconciled_voyage_id: "voy-002" });
    const fake = createFakeSupabaseClient({
      tables: { fuel_deliveries: [d1, d2, other] },
    });
    const repo = createFuelDeliveryRepository({ client: fake });

    const rows = await repo.findByVoyageId("voy-001");
    expect(rows.length).toBe(2);
  });
});

describe("FuelDeliveryRepository — error mapping", () => {
  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: { code: "08006", message: "connection failure" },
    });
    const repo = createFuelDeliveryRepository({ client: fake });

    await expect(async () =>
      repo.insert({
        document_id: DOC_ID,
        vessel_id: VESSEL_ID,
        supplier: "Test",
        delivery_port: "A",
        delivery_date: "2026-01-01",
        fuel_type: "mgo",
        quantity_mt: 100,
      }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
