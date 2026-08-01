import { apiCreated, apiError, parseJsonBody } from "@/app/api/_lib/http";
import {
  DOCUMENT_NOT_FOUND,
  INTERNAL_ERROR,
  INVALID_JSON,
  VALIDATION_ERROR,
  VESSEL_NOT_FOUND,
} from "@/app/api/_lib/errors";
import { z } from "zod";
import type { RegisterCertificateInput } from "@/lib/certificates";
import { buildDefaultDocumentCertificateApiDeps, buildMockDocumentCertificateApiDeps } from "./_lib";
import type { DocumentCertificateApiDeps } from "./_lib";

const bodySchema = z.object({
  imo: z.string(),
  documentImo: z.string().nullable().optional(),
  certificateType: z.string().min(1),
  certificateNumber: z.string().nullable().optional(),
  issuingAuthority: z.string().nullable().optional(),
  classSociety: z.string().nullable().optional(),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "issueDate must be YYYY-MM-DD")
    .nullable()
    .optional(),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expiryDate must be YYYY-MM-DD")
    .nullable()
    .optional(),
  source: z.enum(["document_ocr", "manual", "api", "import", "unknown"]),
  confidence: z.number().min(0).max(1).nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * POST /api/documents/[id]/certificate
 *
 * Registers a certificate record derived from a document. Deterministic guards
 * are applied by the service: a document IMO that does not match the target
 * vessel is BLOCKING / REVIEW_REQUIRED, and a missing expiry date is
 * REVIEW_REQUIRED (no expiry date is ever invented).
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
  deps: DocumentCertificateApiDeps = buildDefaultDocumentCertificateApiDeps(),
): Promise<Response> {
  try {
    const { id } = params;

    const raw = await parseJsonBody<unknown>(req);
    if (raw === null) {
      return apiError(INVALID_JSON, "Request body must be valid JSON", 400);
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(VALIDATION_ERROR, `Invalid body: ${parsed.error.message}`, 400);
    }
    const body = parsed.data;

    const url = new URL(req.url);
    const mock = url.searchParams.get("mock") === "true";
    const effectiveDeps = mock ? buildMockDocumentCertificateApiDeps() : deps;

    if (effectiveDeps.documentRepo) {
      const document = await effectiveDeps.documentRepo.findById(id);
      if (!document) {
        return apiError(DOCUMENT_NOT_FOUND, `Document not found: ${id}`, 404);
      }
    }

    const vessel = await effectiveDeps.vesselRepo.findByImo(body.imo);
    if (!vessel) {
      return apiError(VESSEL_NOT_FOUND, `Vessel not found for IMO ${body.imo}`, 404);
    }

    const input: RegisterCertificateInput = {
      documentId: id,
      documentImo: body.documentImo ?? null,
      certificateType: body.certificateType,
      certificateNumber: body.certificateNumber ?? null,
      issuingAuthority: body.issuingAuthority ?? null,
      classSociety: body.classSociety ?? null,
      issueDate: body.issueDate ?? null,
      expiryDate: body.expiryDate ?? null,
      source: body.source,
      confidence: body.confidence ?? null,
      notes: body.notes ?? null,
    };

    const outcome = await effectiveDeps.service.registerFromDocument(body.imo, input);

    return apiCreated({
      documentId: id,
      imo: body.imo,
      certificate: outcome.record,
      wasSuperseded: outcome.wasSuperseded,
      supersededId: outcome.supersededRecord?.id ?? null,
      event: outcome.event,
      dispatchedNotifications: outcome.dispatchedNotifications,
      blocking: outcome.record.blocking,
      reviewRequired: outcome.record.review_required,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
