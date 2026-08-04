import { apiSuccess, apiError } from "@/app/api/_lib/http";
import { INTERNAL_ERROR } from "@/app/api/_lib/errors";
import { getSupabaseClient } from "@/lib/supabase";
import { OCR_MOCK_DOCUMENTS } from "@/lib/ocr-assistant/mock-data";
import { buildMockOcrApiDeps } from "../_lib";

export interface OcrQueueItem {
  readonly id: string;
  readonly title: string;
  readonly family: string;
  readonly declaredType: string;
  readonly status: string;
  readonly vesselId: string | null;
  readonly vesselName: string | null;
  readonly ocrConfidence: number;
  readonly level: string | null;
  readonly overallQualityScore: number | null;
  readonly priority: string | null;
  readonly priorityReasons: ReadonlyArray<string>;
  readonly issues: ReadonlyArray<{
    readonly type: string;
    readonly detected: boolean;
    readonly severity?: string;
    readonly evidence?: string;
  }>;
  readonly missingMandatoryFields: ReadonlyArray<string>;
  readonly reviewTask: {
    readonly id: string;
    readonly status: string;
    readonly priority: string;
    readonly assignedTo: string | null;
  } | null;
}

export interface OcrQueueTotals {
  readonly total: number;
  readonly byLevel: Record<string, number>;
  readonly needsReview: number;
}

export async function GET(): Promise<Response> {
  try {
    const client = getSupabaseClient();
    const deps = buildMockOcrApiDeps();

    const { data: docs, error: docsError } = await client.from("documents").select("*");
    if (docsError) throw docsError;
    const docById = new Map((docs ?? []).map((d) => [d.id as string, d]));

    const { data: vessels, error: vesselsError } = await client.from("vessels").select("*");
    if (vesselsError) throw vesselsError;
    const vesselNameById = new Map((vessels ?? []).map((v) => [v.id as string, v.name as string]));

    const { data: tasks, error: tasksError } = await client.from("review_tasks").select("*");
    if (tasksError) throw tasksError;
    const taskByDocument = new Map<string, Record<string, unknown>>();
    for (const t of tasks ?? []) {
      const docId = t.document_id as string;
      if (docId && !taskByDocument.has(docId)) taskByDocument.set(docId, t);
    }

    const byLevel: Record<string, number> = {};
    let needsReview = 0;

    const items: OcrQueueItem[] = OCR_MOCK_DOCUMENTS.map((mock) => {
      const answer = deps.service.quality({
        query: "",
        context: { documentId: mock.id },
      });
      const level = answer.quality?.level ?? null;
      const priority = answer.priority?.priority ?? null;
      const seed = docById.get(mock.id);

      byLevel[level ?? "UNKNOWN"] = (byLevel[level ?? "UNKNOWN"] ?? 0) + 1;
      if (priority && priority !== "LOW") needsReview += 1;

      const task = taskByDocument.get(mock.id);
      return {
        id: mock.id,
        title: mock.title,
        family: mock.family,
        declaredType: mock.declaredType,
        status: (seed?.status as string) ?? "queued",
        vesselId: (seed?.vessel_id as string) ?? null,
        vesselName: seed?.vessel_id ? (vesselNameById.get(seed.vessel_id as string) ?? null) : null,
        ocrConfidence: mock.ocrConfidence,
        level,
        overallQualityScore: answer.quality?.overallQualityScore ?? null,
        priority,
        priorityReasons: answer.priority?.reasons ?? [],
        issues: answer.quality?.issues ?? [],
        missingMandatoryFields: answer.quality?.missingMandatoryFields ?? [],
        reviewTask: task
          ? {
              id: task.id as string,
              status: task.status as string,
              priority: task.priority as string,
              assignedTo: (task.assigned_to as string | null) ?? null,
            }
          : null,
      };
    });

    return apiSuccess({
      documents: items,
      totals: { total: items.length, byLevel, needsReview },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(INTERNAL_ERROR, message, 500);
  }
}
