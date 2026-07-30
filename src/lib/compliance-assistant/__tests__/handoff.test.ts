import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createHandoffDetector } from "../handoff";
import type { IntentType } from "@/lib/assistant/types";

describe("HandoffDetector", () => {
  const detector = createHandoffDetector();

  describe("keyword-based detection", () => {
    it('returns "voyage" target for AIS/track queries', () => {
      const result = detector.detectHandoff("Show me the AIS track for my vessel", "COMPLIANCE");
      expect(result.target).toBe("voyage");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('returns "voyage" target for route queries', () => {
      const result = detector.detectHandoff("What is the current sailing route?", "COMPLIANCE");
      expect(result.target).toBe("voyage");
    });

    it('returns "maintenance" target for certificate/survey queries', () => {
      const result = detector.detectHandoff("When is the next survey due for my vessel?", "COMPLIANCE");
      expect(result.target).toBe("maintenance");
    });

    it('returns "maintenance" target for inspection queries', () => {
      const result = detector.detectHandoff("Schedule a dry dock inspection", "COMPLIANCE");
      expect(result.target).toBe("maintenance");
    });

    it('returns "ocr" target for OCR/scan quality queries', () => {
      const result = detector.detectHandoff("The scanned document is blurry, can you re-extract?", "COMPLIANCE");
      expect(result.target).toBe("ocr");
    });

    it('returns "ocr" target for extraction queries', () => {
      const result = detector.detectHandoff("The OCR extraction failed for this image", "COMPLIANCE");
      expect(result.target).toBe("ocr");
    });

    it('returns "captain" target for crew/captain queries', () => {
      const result = detector.detectHandoff("Who is the current captain of this vessel?", "COMPLIANCE");
      expect(result.target).toBe("captain");
    });

    it('returns "captain" target for manning queries', () => {
      const result = detector.detectHandoff("What is the crew manning status?", "COMPLIANCE");
      expect(result.target).toBe("captain");
    });

    it('returns "none" target for compliance-related queries (FuelEU)', () => {
      const result = detector.detectHandoff("What is my FuelEU compliance balance?", "COMPLIANCE");
      expect(result.target).toBe("none");
    });

    it('returns "none" target for compliance-related queries (EU ETS)', () => {
      const result = detector.detectHandoff("How many EU ETS allowances do I need?", "COMPLIANCE");
      expect(result.target).toBe("none");
    });
  });

  describe("intent-based detection", () => {
    it("uses VOYAGE intent to return voyage target with confidence 1.0", () => {
      const result = detector.detectHandoff("any query here", "VOYAGE" as IntentType);
      expect(result.target).toBe("voyage");
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toContainString("VOYAGE");
    });

    it("uses CAPTAIN intent to return captain target with confidence 1.0", () => {
      const result = detector.detectHandoff("any query here", "CAPTAIN" as IntentType);
      expect(result.target).toBe("captain");
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toContainString("CAPTAIN");
    });

    it("compliance intent without keywords returns none", () => {
      const result = detector.detectHandoff("any query here", "COMPLIANCE" as IntentType);
      expect(result.target).toBe("none");
      expect(result.confidence).toBe(1.0);
    });

    it("unknown intent without keywords returns none", () => {
      const result = detector.detectHandoff("any query here", "UNKNOWN" as IntentType);
      expect(result.target).toBe("none");
      expect(result.confidence).toBe(1.0);
    });
  });

  describe("confidence bounds", () => {
    it("returns confidence between 0 and 1 for keyword matches", () => {
      const result = detector.detectHandoff("I need a certificate survey inspection for maintenance", "COMPLIANCE");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("returns confidence 1.0 for none target", () => {
      const result = detector.detectHandoff("Tell me about EU ETS regulations", "COMPLIANCE");
      expect(result.confidence).toBe(1.0);
    });
  });

  describe("handoff decision structure", () => {
    it("returns a reason string", () => {
      const result = detector.detectHandoff("Where is the vessel sailing?", "COMPLIANCE");
      expect(result.reason.length).toBeGreaterThan(0);
    });
  });
});

run();
