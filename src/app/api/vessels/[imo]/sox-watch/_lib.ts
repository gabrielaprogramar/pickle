/**
 * sox-watch/_lib.ts — shared wiring for the SOx ECA compliance watch API
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Builds a `SoxComplianceService` from the real Supabase repositories and the
 * shared notification dispatcher. Route handlers accept `SoxApiDeps` so tests
 * can inject fakes; `route.ts` uses `buildDefaultSoxApiDeps()`.
 */

import { SoxComplianceService } from "@/lib/sox-eca";
import type {
  SoxComplianceEvent,
  SoxComplianceEventInsert,
  SoxServiceDeps,
  SoxWatchState,
  SoxWatchStateInsert,
} from "@/lib/sox-eca";
import {
  createNotificationDispatcher,
  createNotificationEmailProvider,
  createPreferenceService,
  formatSoxTemplate,
} from "@/lib/notifications";
import { getSupabaseClient } from "@/lib/supabase";
import {
  createAisPositionsRepository,
} from "@/lib/supabase/repositories/ais_positions";
import {
  createEnvironmentalZoneRepository,
} from "@/lib/supabase/repositories/environmental_zones";
import {
  createFuelDeliveryRepository,
} from "@/lib/supabase/repositories/fuel_deliveries";
import {
  createNotificationPreferenceRepository,
} from "@/lib/supabase/repositories/notification_preferences";
import {
  createNotificationRepository,
} from "@/lib/supabase/repositories/notifications";
import {
  createSoxComplianceRepository,
} from "@/lib/supabase/repositories/sox_compliance";
import type {
  SoxComplianceRepository as SoxRepoRow,
} from "@/lib/supabase/repositories/sox_compliance";
import {
  createVesselRepository,
} from "@/lib/supabase/repositories/vessels";

/**
 * The repository stores loose column types; the domain uses checked unions
 * (DB CHECK constraints enforce the same values). This adapter narrows rows
 * to the domain shapes at the repository boundary.
 */
export function adaptSoxComplianceRepository(
  repo: SoxRepoRow,
): SoxServiceDeps["soxRepo"] {
  return {
    async findLatestEvent(vesselId) {
      const row = await repo.findLatestEvent(vesselId);
      return row ? (row as unknown as SoxComplianceEvent) : null;
    },
    async findEventsByVesselId(vesselId, limit) {
      const rows = await repo.findEventsByVesselId(vesselId, limit);
      return rows as unknown as SoxComplianceEvent[];
    },
    async insertEvent(input: SoxComplianceEventInsert) {
      const row = await repo.insertEvent(input);
      return row as unknown as SoxComplianceEvent;
    },
    async findWatchState(vesselId) {
      const row = await repo.findWatchState(vesselId);
      return row ? (row as unknown as SoxWatchState) : null;
    },
    async upsertWatchState(input: SoxWatchStateInsert) {
      const row = await repo.upsertWatchState(input);
      return row as unknown as SoxWatchState;
    },
  };
}

export interface SoxApiDeps {
  readonly service: SoxComplianceService;
  readonly vesselRepo: SoxServiceDeps["vesselRepo"];
}

export function buildDefaultSoxApiDeps(): SoxApiDeps {
  const client = getSupabaseClient();
  const vesselRepo = createVesselRepository({ client });

  const service = new SoxComplianceService({
    soxRepo: adaptSoxComplianceRepository(
      createSoxComplianceRepository({ client }),
    ),
    vesselRepo,
    zoneRepo: createEnvironmentalZoneRepository({ client }),
    aisRepo: createAisPositionsRepository({ client }),
    fuelRepo: createFuelDeliveryRepository({ client }),
    notify: createNotificationDispatcher({
      notifRepo: createNotificationRepository({ client }),
      emailProvider: createNotificationEmailProvider(),
      prefService: createPreferenceService({
        prefRepo: createNotificationPreferenceRepository({ client }),
      }),
      templateFormatter: { formatSox: formatSoxTemplate },
    }),
  });

  return { service, vesselRepo };
}
