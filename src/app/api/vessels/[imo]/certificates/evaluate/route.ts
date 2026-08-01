import { apiError, apiSuccess, parseJsonBody } from "@/app/api/_lib/http";
import {
  INTERNAL_ERROR,
  INVALID_JSON,
  VALIDATION_ERROR,
  VESSEL_NOT_FOUND,
} from "@/app/api/_lib/errors";
import { z } from "zod";
import { buildDefaultCertificateApiDeps, resolveCertificateApiDeps } from "../_lib";
import type { CertificateApiDeps } from "../_lib";
import type { VesselCertProfile } from "@/lib/certificates";

const profileSchema = z.object({
  imo: z.string(),
  name: z.string(),
  vesselType: z.enum(["commercial", "private", "unknown"]),
  gt: z.number().nullable(),
  lengthM: z.number().nullable(),
  ballastTanks: z.boolean().nullable(),
});

const bodySchema = z.object({
  now: z.string().optional(),
  reconcile: profileSchema.optional(),
});

/**
 * POST /api/vessels/[imo]/certificates/evaluate
 *
 * Re-evaluates every current certificate record (refreshing stored status
 * snapshots and emitting deterministic expiry/review events). When a `reconcile`
 * vessel profile is supplied, requirements reconciliation also materializes
 * MISSING/UNKNOWN placeholder records for known requirements without evidence.
 */
export async function POST(
  req: Request,
  { params }: { params: { imo: string } },
  deps: CertificateApiDeps = buildDefaultCertificateApiDeps(),
): Promise<Response> {
  try {
    const { imo } = params;

    const raw = await parseJsonBody<unknown>(req);
    if (raw === null) {
      return apiError(INVALID_JSON, "Request body must be valid JSON", 400);
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(
        VALIDATION_ERROR,
        `Invalid body: ${parsed.error.message}`,
        400,
      );
    }
    const body = parsed.data;

    const url = new URL(req.url);
    const mock = url.searchParams.get("mock") === "true";
    const effectiveDeps = mock ? resolveCertificateApiDeps(true) : deps;

    const vessel = await effectiveDeps.vesselRepo.findByImo(imo);
    if (!vessel) {
      return apiError(VESSEL_NOT_FOUND, `Vessel not found for IMO ${imo}`, 404);
    }

    let outcome;
    if (body.reconcile) {
      const profile: VesselCertProfile = {
        imo: body.reconcile.imo,
        name: body.reconcile.name,
        vesselType: body.reconcile.vesselType,
        gt: body.reconcile.gt,
        lengthM: body.reconcile.lengthM,
        ballastTanks: body.reconcile.ballastTanks,
      };
      outcome = await effectiveDeps.service.reconcileRequirements(imo, profile, {
        now: body.now,
      });
    } else {
      outcome = await effectiveDeps.service.evaluate(imo, { now: body.now });
    }

    return apiSuccess({
      imo,
      vesselId: vessel.id,
      mock: effectiveDeps.mock,
      certificates: outcome.views,
      emittedEvents: outcome.emittedEvents,
      emittedEventCount: outcome.emittedEvents.length,
      dispatchedNotifications: outcome.dispatchedNotifications,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
