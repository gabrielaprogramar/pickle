import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createSavedSearchStore } from "../saved-searches";
import { createQueryParser } from "../query-parser";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("SavedSearchStore", () => {
  const parser = createQueryParser();

  function makeStore() {
    return createSavedSearchStore();
  }

  it("saves and lists a search", () => {
    const store = makeStore();
    const saved = store.save(
      "Palma BDNs",
      "find all BDNs from Palma",
      parser.parse("find all BDNs from Palma"),
      "user-001",
      "org-001",
    );
    const listed = store.list("user-001", "org-001");
    expect(listed.length).toBe(1);
    expect(listed[0]!.id).toBe(saved.id);
    expect(listed[0]!.name).toBe("Palma BDNs");
    expect(listed[0]!.query).toBe("find all BDNs from Palma");
  });

  it("gets a saved search by id", () => {
    const store = makeStore();
    const saved = store.save(
      "Palma BDNs",
      "find all BDNs from Palma",
      parser.parse("find all BDNs from Palma"),
      "user-001",
      "org-001",
    );
    const found = store.get(saved.id, "user-001", "org-001");
    expect(found).toBeTruthy();
    expect(found!.id).toBe(saved.id);
    expect(store.get("missing-id", "user-001", "org-001")).toBeNull();
  });

  it("renames a saved search", () => {
    const store = makeStore();
    const saved = store.save(
      "Palma BDNs",
      "find all BDNs from Palma",
      parser.parse("find all BDNs from Palma"),
      "user-001",
      "org-001",
    );
    const renamed = store.rename(saved.id, "Renamed search", "user-001", "org-001");
    expect(renamed!.name).toBe("Renamed search");
    expect(store.get(saved.id, "user-001", "org-001")!.name).toBe("Renamed search");
    expect(store.rename("missing-id", "x", "user-001", "org-001")).toBeNull();
  });

  it("deletes a saved search", () => {
    const store = makeStore();
    const saved = store.save(
      "Palma BDNs",
      "find all BDNs from Palma",
      parser.parse("find all BDNs from Palma"),
      "user-001",
      "org-001",
    );
    expect(store.remove(saved.id, "user-001", "org-001")).toBe(true);
    expect(store.list("user-001", "org-001").length).toBe(0);
    expect(store.remove(saved.id, "user-001", "org-001")).toBe(false);
  });

  it("scopes saved searches by user", () => {
    const store = makeStore();
    store.save("A", "find all BDNs", parser.parse("find all BDNs"), "user-001", "org-001");
    store.save("B", "find all documents", parser.parse("find all documents"), "user-002", "org-001");
    const forUser1 = store.list("user-001", "org-001");
    expect(forUser1.length).toBe(1);
    expect(forUser1[0]!.name).toBe("A");
    expect(store.list("user-002", "org-001").length).toBe(1);
  });

  it("scopes saved searches by organization", () => {
    const store = makeStore();
    store.save("A", "find all BDNs", parser.parse("find all BDNs"), "user-001", "org-001");
    store.save("B", "find all documents", parser.parse("find all documents"), "user-001", "org-002");
    expect(store.list("user-001", "org-001").length).toBe(1);
    expect(store.list("user-001", "org-002").length).toBe(1);
    expect(store.list("user-001", "org-001")[0]!.name).toBe("A");
    expect(store.list("user-001", "org-002")[0]!.name).toBe("B");
  });

  it("upserts a search with the same name and query", () => {
    const store = makeStore();
    const first = store.save(
      "Palma BDNs",
      "find all BDNs from Palma",
      parser.parse("find all BDNs from Palma"),
      "user-001",
      "org-001",
    );
    const second = store.save(
      "palma bdns",
      "find all BDNs from Palma",
      parser.parse("find all BDNs from Palma"),
      "user-001",
      "org-001",
    );
    expect(second.id).toBe(first.id);
    expect(store.list("user-001", "org-001").length).toBe(1);
  });

  it("sorts by updatedAt descending", async () => {
    const store = makeStore();
    store.save("First", "find all BDNs", parser.parse("find all BDNs"), "user-001", "org-001");
    await sleep(5);
    store.save("Second", "find all documents", parser.parse("find all documents"), "user-001", "org-001");
    await sleep(5);
    const first = store.list("user-001", "org-001")[1]!;
    store.rename(first.id, "First renamed", "user-001", "org-001");
    const listed = store.list("user-001", "org-001");
    expect(listed.length).toBe(2);
    expect(listed[0]!.id).toBe(first.id);
    expect(listed[0]!.name).toBe("First renamed");
  });
});

run();
