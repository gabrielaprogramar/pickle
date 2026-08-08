/**
 * handoff.test.ts — OCR assistant cross-assistant integration surfaces
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Verifies the fixed vocabulary the OCR Assistant exposes to other
 * assistants:
 *   - captain: a simple readiness count + plain recommendation (never OCR
 *     internals like scores / confidence / suggestions)
 *   - compliance: an explanation of what blocks compliance without ever
 *     asserting a compliance verdict
 *   - search: the retrieval phrases the Search Assistant can serve
 *
 * Also verifies the OCR Assistant routes out-of-scope questions to the
 * captain / compliance / search assistants instead of guessing.
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createOcrService } from "../service";
import { createOcrToolRegistry } from "../ocr-tools";
import { createOcrMockState } from "../mock-data";
import { createOcrSafetyGuard } from "../safety";
import { createOcrMemory } from "../memory";
import {
  captainOcrReadinessSummary,
  complianceOcrExplanation,
  createOcrHandoffDetector,
  searchOcrPhrases,
} from "../handoff";
import type { OcrReadinessItem } from "../handoff";

function makeService() {
  return createOcrService({
    state: createOcrMockState(),
    registry: createOcrToolRegistry(),
    handoffDetector: createOcrHandoffDetector(),
    safetyGuard: createOcrSafetyGuard(),
    memory: createOcrMemory(),
    context: {},
  });
}

function readiness(docId: string, level: string, needsReview: boolean, title = docId): OcrReadinessItem {
  return { documentId: docId, title, level: level as OcrReadinessItem["level"], needsReview };
}

describe("searchOcrPhrases — vocabulary for the Search Assistant", () => {
  it("exposes the four OCR retrieval phrases", () => {
    const phrases = [...searchOcrPhrases()];
    expect(phrases.length).toBe(4);
    expect(phrases).toContain("documents needing OCR review");
    expect(phrases).toContain("low quality scans");
    expect(phrases).toContain("documents with unreadable text");
    expect(phrases).toContain("scans with wrong document type");
  });

  it("routes retrieval intent for each phrase to the Search Assistant", () => {
    const service = makeService();
    const queries = [
      "find documents needing OCR review",
      "search for low quality scans",
      "locate documents with unreadable text",
      "which documents have scans with wrong document type",
    ];
    for (const q of queries) {
      const answer = service.answer({ query: q });
      expect(answer.handoff?.target).toBe("search");
    }
  });
});

describe("captainOcrReadinessSummary — captain surface", () => {
  it("reports no pending review when nothing is on file", () => {
    const text = captainOcrReadinessSummary([]);
    expect(text).toContainString("No scanned documents are on file");
  });

  it("reports a clean bill when every scan is readable", () => {
    const docs = [
      readiness("d1", "HIGH", false),
      readiness("d2", "HIGH", false),
      readiness("d3", "LOW", false),
    ];
    const text = captainOcrReadinessSummary(docs);
    expect(text).toContainString("All 3 scanned documents");
    expect(text).toContainString("No OCR review is pending");
  });

  it("counts documents that need review by quality level", () => {
    const docs = [
      readiness("d1", "HIGH", false),
      readiness("d2", "VERY_LOW", true),
      readiness("d3", "HIGH", true),
      readiness("d4", "MEDIUM", false),
    ];
    const text = captainOcrReadinessSummary(docs);
    expect(text).toContainString("2 of 4 scanned documents need OCR review before the next port call");
    expect(text).toContainString("1 very_low");
    expect(text).toContainString("1 high");
  });

  it("never exposes OCR internals to the captain", () => {
    const docs = [
      readiness("d1", "VERY_LOW", true),
      readiness("d2", "HIGH", true),
    ];
    const text = captainOcrReadinessSummary(docs);
    expect(text.includes("score")).toBe(false);
    expect(text.includes("confidence")).toBe(false);
    expect(text.includes("suggestion")).toBe(false);
  });
});

describe("complianceOcrExplanation — compliance surface", () => {
  it("explains what blocks a compliance decision with missing fields", () => {
    const text = complianceOcrExplanation({
      documentId: "ocr-doc-blurred-certificate",
      title: "IAPP Certificate — Aurelia (blurred)",
      level: "MEDIUM",
      priority: "HIGH",
      family: "CERTIFICATE",
      overallQualityScore: 0.777,
      missingMandatoryFields: ["validUntil"],
    });
    expect(text).toContainString("IAPP Certificate — Aurelia (blurred)");
    expect(text).toContainString("OCR quality medium");
    expect(text).toContainString("certificate document");
    expect(text).toContainString("mandatory field(s) could not be read: validUntil");
    expect(text).toContainString("cannot support a compliance decision");
    expect(text).toContainString("review priority high");
    expect(text).toContainString("compliance is not asserted from unreadable evidence");
  });

  it("omits the missing-field sentence when everything was read", () => {
    const text = complianceOcrExplanation({
      documentId: "ocr-doc-perfect-bdn",
      title: "BDN — Aurelia (Singapore, 2026-07-18)",
      level: "HIGH",
      priority: "LOW",
      family: "BDN",
      overallQualityScore: 0.992,
      missingMandatoryFields: [],
    });
    expect(text.includes("could not be read")).toBe(false);
    expect(text).toContainString("bdn document");
  });

  it("never asserts a compliance verdict", () => {
    const text = complianceOcrExplanation({
      documentId: "ocr-doc-perfect-bdn",
      title: "BDN",
      level: "HIGH",
      priority: "LOW",
      family: "BDN",
      overallQualityScore: 0.992,
      missingMandatoryFields: [],
    });
    expect(text).toContainString("compliance is not asserted from unreadable evidence");
    expect(text.toLowerCase().includes("is compliant")).toBe(false);
  });
});

describe("OCR assistant handoff detector", () => {
  it("routes port-operation questions to the Captain Assistant", () => {
    const detector = createOcrHandoffDetector();
    const decision = detector.detect("am I ready for the next port call?");
    expect(decision.handoff).toBe(true);
    expect(decision.target).toBe("captain");
  });

  it("routes regulatory interpretation to the Compliance Assistant", () => {
    const detector = createOcrHandoffDetector();
    const decision = detector.detect("is this BDN compliant with fuelEU?");
    expect(decision.handoff).toBe(true);
    expect(decision.target).toBe("compliance");
  });

  it("routes retrieval requests to the Search Assistant", () => {
    const detector = createOcrHandoffDetector();
    const decision = detector.detect("find the low quality scans");
    expect(decision.handoff).toBe(true);
    expect(decision.target).toBe("search");
  });

  it("keeps OCR-scoped questions in house", () => {
    const detector = createOcrHandoffDetector();
    const decision = detector.detect("what quality is the scan?");
    expect(decision.handoff).toBe(false);
  });
});

run();
