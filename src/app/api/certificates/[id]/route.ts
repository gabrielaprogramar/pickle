import { apiError, apiSuccess } from "@/app/api/_lib/http";
import { INTERNAL_ERROR, NOT_FOUND } from "@/app/api/_lib/errors";
import { buildDefaultCertificateByIdApiDeps } from "./_lib";
import type { CertificateByIdApiDeps } from "./_lib";

/**
 * GET /api/certificates/[id]
 *
 * Returns a single certificate registry record (any version, current or
 * historical) with freshly derived status. 404 when the record is unknown.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
  deps: CertificateByIdApiDeps = buildDefaultCertificateByIdApiDeps(),
): Promise<Response> {
  try {
    const { id } = params;
    const url = new URL(req.url);
    const nowParam = url.searchParams.get("now");
    if (nowParam !== null && (typeof nowParam !== "string" || isNaN(Date.parse(nowParam)))) {
      return apiError(INTERNAL_ERROR, "Query param 'now' must be an ISO timestamp", 400);
    }

    const view = await deps.service.getCertificateById(id, nowParam ?? undefined);
    if (!view) {
      return apiError(NOT_FOUND, `Certificate record not found: ${id}`, 404);
    }

    return apiSuccess({
      id,
      certificate: view,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
