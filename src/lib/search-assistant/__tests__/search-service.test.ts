import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createSearchService } from "../search-service";
import type { SearchService } from "../search-service";
import { createSearchToolRegistry } from "../search-tools";
import { createQueryParser } from "../query-parser";
import { createQueryValidator } from "../query-validator";
import { createComplianceHandoffDetector } from "../handoff";
import { createSearchMemory } from "../search-memory";
import { createSavedSearchStore } from "../saved-searches";

const USER = { userId: "user-001", organizationId: "org-001" };

function makeService(): SearchService {
  return createSearchService({
    registry: createSearchToolRegistry(),
    parser: createQueryParser(),
    validator: createQueryValidator(),
    handoffDetector: createComplianceHandoffDetector(),
    memory: createSearchMemory(),
    savedSearches: createSavedSearchStore(),
  });
}

describe("SearchService", () => {
  it('searches "Find all BDNs from Palma last year"', async () => {
    const svc = makeService();
    const res = await svc.search({ query: "Find all BDNs from Palma last year", ...USER });
    expect(res.success).toBe(true);
    expect(res.data).toBeTruthy();
    expect(res.data!.entity).toBe("fuel_deliveries");
    expect(res.data!.total).toBe(3);
    expect(res.data!.toolsCalled).toEqual(["search_fuel_deliveries"]);

    const chips = res.data!.suggestedFilters;
    expect(chips.some((c) => c.label === "Palma" && c.value === "port=palma")).toBe(true);
    const expectedYear = new Date().getFullYear() - 1;
    expect(
      chips.some((c) => c.label === String(expectedYear) && c.value === `year=${expectedYear}`),
    ).toBe(true);
  });

  it('hands off "What is Aurelia\'s EUA obligation?" to compliance', async () => {
    const svc = makeService();
    const res = await svc.search({ query: "What is Aurelia's EUA obligation?", ...USER });
    expect(res.success).toBe(true);
    expect(res.handoff).toBeTruthy();
    expect(res.handoff!.target).toBe("compliance");
    expect(res.handoff!.confidence).toBeGreaterThan(0.5);
    expect(res.data).toBeFalsy();
  });

  it("returns 2 documents with confidence below 0.8", async () => {
    const svc = makeService();
    const res = await svc.search({
      query: "show documents with confidence below 0.8",
      ...USER,
    });
    expect(res.success).toBe(true);
    expect(res.data!.total).toBe(2);
    expect(res.data!.toolsCalled).toEqual(["search_documents"]);
  });

  it('finds the 2024 THETIS report for Aurelia', async () => {
    const svc = makeService();
    const res = await svc.search({
      query: "find the 2024 THETIS report for Aurelia",
      ...USER,
    });
    expect(res.success).toBe(true);
    expect(res.data!.total).toBe(1);
    expect(res.data!.results[0]!.id).toBe("rep-001");
  });

  it("rejects SQL injection attempts", async () => {
    const svc = makeService();
    const res = await svc.search({
      query: "find documents; DROP TABLE vessels",
      ...USER,
    });
    expect(res.success).toBe(false);
    expect(res.error!.message.toLowerCase().includes("forbidden")).toBe(true);
    expect(res.data).toBeFalsy();
  });

  it("rejects PII requests", async () => {
    const svc = makeService();
    const res = await svc.search({ query: "show credit card numbers", ...USER });
    expect(res.success).toBe(false);
    expect(res.error!.message.toLowerCase().includes("sensitive")).toBe(true);
  });

  it("respects and clamps page/pageSize overrides", async () => {
    const svc = makeService();
    const paged = await svc.search({
      query: "find all documents",
      page: 2,
      pageSize: 2,
      ...USER,
    });
    expect(paged.success).toBe(true);
    expect(paged.data!.page).toBe(2);
    expect(paged.data!.pageSize).toBe(2);
    expect(paged.data!.results.length).toBe(2);
    expect(paged.data!.total).toBe(10);

    const clamped = await svc.search({
      query: "find all documents",
      pageSize: 100,
      ...USER,
    });
    expect(clamped.success).toBe(true);
    expect(clamped.data!.pageSize).toBe(50);
  });

  it("rejects searches without an organization", async () => {
    const svc = makeService();
    const res = await svc.search({
      query: "find all documents",
      userId: "user-001",
      organizationId: "",
    });
    expect(res.success).toBe(false);
    expect(res.error!.message).toContainString("Organization scope is required");
  });

  it("returns clarification for queries without an entity", async () => {
    const svc = makeService();
    const res = await svc.search({ query: "show me everything", ...USER });
    expect(res.success).toBe(true);
    expect(res.clarification).toBeTruthy();
    expect(res.data).toBeFalsy();
    expect(res.clarification!.message).toContainString("couldn't determine");
  });

  it("saves, lists, renames, deletes, and reruns saved searches", async () => {
    const svc = makeService();
    const saved = svc.saveSearch(
      "Palma BDNs",
      "Find all BDNs from Palma last year",
      USER.userId,
      USER.organizationId,
    );
    expect(saved.saved).toBe(true);
    const listed = svc.listSaved(USER.userId, USER.organizationId);
    expect(listed.length).toBe(1);
    expect(listed[0]!.id).toBe(saved.savedSearch!.id);

    const renamed = svc.renameSavedSearch(
      saved.savedSearch!.id,
      "Renamed BDNs",
      USER.userId,
      USER.organizationId,
    );
    expect(renamed!.name).toBe("Renamed BDNs");

    expect(svc.deleteSavedSearch(saved.savedSearch!.id, USER.userId, USER.organizationId)).toBe(true);
    expect(svc.listSaved(USER.userId, USER.organizationId).length).toBe(0);

    const again = svc.saveSearch(
      "Palma BDNs",
      "Find all BDNs from Palma last year",
      USER.userId,
      USER.organizationId,
    );
    const rerun = await svc.rerunSavedSearch(again.savedSearch!.id, USER.userId, USER.organizationId);
    expect(rerun.success).toBe(true);
    expect(rerun.data!.total).toBe(3);
    expect(rerun.data!.toolsCalled).toEqual(["search_fuel_deliveries"]);
  });

  it("requires a name and query to save a search", () => {
    const svc = makeService();
    const noName = svc.saveSearch("  ", "find all documents", USER.userId, USER.organizationId);
    expect(noName.saved).toBe(false);
    expect(noName.error).toContainString("name is required");

    const noQuery = svc.saveSearch("name", "   ", USER.userId, USER.organizationId);
    expect(noQuery.saved).toBe(false);
    expect(noQuery.error).toContainString("Query is required");
  });

  it("records recent searches newest first, scoped by user", async () => {
    const svc = makeService();
    await svc.search({ query: "find all BDNs from Palma", ...USER });
    await svc.search({ query: "show documents with confidence below 0.8", ...USER });
    await svc.search({ query: "find the 2024 THETIS report for Aurelia", ...USER });
    await svc.search({
      query: "show voyages for Aurelia",
      userId: "user-002",
      organizationId: "org-001",
    });

    const recent = svc.listRecent(USER.userId, USER.organizationId);
    expect(recent.length).toBe(3);
    expect(recent[0]!.query).toBe("find the 2024 THETIS report for Aurelia");
    expect(recent[0]!.entity).toBe("reports");
    expect(recent[1]!.query).toBe("show documents with confidence below 0.8");
    expect(recent[2]!.query).toBe("find all BDNs from Palma");

    const other = svc.listRecent("user-002", "org-001");
    expect(other.length).toBe(1);
    expect(other[0]!.query).toBe("show voyages for Aurelia");
  });

  it("writes audit records for searches and saves", async () => {
    const svc = makeService();
    await svc.search({ query: "Find all BDNs from Palma last year", ...USER });
    await svc.search({ query: "show documents with confidence below 0.8", ...USER });
    await svc.search({ query: "find the 2024 THETIS report for Aurelia", ...USER });
    svc.saveSearch("Audit test", "find all documents", USER.userId, USER.organizationId);

    const log = svc.getAuditLog();
    expect(log.length).toBe(4);
    for (const record of log) {
      expect(record.query).toBeTruthy();
      expect(record.toolsCalled).toBeTruthy();
      expect(typeof record.resultCount).toBe("number");
      expect(record.modelId).toBe("mock");
      expect(record.promptVersion).toBeTruthy();
      expect(typeof record.latencyMs).toBe("number");
    }
    expect(log[0]!.intent).toBe("saved_search_created");
  });

  it("never computes compliance figures for handoff queries", async () => {
    const svc = makeService();
    const res = await svc.search({ query: "How much will we pay in penalties?", ...USER });
    expect(res.success).toBe(true);
    expect(res.handoff).toBeTruthy();
    expect(res.handoff!.target).toBe("compliance");
    expect(res.data).toBeFalsy();
    const serialized = JSON.stringify(res);
    expect(serialized.includes("complianceBalance")).toBe(false);
    expect(serialized.includes("euaObligation")).toBe(false);
  });

  it("treats deficit phrasing as retrieval when prefixed with show me", async () => {
    const svc = makeService();
    const res = await svc.search({ query: "show me vessels with a fuel eu deficit", ...USER });
    expect(res.success).toBe(true);
    expect(res.data).toBeTruthy();
    expect(res.handoff).toBeFalsy();
    expect(res.data!.entity).toBe("vessels");
    expect(res.data!.toolsCalled).toEqual(["search_vessels"]);
    const serialized = JSON.stringify(res.data);
    expect(serialized.includes("complianceBalance")).toBe(false);
    expect(serialized.includes("euaObligation")).toBe(false);
  });

  it("never emits complianceBalance or euaObligation fields from search results", async () => {
    const svc = makeService();
    const queries = [
      "Find all BDNs from Palma last year",
      "find all documents",
      "find the 2024 THETIS report for Aurelia",
      "show audit events for IMO 9074729",
      "which vessels have pending review tasks?",
    ];
    for (const query of queries) {
      const res = await svc.search({ query, ...USER });
      expect(res.success).toBe(true);
      const serialized = JSON.stringify(res.data ?? {});
      expect(serialized.includes("complianceBalance")).toBe(false);
      expect(serialized.includes("euaObligation")).toBe(false);
    }
  });
});

run();
