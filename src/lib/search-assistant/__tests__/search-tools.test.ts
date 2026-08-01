import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createSearchToolRegistry } from "../search-tools";
import type { SearchTool, SearchToolContext } from "../search-tools";
import type { SearchAst, SearchEntity, SearchFilter } from "../types";
import { SEARCH_HARD_LIMIT } from "../types";

const CONTEXT: SearchToolContext = { organizationId: "org-001", userId: "user-001" };

const ALL_ENTITIES: ReadonlyArray<SearchEntity> = [
  "vessels",
  "voyages",
  "ais_positions",
  "fuel_deliveries",
  "documents",
  "ocr_results",
  "validation_reports",
  "review_tasks",
  "reports",
  "verifier_packages",
  "audit_log",
  "regulatory",
  "certificates",
];

function ast(
  entity: SearchEntity,
  filters: SearchFilter = {},
  page = 1,
  pageSize = 50,
): SearchAst {
  return {
    entity,
    filters,
    sort: { field: "date", direction: "desc" },
    pagination: { page, pageSize },
    ambiguous: [],
  };
}

describe("SearchToolRegistry", () => {
  it("registers 13 tools", () => {
    const registry = createSearchToolRegistry();
    const tools = registry.listTools();
    expect(tools.length).toBe(13);
    const entities = tools.map((t) => t.entity);
    for (const entity of ALL_ENTITIES) {
      expect(entities.includes(entity)).toBe(true);
    }
  });

  it("returns the 8 certificate registry records with derived statuses", async () => {
    const registry = createSearchToolRegistry();
    const outcome = await registry.execute(
      ast("certificates", {}, 1, 50),
      CONTEXT,
    );
    expect(outcome.result.total).toBe(8);
    const statuses = outcome.result.results.map((r) => r.status).sort();
    expect(statuses).toContain("VALID");
    expect(statuses).toContain("EXPIRING_SOON");
    expect(statuses).toContain("EXPIRED");
    expect(statuses).toContain("PENDING_REVIEW");
  });

  it("filters certificates by derived status (expired)", async () => {
    const registry = createSearchToolRegistry();
    const outcome = await registry.execute(
      ast("certificates", { status: "EXPIRED" }, 1, 50),
      CONTEXT,
    );
    expect(outcome.result.total).toBe(1);
    expect(outcome.result.results[0]!.id).toBe("cert-loadline");
  });

  it("filters certificates by derived status (expiring soon)", async () => {
    const registry = createSearchToolRegistry();
    const outcome = await registry.execute(
      ast("certificates", { status: "EXPIRING_SOON" }, 1, 50),
      CONTEXT,
    );
    expect(outcome.result.total).toBe(1);
    expect(outcome.result.results[0]!.id).toBe("cert-iscc");
  });

  it("returns the 3 Palma 2025 BDNs", async () => {
    const registry = createSearchToolRegistry();
    const outcome = await registry.execute(
      ast("fuel_deliveries", { port: "Palma", year: 2025 }),
      CONTEXT,
    );
    expect(outcome.result.total).toBe(3);
    const ids = outcome.result.results.map((r) => r.id).sort();
    expect(ids).toEqual(["bdn-001", "bdn-002", "bdn-003"]);
  });

  it("filters documents by confidenceMax 0.8", async () => {
    const registry = createSearchToolRegistry();
    const outcome = await registry.execute(ast("documents", { confidenceMax: 0.8 }), CONTEXT);
    expect(outcome.result.total).toBe(2);
    const ids = outcome.result.results.map((r) => r.id).sort();
    expect(ids).toEqual(["doc-003", "doc-007"]);
    expect(ids.includes("doc-001")).toBe(false);
  });

  it("returns the 2024 THETIS report for Aurelia", async () => {
    const registry = createSearchToolRegistry();
    const outcome = await registry.execute(
      ast("reports", { documentType: "THETIS", year: 2024, vesselName: "Aurelia" }),
      CONTEXT,
    );
    expect(outcome.result.total).toBe(1);
    expect(outcome.result.results[0]!.id).toBe("rep-001");
  });

  it("returns pending review tasks", async () => {
    const registry = createSearchToolRegistry();
    const outcome = await registry.execute(ast("review_tasks", { status: "PENDING" }), CONTEXT);
    expect(outcome.result.total).toBe(3);
    const ids = outcome.result.results.map((r) => r.id).sort();
    expect(ids).toEqual(["rt-001", "rt-002", "rt-004"]);
  });

  it("returns Aurelia audit events", async () => {
    const registry = createSearchToolRegistry();
    const outcome = await registry.execute(ast("audit_log", { vesselName: "Aurelia" }), CONTEXT);
    expect(outcome.result.total).toBe(6);
    const ids = outcome.result.results.map((r) => r.id).sort();
    expect(ids).toEqual([
      "audit-001",
      "audit-002",
      "audit-003",
      "audit-004",
      "audit-005",
      "audit-006",
    ]);
  });

  it("paginates while preserving the total", async () => {
    const registry = createSearchToolRegistry();
    const full = await registry.execute(ast("fuel_deliveries", {}, 1, 50), CONTEXT);
    expect(full.result.total).toBe(10);

    const page1 = await registry.execute(ast("fuel_deliveries", {}, 1, 2), CONTEXT);
    expect(page1.result.total).toBe(10);
    expect(page1.result.results.length).toBe(2);
    expect(page1.result.results[0]!.id).toBe(full.result.results[0]!.id);
    expect(page1.result.results[1]!.id).toBe(full.result.results[1]!.id);

    const page2 = await registry.execute(ast("fuel_deliveries", {}, 2, 2), CONTEXT);
    expect(page2.result.total).toBe(10);
    expect(page2.result.results.length).toBe(2);
    expect(page2.result.results[0]!.id).toBe(full.result.results[2]!.id);
    expect(page2.result.results[1]!.id).toBe(full.result.results[3]!.id);
  });

  it("clamps oversized page sizes to the hard limit", async () => {
    const registry = createSearchToolRegistry();
    const outcome = await registry.execute(ast("fuel_deliveries", {}, 1, 100), CONTEXT);
    expect(SEARCH_HARD_LIMIT).toBe(50);
    expect(outcome.result.total).toBe(10);
    expect(outcome.result.results.length).toBe(10);
  });

  it("returns id, entity, title, and sourceRecordId on every result", async () => {
    const registry = createSearchToolRegistry();
    for (const tool of registry.listTools()) {
      const outcome = await registry.execute(ast(tool.entity, {}, 1, 50), CONTEXT);
      expect(outcome.result.results.length).toBeGreaterThan(0);
      for (const record of outcome.result.results) {
        expect(record.id).toBeTruthy();
        expect(record.entity).toBe(tool.entity);
        expect(record.title).toBeTruthy();
        expect(record.sourceRecordId).toBeTruthy();
      }
    }
  });

  it("exposes deepLinks where defined", async () => {
    const registry = createSearchToolRegistry();
    const voyages = await registry.execute(ast("voyages"), CONTEXT);
    const voyage = voyages.result.results[0]!;
    expect(voyage.deepLink).toBeTruthy();
    expect(voyage.deepLink!.label).toBeTruthy();
    expect(voyage.deepLink!.path).toContainString("/voyages/");

    const vessels = await registry.execute(ast("vessels"), CONTEXT);
    expect(vessels.result.results[0]!.deepLink).toBeFalsy();
  });

  it("passes organization context through to tools", async () => {
    let captured: SearchToolContext | undefined;
    const customTool: SearchTool = {
      name: "search_custom",
      description: "Custom tool for context flow tests",
      entity: "documents",
      async execute(sast, context) {
        captured = context;
        return {
          total: 1,
          results: [
            { entity: "documents", id: "custom-1", title: "Custom result", sourceRecordId: "custom-1" },
          ],
          filters: sast.filters,
        };
      },
    };
    const registry = createSearchToolRegistry([customTool]);
    expect(registry.listTools().length).toBe(1);
    const outcome = await registry.execute(
      ast("documents"),
      { organizationId: "org-001", userId: "user-001" },
    );
    expect(captured).toBeTruthy();
    expect(captured!.organizationId).toBe("org-001");
    expect(captured!.userId).toBe("user-001");
    expect(outcome.result.total).toBe(1);
  });
});

run();
