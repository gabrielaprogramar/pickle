import type { IngestEvent, IngestStatus } from "./types";

export const INGEST_STATUS_LABELS: Record<IngestStatus, string> = {
  received: "Received",
  processing: "Processing (OCR / AI extraction)",
  extracted: "Extracted",
  needs_review: "Needs review",
  completed: "Completed",
  failed: "Failed",
};

export interface IngestService {
  status(events: ReadonlyArray<IngestEvent>): { events: ReadonlyArray<IngestEvent>; text: string };
  latestBdn(events: ReadonlyArray<IngestEvent>): IngestEvent | null;
}

export function createIngestService(): IngestService {
  function latestBdn(events: ReadonlyArray<IngestEvent>): IngestEvent | null {
    const bdns = events
      .filter((e) => e.documentType === "BDN")
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    return bdns[0] ?? null;
  }

  function status(events: ReadonlyArray<IngestEvent>): {
    events: ReadonlyArray<IngestEvent>;
    text: string;
  } {
    if (events.length === 0) {
      return {
        events,
        text: "No BDN records are on file. Nothing has been received.",
      };
    }

    const lines = events.map((e) => {
      const label = INGEST_STATUS_LABELS[e.status] ?? e.status;
      const received = e.receivedAt.slice(0, 10);
      return `- ${e.fileName} · ${label} · received ${received}`;
    });

    const latest = latestBdn(events);
    let verdict: string;
    if (latest) {
      switch (latest.status) {
        case "completed":
          verdict = `Your BDN ${latest.fileName} is complete and ready for the verification file.`;
          break;
        case "needs_review":
          verdict = `Your BDN ${latest.fileName} has been extracted but needs review.`;
          break;
        case "failed":
          verdict = `Your BDN ${latest.fileName} failed processing. Please re-send it.`;
          break;
        case "received":
          verdict = `Your BDN ${latest.fileName} has been received and is waiting to be processed.`;
          break;
        default:
          verdict = `Your BDN ${latest.fileName} is ${INGEST_STATUS_LABELS[latest.status].toLowerCase()}.`;
      }
    } else {
      verdict = "No BDN has been received.";
    }

    return { events, text: [verdict, ...lines].join("\n") };
  }

  return { status, latestBdn };
}
