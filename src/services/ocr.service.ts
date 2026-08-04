import { apiFetch } from "./api-client";
import type {
  OcrQueueItem,
  OcrQueueTotals,
} from "@/app/api/ocr/queue/route";

export interface OcrQueueResponse {
  readonly documents: OcrQueueItem[];
  readonly totals: OcrQueueTotals;
}

export async function getOcrQueue(): Promise<OcrQueueResponse> {
  return apiFetch<OcrQueueResponse>("ocr/queue");
}
