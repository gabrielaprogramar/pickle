import { apiError, apiSuccess } from "@/app/api/_lib/http";
import { INTERNAL_ERROR, VALIDATION_ERROR, VESSEL_NOT_FOUND } from "@/app/api/_lib/errors";
import { buildDefaultCertificateApiDeps, resolveCertificateApiDeps } from "./_lib";
import type { CertificateApiDeps } from "./_lib";
import type { CertificateStatus } from "@/lib/certificates";

const CERTIFICATE_STATUS_KEYS: ReadonlyArray<CertificateStatus> = [
  "VALID",
  "EXPIRING_SOON",
  "EXPIRED",
  "MISSING",
  "PENDING_REVIEW",
  "INVALID",
  "UNKNOWN",
];

function summaryFor(statuses: ReadonlyArray<CertificateStatus>): Record<CertificateStatus, number> {
  const summary = Object.fromEntries(
    CERTIFICATE_STATUS_KEYS.map((k) => [k, 0]),
  ) as Record<CertificateStatus, number>;
  for (const s of statuses) {
    summary[s] += 1;
  }
  return summary;
}

/**
 * GET /api/vessels/[imo]/certificates
 *
 * Returns the current certificate registry for a vessel with freshly derived
 * statuses. Query params:
 *   status = all | expiring | expired   (default all)
 *   mock   = true                        (deterministic Aurelia mock, no DB)
 *   now    = ISO timestamp               (deterministic evaluation point)
 */
export async function GET(
  req: Request,
  { params }: { params: { imo: string } },
  deps: CertificateApiDeps = buildDefaultCertificateApiDeps(),
): Promise<Response> {
  try {
    const { imo } = params;
    const url = new URL(req.url);
    const mock = url.searchParams.get("mock") === "true";
    const effectiveDeps = mock ? resolveCertificateApiDeps(true) : deps;

    const vessel = await effectiveDeps.vesselRepo.findByImo(imo);
    if (!vessel) {
      return apiError(VESSEL_NOT_FOUND, `Vessel not found for IMO ${imo}`, 404);
    }

    const nowParam = url.searchParams.get("now");
    if (nowParam !== null && (typeof nowParam !== "string" || isNaN(Date.parse(nowParam)))) {
      return apiError(VALIDATION_ERROR, "Query param 'now' must be an ISO timestamp", 400);
    }
    const now = nowParam ?? undefined;

    const statusParam = url.searchParams.get("status");
    const all = await effectiveDeps.service.getCertificates(imo, now);
    const summary = summaryFor(all.map((v) => v.status));

    let certificates = all;
    if (statusParam === "expiring") {
      certificates = all.filter((v) => v.status === "EXPIRING_SOON");
    } else if (statusParam === "expired") {
      certificates = all.filter((v) => v.status === "EXPIRED");
    } else if (statusParam !== null && statusParam !== "all") {
      return apiError(
        VALIDATION_ERROR,
        "Query param 'status' must be one of: all, expiring, expired",
        400,
      );
    }

    return apiSuccess({
      vesselId: vessel.id,
      imo,
      mock: effectiveDeps.mock,
      certificates,
      count: certificates.length,
      summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
