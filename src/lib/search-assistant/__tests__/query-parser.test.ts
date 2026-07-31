import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createQueryParser } from "../query-parser";

describe("QueryParser", () => {
  const parser = createQueryParser();

  it("parses BDNs from Palma last year", () => {
    const expectedYear = new Date().getFullYear() - 1;
    const ast = parser.parse("find all BDNs from Palma last year");
    expect(ast.entity).toBe("fuel_deliveries");
    expect(ast.filters.port).toBe("palma");
    expect(ast.filters.year).toBe(expectedYear);
  });

  it("parses documents with confidence below 0.8", () => {
    const ast = parser.parse("show documents with confidence below 0.8");
    expect(ast.entity).toBe("documents");
    expect(ast.filters.confidenceMax).toBe(0.8);
  });

  it("parses the 2024 THETIS report for Aurelia", () => {
    const ast = parser.parse("find the 2024 THETIS report for Aurelia");
    expect(ast.entity).toBe("reports");
    expect(ast.filters.documentType).toBe("THETIS");
    expect(ast.filters.year).toBe(2024);
    expect(ast.filters.vesselName).toBe("aurelia");
  });

  it("outscores vessels with review keywords", () => {
    const ast = parser.parse("which vessels have pending review tasks?");
    expect(ast.entity).toBe("review_tasks");
    expect(ast.filters.status).toBe("PENDING");
  });

  it("parses voyages for Aurelia in June", () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), 5, 1).toISOString().split("T")[0];
    const to = new Date(now.getFullYear(), 6, 0).toISOString().split("T")[0];
    const ast = parser.parse("show voyages for Aurelia in June");
    expect(ast.entity).toBe("voyages");
    expect(ast.filters.vesselName).toBe("aurelia");
    expect(ast.filters.dateFrom).toBe(from);
    expect(ast.filters.dateTo).toBe(to);
  });

  it("parses audit events for IMO 9074729", () => {
    const ast = parser.parse("show audit events for IMO 9074729");
    expect(ast.entity).toBe("audit_log");
    expect(ast.filters.imo).toBe("9074729");
  });

  it("parses FuelEU reports for 2026", () => {
    const ast = parser.parse("find FuelEU reports for 2026");
    expect(ast.entity).toBe("reports");
    expect(ast.filters.documentType).toBe("FuelEU");
    expect(ast.filters.year).toBe(2026);
  });

  it("parses documents uploaded by email", () => {
    const ast = parser.parse("find all documents uploaded by email");
    expect(ast.entity).toBe("documents");
    expect(ast.filters.source).toBe("EMAIL");
  });

  it("returns null entity for ambiguous queries", () => {
    const ast = parser.parse("show me everything");
    expect(ast.entity).toBeNull();
    expect(ast.ambiguous.includes("entity")).toBe(true);
  });

  it("normalizes whitespace in queries", () => {
    expect(parser.normalizedQuery("  find   all   BDNs   from   Palma  ")).toBe(
      "find all BDNs from Palma",
    );
  });

  it("detects oldest sort", () => {
    const ast = parser.parse("show me the oldest documents");
    expect(ast.sort).toEqual({ field: "date", direction: "asc" });
  });

  it("detects highest confidence sort", () => {
    const ast = parser.parse("show documents with highest confidence");
    expect(ast.sort).toEqual({ field: "confidence", direction: "desc" });
  });
});

run();
