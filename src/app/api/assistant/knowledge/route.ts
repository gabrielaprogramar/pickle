import { NextRequest } from "next/server";
import { createMockKnowledgeBase } from "@/lib/assistant/mock-knowledge";
import { apiSuccess } from "@/app/api/_lib/http";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const regulation = searchParams.get("regulation");

  const mockKnowledgeBase = createMockKnowledgeBase();
  const documents = mockKnowledgeBase.documents;
  const chunks = mockKnowledgeBase.chunks;

  let filteredDocs = documents;
  if (regulation) {
    const regLower = regulation.toLowerCase();
    filteredDocs = documents.filter((d) => d.regulation.toLowerCase() === regLower);
  }

  const docIds = new Set(filteredDocs.map((d) => d.id));
  const filteredChunks = chunks.filter((c) => docIds.has(c.document_id));

  return apiSuccess({ documents: filteredDocs, chunks: filteredChunks });
}
