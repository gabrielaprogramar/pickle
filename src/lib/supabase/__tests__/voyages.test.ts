/**
 * voyages.test.ts — unit tests for the VoyageRepository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the voyage repository (including vessel resolution) against the
 * in-memory fake:
 *   1. insertFromDomain — happy path: upserts vessel + inserts voyage
 *   2. insertFromDomain — idempotent on vessel (same IMO, second voyage)
 *   3. findLatestByImo — returns the newest voyage for a vessel
 *   4. findLatestByImo — null when no voyages exist
 *   5. error mapping — upstream errors propagate correctly
 *
 * The voyage repository depends on the vessel repository internally; the test
 * exercises that integration by providing a shared fake client.
 *
 * NOTE
 * findLatestByImo uses `vessels!inner(imo)` join syntax. The fake client
 * treats `.eq("vessels.imo", imo)` as a filter on the voyage row (the fake
 * doesn't implement joins). For this test we seed voyages with an `imo`
 * column override so the filter works. This is acceptable because the fake
 * is a test double, not a database — the real query is tested via
 * integration tests against a real Supabase project.
 *
 * Run via: npx tsx src/lib/supabase/__tests__/voyages.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createVoyageRepository } from "../repositories/voyages";
import {
  RepositoryIntegrityError,
} from "../errors";
import type { VoyageRow, VesselRow } from "../types";
import type { Voyage as DomainVoyage } from "@/lib/marinetraffic/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

const NOW = "2026-06-29T00:00:00.000Z";

function makeVesselRow(overrides: Partial<VesselRow> = {}): VesselRow {
  return {
    id: overrides.id ?? "vessel-uuid-001",
    imo: overrides.imo ?? "9074729",
    name: overrides.name ?? "Aurelia",
    mmsi: overrides.mmsi ?? null,
    ship_id: overrides.ship_id ?? null,
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
  };
}

function makeDomainVoyage(overrides: Partial<DomainVoyage> = {}): DomainVoyage {
  return {
    vessel: overrides.vessel ?? { name: "Aurelia", imo: "9074729" },
    departure: overrides.departure ?? {
      port: { name: "Antibes", id: 37 },
      timestamp: "2026-06-26T07:40:00.000Z",
    },
    arrival: overrides.arrival ?? {
      port: { name: "Palma de Mallorca", id: 10 },
      timestamp: "2026-06-29T08:15:00.000Z",
    },
    distanceNm: overrides.distanceNm ?? 254,
    source: overrides.source ?? { fetchedAt: NOW, mock: true },
  };
}

/**
 * Make a voyage row that also carries `imo` for the fake join filter.
 * The real query joins through the vessels table; the fake client matches
 * `.eq("vessels.imo", imo)` against a column on the voyage row itself.
 */
function makeVoyageRowWithJoin(
  overrides: Partial<VoyageRow & { imo: string }> = {},
): VoyageRow & { imo: string } {
  return {
    id: overrides.id ?? "voyage-uuid-001",
    vessel_id: overrides.vessel_id ?? "vessel-uuid-001",
    source_fetched_at: overrides.source_fetched_at ?? NOW,
    source_is_mock: overrides.source_is_mock ?? true,
    departure_port_name: overrides.departure_port_name ?? "Antibes",
    departure_port_id: overrides.departure_port_id ?? "37",
    departure_time: overrides.departure_time ?? "2026-06-26T07:40:00.000Z",
    arrival_port_name: overrides.arrival_port_name ?? "Palma de Mallorca",
    arrival_port_id: overrides.arrival_port_id ?? "10",
    arrival_time: overrides.arrival_time ?? "2026-06-29T08:15:00.000Z",
    distance_nm: overrides.distance_nm ?? 254,
    created_at: overrides.created_at ?? NOW,
    imo: overrides.imo ?? "9074729",
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("VoyageRepository — insertFromDomain", () => {
  it("upserts the vessel then inserts the voyage row", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createVoyageRepository({ client: fake });

    const voyage = makeDomainVoyage();
    const row = await repo.insertFromDomain(voyage);

    expect(row.vessel_id).toBeTruthy();
    expect(row.departure_port_name).toBe("Antibes");
    expect(row.arrival_port_name).toBe("Palma de Mallorca");
    expect(row.distance_nm).toBe(254);
    expect(row.source_is_mock).toBe(true);
    expect(row.source_fetched_at).toBe(NOW);
  });

  it("is idempotent on the vessel (same IMO, second voyage)", async () => {
    const vessel = makeVesselRow();
    const fake = createFakeSupabaseClient({ tables: { vessels: [vessel] } });
    const repo = createVoyageRepository({ client: fake });

    // Insert two voyages for the same vessel.
    await repo.insertFromDomain(makeDomainVoyage());
    const second = await repo.insertFromDomain(
      makeDomainVoyage({
        arrival: {
          port: { name: "Barcelona", id: 20 },
          timestamp: "2026-07-02T14:00:00.000Z",
        },
      }),
    );

    expect(second.arrival_port_name).toBe("Barcelona");
    // The vessel should still have the same ID (upsert, not duplicate).
    expect(second.vessel_id).toBe("vessel-uuid-001");
  });
});

describe("VoyageRepository — findLatestByImo", () => {
  it("returns the most recent voyage for a vessel by IMO", async () => {
    const old = makeVoyageRowWithJoin({
      id: "voyage-old",
      departure_port_name: "Marseille",
      departure_time: "2026-06-20T10:00:00.000Z",
      imo: "9074729",
    });
    const recent = makeVoyageRowWithJoin({
      id: "voyage-new",
      departure_port_name: "Antibes",
      departure_time: "2026-06-26T07:40:00.000Z",
      imo: "9074729",
    });
    const fake = createFakeSupabaseClient({
      tables: { voyages: [old, recent] },
    });
    const repo = createVoyageRepository({ client: fake });

    const row = await repo.findLatestByImo("9074729");

    expect(row).toBeTruthy();
    // Sorted by departure_time DESC, so the newest comes first.
    expect(row!.departure_port_name).toBe("Antibes");
  });

  it("returns null when no voyages exist for the IMO", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createVoyageRepository({ client: fake });

    const row = await repo.findLatestByImo("9999999");

    expect(row).toBeNull();
  });
});

describe("VoyageRepository — error mapping", () => {
  it("wraps an integrity violation as RepositoryIntegrityError", async () => {
    const vessel = makeVesselRow();
    const fake = createFakeSupabaseClient({
      tables: { vessels: [vessel] },
      globalError: {
        code: "23503",
        message: 'insert or update on table "voyages" violates foreign key constraint',
      },
    });
    const repo = createVoyageRepository({ client: fake });

    // The vessel upsert will also fail due to globalError. We test that the
    // repository maps it correctly.
    await expect(async () =>
      repo.insertFromDomain(makeDomainVoyage()),
    ).toThrow(RepositoryIntegrityError);
  });
});

run();
