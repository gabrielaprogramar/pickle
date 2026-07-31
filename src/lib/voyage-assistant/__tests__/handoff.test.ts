import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createVoyageHandoffDetector } from "../handoff";

describe("Voyage Assistant — handoff detection", () => {
  const detector = createVoyageHandoffDetector();

  it("hands off 'Why is this voyage 50% ETS covered?' to compliance", () => {
    const decision = detector.detect("Why is this voyage 50% ETS covered?");
    expect(decision.handoff).toBe(true);
    expect(decision.target).toBe("compliance");
  });

  it("hands off 'What does this voyage mean for EU ETS?' to compliance", () => {
    const decision = detector.detect("What does this voyage mean for EU ETS?");
    expect(decision.handoff).toBe(true);
    expect(decision.target).toBe("compliance");
  });

  it("hands off penalty and obligation questions to compliance", () => {
    const penalty = detector.detect("What is the ETS penalty if coverage is too low?");
    expect(penalty.target).toBe("compliance");
    const obligation = detector.detect("Am I exposed to an EUA obligation here?");
    expect(obligation.target).toBe("compliance");
  });

  it("hands off 'find all voyages with gaps' to search", () => {
    const decision = detector.detect("find all voyages with gaps");
    expect(decision.handoff).toBe(true);
    expect(decision.target).toBe("search");
  });

  it("hands off port-readiness questions to the captain", () => {
    const decision = detector.detect("Am I ready for the port of Antibes?");
    expect(decision.handoff).toBe(true);
    expect(decision.target).toBe("captain");
  });

  it("keeps voyage-domain port questions local", () => {
    const decision = detector.detect("Which ports did we visit last month?");
    expect(decision.handoff).toBe(false);
  });

  it("keeps AIS gap questions local", () => {
    const decision = detector.detect("What tier is the AIS gap on the last voyage?");
    expect(decision.handoff).toBe(false);
  });

  it("keeps ETS coverage fact questions local", () => {
    const decision = detector.detect("What is my ETS coverage for the last voyage?");
    expect(decision.handoff).toBe(false);
  });
});

run();
