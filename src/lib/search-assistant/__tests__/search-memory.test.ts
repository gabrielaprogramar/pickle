import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createSearchMemory } from "../search-memory";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("SearchMemory", () => {
  it("lists recent searches newest first", async () => {
    const memory = createSearchMemory();
    memory.addRecent("find all BDNs", "fuel_deliveries", "user-001", "org-001", 3);
    await sleep(5);
    memory.addRecent("find all documents", "documents", "user-001", "org-001", 10);
    const recent = memory.listRecent("user-001", "org-001");
    expect(recent.length).toBe(2);
    expect(recent[0]!.query).toBe("find all documents");
    expect(recent[1]!.query).toBe("find all BDNs");
  });

  it("dedupes identical queries moving them to the front", async () => {
    const memory = createSearchMemory();
    memory.addRecent("Find all BDNs", "fuel_deliveries", "user-001", "org-001", 3);
    await sleep(5);
    memory.addRecent("find all bdns", "documents", "user-001", "org-001", 5);
    const recent = memory.listRecent("user-001", "org-001");
    expect(recent.length).toBe(1);
    expect(recent[0]!.resultCount).toBe(5);
    expect(recent[0]!.entity).toBe("documents");
  });

  it("caps recent searches at 20 per user", () => {
    const memory = createSearchMemory();
    for (let i = 0; i < 25; i++) {
      memory.addRecent(`query ${i}`, "documents", "user-001", "org-001", 1);
    }
    const recent = memory.listRecent("user-001", "org-001");
    expect(recent.length).toBe(20);
    expect(recent[0]!.query).toBe("query 24");
  });

  it("scopes recent searches by user and organization", () => {
    const memory = createSearchMemory();
    memory.addRecent("find all BDNs", "fuel_deliveries", "user-001", "org-001", 3);
    memory.addRecent("find all voyages", "voyages", "user-002", "org-001", 4);
    memory.addRecent("find all documents", "documents", "user-001", "org-002", 5);
    expect(memory.listRecent("user-001", "org-001").length).toBe(1);
    expect(memory.listRecent("user-001", "org-001")[0]!.query).toBe("find all BDNs");
    expect(memory.listRecent("user-002", "org-001")[0]!.query).toBe("find all voyages");
    expect(memory.listRecent("user-001", "org-002")[0]!.query).toBe("find all documents");
  });

  it("clears recent searches", () => {
    const memory = createSearchMemory();
    memory.addRecent("find all BDNs", "fuel_deliveries", "user-001", "org-001", 3);
    memory.clearRecent("user-001", "org-001");
    expect(memory.listRecent("user-001", "org-001").length).toBe(0);
  });
});

run();
