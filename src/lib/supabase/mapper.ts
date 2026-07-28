/**
 * mapper.ts — translate between domain types and database row payloads
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Phase 1A produced a clean domain `Voyage` (from the MarineTraffic module).
 * Phase 1B stores it. The DB shape (VoyageInsert / VesselInsert) is DIFFERENT
 * from the domain shape — the DB needs a `vessel_id` foreign key and flattened
 * port fields, while the domain nests `departure.port.name`, etc.
 *
 * Centralizing that translation here means:
 *   - Repositories stay thin: they receive ready-to-insert payloads.
 *   - If the DB schema changes, only this file (and types.ts) change — never
 *     the repositories or the orchestration layer.
 *   - The mapping is unit-testable in isolation without a database.
 *
 * HOW IT FITS
 * The voyage repository's `insertVoyage()` calls `toVesselInsert()` and
 * `toVoyageInsert()` to build payloads. It does no field mapping itself.
 */

import type { Voyage } from "@/lib/marinetraffic/types";
import type { VesselInsert, VoyageInsert } from "./types";

/**
 * Build a vessel insert payload from a domain Voyage.
 *
 * IMO + name are always present on a Voyage (Phase 1A parse guarantees them).
 * MMSI / ship_id are NOT on the current Voyage domain model — they come from
 * the MarineTraffic raw response. Phase 1B stores what the domain carries; a
 * future phase can enrich the Voyage type to carry MMSI if needed.
 */
export function toVesselInsert(voyage: Voyage): VesselInsert {
  return {
    imo: voyage.vessel.imo,
    name: voyage.vessel.name,
  };
}

/**
 * Build a voyage insert payload from a domain Voyage + the resolved vessel FK id.
 *
 * The vessel_id is NOT on the Voyage domain type — it's a DB concern, produced
 * by first upserting/looking up the vessel. That's why it's a separate param.
 *
 * Port fields are flattened: domain `voyage.departure.port.name` → DB
 * `departure_port_name`. Port IDs come along when the domain has them
 * (Phase 1A `Port.id` is `number | null`; the DB stores it as text).
 */
export function toVoyageInsert(voyage: Voyage, vesselId: string): VoyageInsert {
  return {
    vessel_id: vesselId,
    source_fetched_at: voyage.source.fetchedAt,
    source_is_mock: voyage.source.mock,
    departure_port_name: voyage.departure.port.name,
    departure_port_id:
      voyage.departure.port.id !== null ? String(voyage.departure.port.id) : null,
    departure_time: voyage.departure.timestamp,
    arrival_port_name: voyage.arrival.port.name,
    arrival_port_id:
      voyage.arrival.port.id !== null ? String(voyage.arrival.port.id) : null,
    arrival_time: voyage.arrival.timestamp,
    distance_nm: voyage.distanceNm,
  };
}
