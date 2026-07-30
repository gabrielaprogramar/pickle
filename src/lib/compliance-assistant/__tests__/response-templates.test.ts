import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createComplianceResponseBuilder } from "../response-templates";
import type { RegulatoryCitation, ToolCallRecord } from "@/lib/assistant/types";

function makeCitation(overrides?: Partial<RegulatoryCitation>): RegulatoryCitation {
  return {
    source: "EU ETS Directive",
    regulation: "EU ETS",
    article_section: "Article 12(3)",
    version: "2023/01",
    chunk_id: "chunk-1",
    document_id: "doc-1",
    relevance_score: 0.95,
    excerpt: "Monitoring requirements...",
    ...overrides,
  };
}

function makeToolCall(overrides?: Partial<ToolCallRecord>): ToolCallRecord {
  return {
    id: "tc-1",
    toolName: "get_vessel_compliance_score",
    input: {},
    output: { total_emissions: 15000 },
    success: true,
    error: null,
    latencyMs: 123,
    timestamp: "2026-01-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("ComplianceResponseBuilder", () => {
  const builder = createComplianceResponseBuilder();

  describe("buildComplianceAnswer", () => {
    it("renders Answer/Evidence/Why/Recommended Action/Sources structure", () => {
      const result = builder.buildComplianceAnswer({
        answer: "The vessel is compliant.",
        evidence: "Tool returned compliance score of 95.",
        why: "The regulation requires a minimum score of 80.",
        recommendedAction: "Continue current operations.",
        sources: [makeCitation()],
      });

      expect(result).toContainString("**Answer** — The vessel is compliant.");
      expect(result).toContainString("**Evidence** — Tool returned compliance score of 95.");
      expect(result).toContainString("**Why** — The regulation requires a minimum score of 80.");
      expect(result).toContainString("**Recommended action** — Continue current operations.");
      expect(result).toContainString("**Sources**");
    });

    it("includes all sources", () => {
      const sources = [
        makeCitation({ source: "FuelEU Regulation", regulation: "FuelEU", article_section: "Article 4" }),
        makeCitation({ source: "EU ETS Directive", regulation: "EU ETS", article_section: "Article 12(3)" }),
      ];

      const result = builder.buildComplianceAnswer({
        answer: "Test answer.",
        evidence: "Test evidence.",
        why: "Test why.",
        recommendedAction: "Test action.",
        sources,
      });

      expect(result).toContainString("FuelEU Regulation");
      expect(result).toContainString("FuelEU");
      expect(result).toContainString("Article 4");
      expect(result).toContainString("EU ETS Directive");
      expect(result).toContainString("EU ETS");
      expect(result).toContainString("Article 12(3)");
    });

    it("handles sources without article_section", () => {
      const result = builder.buildComplianceAnswer({
        answer: "Test.",
        evidence: "Test.",
        why: "Test.",
        recommendedAction: "Test.",
        sources: [makeCitation({ article_section: null })],
      });

      expect(result).toContainString("EU ETS Directive — EU ETS");
      expect(result).toContainString("2023/01");
    });
  });

  describe("formatComplianceFigure", () => {
    it("formats integer values without decimals", () => {
      const result = builder.formatComplianceFigure(15000, "tonnes", "rec-1");
      expect(result).toContainString("tonnes");
      expect(result).toContainString("source: rec-1");
    });

    it("formats non-integer values to 2dp", () => {
      const result = builder.formatComplianceFigure(85.2, "gCO2e/MJ", "rec-2");
      expect(result).toContainString("85.20 gCO2e/MJ");
    });

    it("includes calc version when provided", () => {
      const result = builder.formatComplianceFigure(15000, "tonnes", "rec-1", "1.2");
      expect(result).toContainString("calculation v1.2");
    });

    it("includes param version when provided", () => {
      const result = builder.formatComplianceFigure(15000, "tonnes", "rec-1", undefined, "3.0");
      expect(result).toContainString("parameter v3.0");
    });

    it("includes both calc and param versions when provided", () => {
      const result = builder.formatComplianceFigure(15000, "tonnes", "rec-1", "1.2", "3.0");
      expect(result).toContainString("calculation v1.2");
      expect(result).toContainString("parameter v3.0");
    });

    it("rounds to 2dp for very long decimals", () => {
      const result = builder.formatComplianceFigure(89.33333, "gCO2e/MJ", "rec-3");
      expect(result).toContainString("89.33 gCO2e/MJ");
    });
  });

  describe("formatToolResultSummary", () => {
    it("lists tools with status and latency", () => {
      const calls = [
        makeToolCall({ id: "tc-1", toolName: "get_vessel_compliance_score", success: true, latencyMs: 150 }),
        makeToolCall({ id: "tc-2", toolName: "lookup_emission_factor", success: true, latencyMs: 42 }),
      ];

      const result = builder.formatToolResultSummary(calls);
      expect(result).toContainString("Tools used:");
      expect(result).toContainString("get_vessel_compliance_score (tc-1): succeeded in 150ms");
      expect(result).toContainString("lookup_emission_factor (tc-2): succeeded in 42ms");
    });

    it("handles empty array", () => {
      const result = builder.formatToolResultSummary([]);
      expect(result).toBe("No tools were called.");
    });

    it("shows failed tools with failed status", () => {
      const calls = [
        makeToolCall({ id: "tc-3", toolName: "get_open_violations", success: false, error: "Timeout", latencyMs: 5000 }),
      ];

      const result = builder.formatToolResultSummary(calls);
      expect(result).toContainString("get_open_violations (tc-3): failed in 5000ms");
    });
  });

  describe("formatInsufficientEvidence", () => {
    it("returns expected message", () => {
      expect(builder.formatInsufficientEvidence()).toBe(
        "I don't have sufficient information to answer that question.",
      );
    });
  });

  describe("formatLegalRefusal", () => {
    it("returns expected message", () => {
      expect(builder.formatLegalRefusal()).toBe(
        "I cannot provide legal advice. Please consult a qualified maritime legal professional for legal interpretation or representation.",
      );
    });
  });
});

run();
