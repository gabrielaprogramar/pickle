/**
 * ais_positions.test.ts — unit tests for the AisPositionsRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the AIS positions repository against the in-memory fake:
 *   1. insert — write a single fix, return the row
 *   2. insertBatch — write multiple fixes, return all rows
 *   3. insertBatch — empty array returns empty array
 *   4. findLatestByVesselId — newest fix for a vessel
 *   5. findLatestByVesselId — null when no fixes exist for vessel
 *
 * Run via: npx tsx src/lib/supabase/__tests__/ais_positions.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createAisPositionsRepository } from "../repositories/ais_positions";
import {
  RepositoryUpstreamError,
} from "../errors";
import type { AisPositionRow } from "../types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const NOW = "2026-06-29T00:00:00.000Z";
const VESSEL_ID = "vessel-uuid-001";

function makePositionRow(overrides: Partial<AisPositionRow> & Pick<AisPositionRow, "ts">): AisPositionRow {
  return {
    id: overrides.id ?? "pos-uuid-001",
    vessel_id: overrides.vessel_id ?? VESSEL_ID,
    ts: overrides.ts,
    latitude: overrides.latitude ?? 43.58,
    longitude: overrides.longitude ?? 7.12,
    sog: overrides.sog ?? null,
    cog: overrides.cog ?? null,
    heading: overrides.heading ?? null,
    nav_status: overrides.nav_status ?? null,
    created_at: overrides.created_at ?? NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AisPositionsRepository — insert", () => {
  it("inserts a single fix and returns the row with server defaults", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAisPositionsRepository({ client: fake });

    const input = {
      vessel_id: VESSEL_ID,
      ts: "2026-06-29T12:00:00.000Z",
      latitude: 43.58,
      longitude: 7.12,
      sog: 12.5,
    };

    const row = await repo.insert(input);

    expect(row.vessel_id).toBe(VESSEL_ID);
    expect(row.ts).toBe("2026-06-29T12:00:00.000Z");
    expect(row.latitude).toBe(43.58);
    expect(row.sog).toBe(12.5);
    expect(row.id).toBeTruthy();
  });
});

describe("AisPositionsRepository — insertBatch", () => {
  it("inserts multiple fixes and returns all rows", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAisPositionsRepository({ client: fake });

    const inputs = [
      { vessel_id: VESSEL_ID, ts: "2026-06-29T12:00:00.000Z", latitude: 43.58, longitude: 7.12 },
      { vessel_id: VESSEL_ID, ts: "2026-06-29T12:30:00.000Z", latitude: 43.60, longitude: 7.15 },
    ];

    const rows = await repo.insertBatch(inputs);

    expect(rows.length).toBe(2);
    expect(rows[0]!.ts).toBe("2026-06-29T12:00:00.000Z");
    expect(rows[1]!.ts).toBe("2026-06-29T12:30:00.000Z");
  });

  it("returns an empty array for an empty input", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAisPositionsRepository({ client: fake });

    const rows = await repo.insertBatch([]);

    expect(rows.length).toBe(0);
  });
});

describe("AisPositionsRepository — findLatestByVesselId", () => {
  it("returns the newest position for a vessel", async () => {
    const old = makePositionRow({ ts: "2026-06-29T11:00:00.000Z", id: "pos-old" });
    const recent = makePositionRow({ ts: "2026-06-29T12:00:00.000Z", id: "pos-new" });
    const fake = createFakeSupabaseClient({
      tables: { ais_positions: [old, recent] },
    });
    const repo = createAisPositionsRepository({ client: fake });

    const row = await repo.findLatestByVesselId(VESSEL_ID);

    expect(row).toBeTruthy();
    // The fake sorts by ts DESC, so the newest should come first.
    expect(row!.id).toBe("pos-new");
    expect(row!.ts).toBe("2026-06-29T12:00:00.000Z");
  });

  it("returns null when no fixes exist for the vessel", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAisPositionsRepository({ client: fake });

    const row = await repo.findLatestByVesselId("nonexistent-vessel");

    expect(row).toBeNull();
  });
});

describe("AisPositionsRepository — error mapping", () => {
  it("wraps a transient error as RepositoryUpstreamError", async () => {
    const fake = createFakeSupabaseClient({
      globalError: {
        code: "08006",
        message: "connection failure",
      },
    });
    const repo = createAisPositionsRepository({ client: fake });

    await expect(async () =>
      repo.insert({
        vessel_id: VESSEL_ID,
        ts: "2026-06-29T12:00:00.000Z",
        latitude: 43.58,
        longitude: 7.12,
      }),
    ).toThrow(RepositoryUpstreamError);
  });
});

run();
