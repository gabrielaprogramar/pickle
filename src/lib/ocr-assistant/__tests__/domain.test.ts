import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { classifyDocument } from "../classification";
import { computeQualityScore } from "../quality";
import {
  generateRepairSuggestions,
  imoCheckDigit,
  imoChecksumValid,
} from "../suggestions";
import { evaluateReviewPriority } from "../priority";
import { OCR_MOCK_DOCUMENTS, toOcrDocumentInput } from "../mock-data";
import { lookupDictionary, lookupFuelFuzzy, lookupPortFuzzy } from "../dictionary";
import type { OcrDocumentFamily } from "../types";

describe("OCR Assistant — dictionary", () => {
  it("resolves common OCR fuel typos to canonical grades", () => {
    expect(lookupFuelFuzzy("VLSF0")?.canonical).toBe("VLSFO");
    expect(lookupFuelFuzzy("MGOO")?.canonical).toBe("MGO");
    expect(lookupFuelFuzzy("vlsfo")?.canonical).toBe("VLSFO");
    expect(lookupFuelFuzzy("IF0380")?.canonical).toBe("IFO380");
  });

  it("does not guess a fuel when the match is ambiguous", () => {
    expect(lookupFuelFuzzy("MCO")).toBeNull();
  });

  it("resolves port spelling with a bounded fuzzy match", () => {
    expect(lookupPortFuzzy("Rotterdan")?.canonical).toBe("Rotterdam");
  });

  it("looks up terminology, certificates, regulations and class societies", () => {
    expect(lookupDictionary("BDN").length).toBeGreaterThan(0);
    expect(lookupDictionary("MARPOL").some((e) => e.kind === "regulation")).toBe(true);
    expect(lookupDictionary("IAPP", "certificate").some((e) => e.canonical === "IAPP")).toBe(true);
    expect(lookupDictionary("DNV", "class_society").some((e) => e.canonical === "DNV")).toBe(true);
  });
});

describe("OCR Assistant — IMO checksum", () => {
  it("computes the A.1078(28) check digit", () => {
    expect(imoCheckDigit("932148")).toBe(3);
    expect(imoChecksumValid("9321483")).toBe(true);
    expect(imoChecksumValid("9321481")).toBe(false);
  });
});

describe("OCR Assistant — classification over mock fixtures", () => {
  it("classifies every fixture from content only", () => {
    const expected: Record<string, OcrDocumentFamily> = {
      "ocr-doc-perfect-bdn": "BDN",
      "ocr-doc-rotated-bdn": "BDN",
      "ocr-doc-blurred-certificate": "CERTIFICATE",
      "ocr-doc-unreadable-noon-report": "NOON_REPORT",
      "ocr-doc-mixed-language": "BDN",
      "ocr-doc-duplicate-scan": "BDN",
      "ocr-doc-damaged-scan": "EU_ETS",
      "ocr-doc-cropped-statement": "STATEMENT",
      "ocr-doc-wrong-type": "BDN",
    };
    for (const doc of OCR_MOCK_DOCUMENTS) {
      const c = classifyDocument(toOcrDocumentInput(doc));
      expect(c.family).toBe(expected[doc.id]!);
    }
  });

  it("returns UNKNOWN rather than guessing on unrelated text", () => {
    const c = classifyDocument({
      documentId: "x",
      documentType: "OTHER",
      rawText: "meeting minutes for the weekly sync about cafeteria catering.",
      extractedData: {},
      ocrConfidence: 0.5,
    });
    expect(c.family).toBe("UNKNOWN");
  });
});

describe("OCR Assistant — quality scoring over mock fixtures", () => {
  it("produces the expected quality level for each fixture", () => {
    for (const doc of OCR_MOCK_DOCUMENTS) {
      const input = toOcrDocumentInput(doc);
      const classification = classifyDocument(input);
      const score = computeQualityScore(input, classification);
      expect(score.level).toBe(doc.expectedLevel);
    }
  });

  it("monotonic: a perfectly clean BDN scores HIGH", () => {
    const doc = OCR_MOCK_DOCUMENTS[0]!;
    const score = computeQualityScore(toOcrDocumentInput(doc), classifyDocument(toOcrDocumentInput(doc)));
    expect(score.overallQualityScore).toBeGreaterThan(0.799);
    expect(score.missingMandatoryFields).toEqual([]);
  });

  it("flags the injected issues on each defective fixture", () => {
    const expectIssue = (id: string, type: string) => {
      const doc = OCR_MOCK_DOCUMENTS.find((d) => d.id === id)!;
      const input = toOcrDocumentInput(doc);
      const score = computeQualityScore(input, classifyDocument(input));
      expect(score.issues.some((i) => i.type === type && i.detected)).toBe(true);
    };
    expectIssue("ocr-doc-rotated-bdn", "rotated_page");
    expectIssue("ocr-doc-blurred-certificate", "blur");
    expectIssue("ocr-doc-unreadable-noon-report", "damaged_document");
    expectIssue("ocr-doc-unreadable-noon-report", "poor_scan");
    expectIssue("ocr-doc-mixed-language", "mixed_language");
    expectIssue("ocr-doc-duplicate-scan", "duplicate_pages");
    expectIssue("ocr-doc-damaged-scan", "damaged_document");
    expectIssue("ocr-doc-cropped-statement", "cropped");

    const blurred = OCR_MOCK_DOCUMENTS.find((d) => d.id === "ocr-doc-blurred-certificate")!;
    const blurredInput = toOcrDocumentInput(blurred);
    const blurredScore = computeQualityScore(blurredInput, classifyDocument(blurredInput));
    expect([...blurredScore.missingMandatoryFields]).toContain("validUntil");
  });
});

describe("OCR Assistant — repair suggestions over mock fixtures", () => {
  it("suggests an IMO checksum correction on the rotated BDN", () => {
    const doc = OCR_MOCK_DOCUMENTS.find((d) => d.id === "ocr-doc-rotated-bdn")!;
    const s = generateRepairSuggestions(toOcrDocumentInput(doc));
    const imo = s.find((x) => x.kind === "IMO_CHECKSUM");
    expect(imo?.original).toBe("9321481");
    expect(imo?.suggested).toBe("9321483");
  });

  it("suggests an ISO date on the rotated BDN", () => {
    const doc = OCR_MOCK_DOCUMENTS.find((d) => d.id === "ocr-doc-rotated-bdn")!;
    const s = generateRepairSuggestions(toOcrDocumentInput(doc));
    const date = s.find((x) => x.kind === "DATE_FORMAT");
    expect(date?.original).toBe("14/05/2024");
    expect(date?.suggested).toBe("2024-05-14");
  });

  it("suggests the canonical fuel grade on the rotated BDN", () => {
    const doc = OCR_MOCK_DOCUMENTS.find((d) => d.id === "ocr-doc-rotated-bdn")!;
    const s = generateRepairSuggestions(toOcrDocumentInput(doc));
    const fuel = s.find((x) => x.kind === "FUEL_SPELLING");
    expect(fuel?.original).toBe("VLSF0");
    expect(fuel?.suggested).toBe("VLSFO");
  });

  it("suggests certificate number spacing on the blurred certificate", () => {
    const doc = OCR_MOCK_DOCUMENTS.find((d) => d.id === "ocr-doc-blurred-certificate")!;
    const s = generateRepairSuggestions(toOcrDocumentInput(doc));
    const cert = s.find((x) => x.kind === "CERTIFICATE_NUMBER_SPACING");
    expect(cert?.original).toBe("IAPP 2024 0581");
    expect(cert?.suggested).toBe("IAPP-20240581");
  });

  it("produces no suggestions for a clean scan", () => {
    const doc = OCR_MOCK_DOCUMENTS.find((d) => d.id === "ocr-doc-perfect-bdn")!;
    const s = generateRepairSuggestions(toOcrDocumentInput(doc));
    expect(s).toEqual([]);
  });
});

describe("OCR Assistant — review priority", () => {
  const qualityFor = (id: string) => {
    const doc = OCR_MOCK_DOCUMENTS.find((d) => d.id === id)!;
    const input = toOcrDocumentInput(doc);
    const classification = classifyDocument(input);
    return { quality: computeQualityScore(input, classification), family: classification.family };
  };

  it("unreadable scans are CRITICAL", () => {
    const { quality, family } = qualityFor("ocr-doc-unreadable-noon-report");
    const decision = evaluateReviewPriority({ quality, family });
    expect(decision.priority).toBe("CRITICAL");
  });

  it("a clean BDN is LOW priority", () => {
    const { quality, family } = qualityFor("ocr-doc-perfect-bdn");
    const decision = evaluateReviewPriority({ quality, family });
    expect(decision.priority).toBe("LOW");
  });

  it("a deficient certificate is raised to HIGH", () => {
    const { quality, family } = qualityFor("ocr-doc-blurred-certificate");
    const decision = evaluateReviewPriority({ quality, family });
    expect(decision.priority).toBe("HIGH");
    expect(decision.reasons.some((r) => r.includes("Certificate"))).toBe(true);
  });
});

run();
