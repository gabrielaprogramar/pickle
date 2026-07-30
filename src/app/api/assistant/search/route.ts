import { NextRequest } from "next/server";
import { z } from "zod";
import { createMockKnowledgeBase } from "@/lib/assistant/mock-knowledge";
import { createRegulatorySearchService } from "@/lib/assistant/regulatory-search";
import { apiSuccess, apiError, mapErrorResponse, parseJsonBody } from "@/app/api/_lib/http";
import { zodIssuesToDetails } from "@/app/api/_lib/schemas";

const SearchSchema = z.object({
  question: z.string().min(1, "question is required"),
  regulation: z.string().optional(),
  effective_date: z.string().optional(),
  max_results: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    if (!body) {
      return apiError("VALIDATION_ERROR", "Request body is required", 400);
    }

    const parsed = SearchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid search input", 400, zodIssuesToDetails(parsed.error.issues));
    }

    const mockKnowledgeBase = createMockKnowledgeBase();
    const searchService = createRegulatorySearchService({ mockKnowledgeBase });

    const result = await searchService.search({
      question: parsed.data.question,
      regulation: parsed.data.regulation ?? null,
      effective_date: parsed.data.effective_date ?? null,
      max_results: parsed.data.max_results ?? 10,
    });

    return apiSuccess({ result });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
