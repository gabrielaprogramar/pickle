import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createCaptainToolRegistry, CaptainVesselScopeError } from "../captain-tools";
import { createMockCaptainState } from "../mock-data";
import { makeContext, otherVesselContext } from "./_factory";

describe("Captain Assistant — vessel scoping", () => {
  const registry = createCaptainToolRegistry();
  const state = createMockCaptainState("amber");

  it("scopes all tools to the captain's assigned vessel", () => {
    const context = makeContext();
    const port = registry.getPortRequirements({ context, state });
    const docs = registry.getVesselDocStatus({ context, state });
    const calls = registry.getUpcomingPortCalls({ context, state });
    const iscc = registry.getIsccStatus({ context, state });
    const ingest = registry.getIngestConfirmations({ context, state });

    expect(port.vessel.name).toBe("Aurelia");
    expect(docs.vessel.imo).toBe("9074729");
    expect(calls.vessel.vesselId).toBe("vsl-aurelia");
    expect(iscc.vessel.name).toBe("Aurelia");
    expect(ingest.vessel.name).toBe("Aurelia");
  });

  it("throws when a tool is called with another vessel's context", () => {
    const foreign = otherVesselContext();
    let threw = false;
    let isScopeError = false;
    try {
      registry.getVesselDocStatus({ context: foreign, state });
    } catch (err) {
      threw = true;
      isScopeError = err instanceof CaptainVesselScopeError;
    }
    expect(threw).toBe(true);
    expect(isScopeError).toBe(true);
  });

  it("never returns another vessel's data on scope mismatch", () => {
    const foreign = otherVesselContext();
    try {
      registry.getUpcomingPortCalls({ context: foreign, state });
    } catch (err) {
      expect(err instanceof CaptainVesselScopeError).toBe(true);
    }
  });

  it("port requirement lookup is read-only and port-filtered", () => {
    const context = makeContext();
    const all = registry.getPortRequirements({ context, state });
    const antibes = registry.getPortRequirements({ context, state }, "Antibes");
    expect(all.data.length).toBeGreaterThan(0);
    expect(antibes.data.every((r) => r.port === "Antibes")).toBe(true);
  });
});

run();
