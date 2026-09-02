/**
 * vessels.test.ts — unit tests for the VesselRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the vessel repository against the in-memory fake Supabase client:
 *   1. upsertByImo — insert a new vessel, return the row with server defaults
 *   2. upsertByImo — update an existing vessel (same IMO, new name)
 *   3. findByImo — return a vessel when it exists
 *   4. findByImo — return null when no vessel matches
 *   5. upsertByImo — surface PostgREST integrity error as RepositoryIntegrityError
 *   6. upsertByImo — surface transient error as RepositoryUpstreamError
 *
 * Run via: npx tsx src/lib/supabase/__tests__/vessels.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createVesselRepository } from "../repositories/vessels";
import {
  RepositoryIntegrityError,
  RepositoryUpstreamError,
} from "../errors";
import type { VesselRow } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const NOW = "2026-06-29T00:00:00.000Z";

function makeRow(overrides: Partial<VesselRow> & Pick<VesselRow, "imo">): VesselRow {
  return {
    id: "test-uuid-001",
    imo: overrides.imo,
    name: overrides.name ?? "TestVessel",
    mmsi: overrides.mmsi ?? null,
    ship_id: overrides.ship_id ?? null,
    gross_tonnage: overrides.gross_tonnage ?? null,
    flag: overrides.flag ?? null,
    vessel_type: overrides.vessel_type ?? null,
    vessel_category: overrides.vessel_category ?? null,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("VesselRepository — upsertByImo (insert)", () => {
  it("inserts a new vessel and returns the row with server defaults", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createVesselRepository({ client: fake });

    const row = await repo.upsertByImo({ imo: "9074729", name: "Aurelia" });

    expect(row.imo).toBe("9074729");
    expect(row.name).toBe("Aurelia");
    expect(row.id).toBeTruthy(); // server-generated UUID
    expect(row.mmsi).toBeNull();
  });
});

describe("VesselRepository — upsertByImo (update)", () => {
  it("updates an existing vessel when the same IMO is upserted", async () => {
    const existing = makeRow({ imo: "9074729", name: "Aurelia" });
    const fake = createFakeSupabaseClient({
      tables: { vessels: [existing] },
    });
    const repo = createVesselRepository({ client: fake });

    const row = await repo.upsertByImo({ imo: "9074729", name: "Aurelia II" });

    expect(row.imo).toBe("9074729");
    expect(row.name).toBe("Aurelia II");
    // ID should be preserved from the existing row (ON CONFLICT DO UPDATE).
    expect(row.id).toBe("test-uuid-001");
  });
});

describe("VesselRepository — findByImo", () => {
  it("returns the vessel row when a matching IMO exists", async () => {
    const existing = makeRow({ imo: "9074729", name: "Aurelia" });
    const fake = createFakeSupabaseClient({
      tables: { vessels: [existing] },
    });
    const repo = createVesselRepository({ client: fake });

    const row = await repo.findByImo("9074729");

    expect(row).toBeTruthy();
    expect(row!.name).toBe("Aurelia");
    expect(row!.imo).toBe("9074729");
  });

  it("returns null when no vessel matches the IMO", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createVesselRepository({ client: fake });

    const row = await repo.findByImo("9999999");

    expect(row).toBeNull();
  });
});

describe("VesselRepository — error mapping", () => {
  it("wraps an integrity violation as RepositoryIntegrityError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "vessels_imo_uniq"',
      },
    });
    const repo = createVesselRepository({ client: fake });

    await expect(async () =>
      repo.upsertByImo({ imo: "9074729", name: "Aurelia" }),
    ).toThrow(RepositoryIntegrityError);
  });

  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: {
        code: "08006",
        message: "connection failure",
      },
    });
    const repo = createVesselRepository({ client: fake });

    await expect(async () =>
      repo.upsertByImo({ imo: "9074729", name: "Aurelia" }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
