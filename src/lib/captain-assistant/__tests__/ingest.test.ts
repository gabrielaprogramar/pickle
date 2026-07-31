import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createIngestService } from "../ingest";
import { createMockCaptainState } from "../mock-data";
import type { IngestStatus } from "../types";

describe("Captain Assistant — BDN ingest confirmation", () => {
  const service = createIngestService();

  it("never claims success without an actual ingestion record", () => {
    const out = service.status([]);
    expect(out.events.length).toBe(0);
    expect(out.text).toContainString("No BDN records");
    expect(out.text.toLowerCase().includes("complete")).toBe(false);
  });

  it("reports a received BDN as received only", () => {
    const state = createMockCaptainState("bdn-received");
    const out = service.status(state.ingest);
    expect(out.events[0]?.status).toBe("received");
    expect(out.text).toContainString("received");
    expect(out.text.toLowerCase().includes("complete")).toBe(false);
  });

  it("reports a BDN in processing as processing", () => {
    const state = createMockCaptainState("bdn-processing");
    const out = service.status(state.ingest);
    expect(out.events[0]?.status).toBe("processing");
    expect(out.text.toLowerCase()).toContainString("processing");
  });

  it("reports a BDN needing review as needs review", () => {
    const state = createMockCaptainState("bdn-review");
    const out = service.status(state.ingest);
    expect(out.events[0]?.status).toBe("needs_review");
    expect(out.text.toLowerCase()).toContainString("needs review");
  });

  it("reports a completed BDN as complete", () => {
    const state = createMockCaptainState("bdn-complete");
    const out = service.status(state.ingest);
    expect(out.events[0]?.status).toBe("completed");
    expect(out.text.toLowerCase()).toContainString("complete");
  });

  it("maps every deterministic status to a label", () => {
    const labels = new Set<string>();
    for (const status of ["received", "processing", "extracted", "needs_review", "completed", "failed"] as IngestStatus[]) {
      labels.add(status);
    }
    expect(labels.size).toBe(6);
  });

  it("latestBdn returns the most recent BDN event", () => {
    const state = createMockCaptainState("bdn-complete");
    const latest = service.latestBdn(state.ingest);
    expect(latest?.documentType).toBe("BDN");
    expect(latest?.fileName).toContainString("bdn");
  });
});

run();
