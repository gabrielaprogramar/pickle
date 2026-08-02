/**
 * noon/_lib.ts — shared wiring for the Noon Report Intelligence API
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Builds a `NoonReportService` from the real Supabase repositories and the
 * shared notification dispatcher. Route handlers accept `NoonApiDeps` so tests
 * can inject fakes; `route.ts` uses `buildDefaultNoonApiDeps()`.
 */

import { NoonReportService } from "@/lib/noon-report";
import type {
  NoonReportRepository as NoonServiceRepo,
  NoonServiceDeps,
} from "@/lib/noon-report";
import type { NoonReportRow } from "@/lib/noon-report";
import {
  createNotificationDispatcher,
  createNotificationEmailProvider,
  createPreferenceService,
  formatNoonTemplate,
} from "@/lib/notifications";
import { getSupabaseClient } from "@/lib/supabase";
import {
  createFuelDeliveryRepository,
} from "@/lib/supabase/repositories/fuel_deliveries";
import {
  createNoonReportRepository,
} from "@/lib/supabase/repositories/noon_reports";
import type {
  NoonReportRepository as NoonRepoRow,
} from "@/lib/supabase/repositories/noon_reports";
import {
  createNotificationPreferenceRepository,
} from "@/lib/supabase/repositories/notification_preferences";
import {
  createNotificationRepository,
} from "@/lib/supabase/repositories/notifications";
import {
  createVesselRepository,
} from "@/lib/supabase/repositories/vessels";

/**
 * The repository interface matches the service interface exactly, so the
 * adapter is identity — it exists to keep the route/`_lib` pattern uniform
 * and to give tests a single seam to replace.
 */
export function adaptNoonReportRepository(
  repo: NoonRepoRow,
): NoonServiceRepo {
  return repo as NoonServiceRepo;
}

export interface NoonApiDeps {
  readonly service: NoonReportService;
  readonly vesselRepo: NoonServiceDeps["vesselRepo"];
  readonly noonRepo: NoonServiceRepo;
}

export function buildDefaultNoonApiDeps(): NoonApiDeps {
  const client = getSupabaseClient();
  const vesselRepo = createVesselRepository({ client });
  const noonRepo = adaptNoonReportRepository(
    createNoonReportRepository({ client }),
  );

  const service = new NoonReportService({
    noonRepo,
    vesselRepo,
    fuelRepo: createFuelDeliveryRepository({ client }),
    notify: createNotificationDispatcher({
      notifRepo: createNotificationRepository({ client }),
      emailProvider: createNotificationEmailProvider(),
      prefService: createPreferenceService({
        prefRepo: createNotificationPreferenceRepository({ client }),
      }),
      templateFormatter: { formatNoon: formatNoonTemplate },
    }),
  });

  return { service, vesselRepo, noonRepo };
}

/** Convenience used by tests: latest noon report for a vessel, or null. */
export async function latestNoonRowOrNull(
  deps: NoonApiDeps,
  imo: string,
): Promise<NoonReportRow | null> {
  const vessel = await deps.vesselRepo.findByImo(imo);
  if (!vessel) return null;
  return deps.noonRepo.findLatestByVesselId(vessel.id);
}
