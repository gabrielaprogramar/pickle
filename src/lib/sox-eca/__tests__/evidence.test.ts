import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { selectBunkerEvidence, evidenceFromFuelDelivery } from "../evidence";
import type { SoxEvidenceSource } from "../types";

function src(overrides: Partial<SoxEvidenceSource> & { readonly fuel_delivery_id: string }): SoxEvidenceSource {
  return {
    document_id: null,
    ocr_result_id: null,
    ai_extraction_id: null,
    delivery_date: "2026-07-01T10:00:00.000Z",
    delivery_port: "Genoa",
    fuel_type: "vlsfo",
    quantity_mt: 120,
    sulphur_content_pct: 0.1,
    delivery_status: "verified",
    review_state: null,
    ai_confidence: 0.94,
    source: "BDN OCR",
    ...overrides,
  };
}

describe("sox-eca evidence — selection states", () => {
  it("returns NO_EVIDENCE when there are no deliveries", () => {
    const sel = selectBunkerEvidence([]);
    expect(sel.state).toBe("NO_EVIDENCE");
    expect(sel.selected).toBeNull();
    expect(sel.candidateCount).toBe(0);
  });

  it("picks the most recent usable delivery (READY)", () => {
    const older = src({ fuel_delivery_id: "fd-old", delivery_date: "2026-06-01T10:00:00.000Z", sulphur_content_pct: 0.05 });
    const newer = src({ fuel_delivery_id: "fd-new", delivery_date: "2026-07-01T10:00:00.000Z", sulphur_content_pct: 0.09 });
    const sel = selectBunkerEvidence([older, newer]);
    expect(sel.state).toBe("READY");
    expect(sel.selected?.fuel_delivery_id).toBe("fd-new");
    expect(sel.reviewRequired).toBe(false);
  });

  it("returns NO_SULPHUR when deliveries carry no sulphur value", () => {
    const sel = selectBunkerEvidence([
      src({ fuel_delivery_id: "fd-none", sulphur_content_pct: null }),
    ]);
    expect(sel.state).toBe("NO_SULPHUR");
    expect(sel.selected).toBeNull();
  });

  it("marks REVIEW_REQUIRED when the only delivery is rejected", () => {
    const sel = selectBunkerEvidence([
      src({ fuel_delivery_id: "fd-rej", delivery_status: "rejected" }),
    ]);
    expect(sel.state).toBe("REVIEW_REQUIRED");
    expect(sel.reviewRequired).toBe(true);
    expect(sel.selected).toBeNull();
  });

  it("marks REVIEW_REQUIRED when the document is under review", () => {
    const sel = selectBunkerEvidence([
      src({ fuel_delivery_id: "fd-ur", review_state: "under_review", sulphur_content_pct: 0.12 }),
    ]);
    expect(sel.state).toBe("REVIEW_REQUIRED");
    expect(sel.reviewRequired).toBe(true);
    expect(sel.selected?.fuel_delivery_id).toBe("fd-ur");
  });

  it("marks AMBIGUOUS when two deliveries conflict on conforming vs limits", () => {
    const a = src({ fuel_delivery_id: "fd-a", delivery_date: "2026-07-05T10:00:00.000Z", sulphur_content_pct: 0.05 });
    const b = src({ fuel_delivery_id: "fd-b", delivery_date: "2026-07-06T10:00:00.000Z", sulphur_content_pct: 0.15 });
    const sel = selectBunkerEvidence([a, b]);
    expect(sel.state).toBe("REVIEW_REQUIRED");
    expect(sel.ambiguous).toBe(true);
    expect(sel.reviewRequired).toBe(true);
    expect(sel.selected).toBeNull();
  });

  it("does NOT mark ambiguous when multiple deliveries agree", () => {
    const a = src({ fuel_delivery_id: "fd-a", delivery_date: "2026-07-05T10:00:00.000Z", sulphur_content_pct: 0.05 });
    const b = src({ fuel_delivery_id: "fd-b", delivery_date: "2026-07-06T10:00:00.000Z", sulphur_content_pct: 0.08 });
    const sel = selectBunkerEvidence([a, b]);
    expect(sel.ambiguous).toBe(false);
    expect(sel.state).toBe("READY");
    expect(sel.selected?.fuel_delivery_id).toBe("fd-b");
  });
});

describe("sox-eca evidence — mapping from fuel_deliveries", () => {
  it("maps a fuel delivery row to evidence with provenance", () => {
    const evidence = evidenceFromFuelDelivery({
      id: "fd-1",
      document_id: "doc-1",
      ocr_result_id: "ocr-1",
      ai_extraction_id: "ai-1",
      delivery_date: "2026-07-01T10:00:00.000Z",
      delivery_port: "Barcelona",
      fuel_type: "vlsfo",
      quantity_mt: 200,
      sulphur_content_pct: 0.06,
      status: "verified",
    }, { review_state: "approved", ai_confidence: 0.97 });
    expect(evidence.fuel_delivery_id).toBe("fd-1");
    expect(evidence.document_id).toBe("doc-1");
    expect(evidence.ai_confidence).toBe(0.97);
    expect(evidence.review_state).toBe("approved");
    expect(evidence.source).toBe("BDN AI extraction");
  });

  it("labels OCR-only evidence as BDN OCR", () => {
    const evidence = evidenceFromFuelDelivery({
      id: "fd-2",
      document_id: "doc-2",
      ocr_result_id: null,
      ai_extraction_id: null,
      delivery_date: "2026-07-01T10:00:00.000Z",
      delivery_port: "Genoa",
      fuel_type: "mgo",
      quantity_mt: 50,
      sulphur_content_pct: 0.04,
      status: "pending",
    });
    expect(evidence.source).toBe("BDN OCR");
  });
});

run();
