import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  buildMaintenanceSystemPrompt,
  describeComplianceImpactTaxonomy,
} from "../system-prompt";
import { MAINTENANCE_SYSTEM_PROMPT_VERSION } from "../types";

describe("Maintenance Assistant — system prompt", () => {
  const prompt = buildMaintenanceSystemPrompt(
    { vesselName: "Aurelia", vesselImo: "9074729" },
    MAINTENANCE_SYSTEM_PROMPT_VERSION,
  );

  it("is versioned", () => {
    expect(prompt).toContainString(`Maintenance Assistant (v${MAINTENANCE_SYSTEM_PROMPT_VERSION})`);
  });

  it("states it is not a CMMS", () => {
    expect(prompt.toLowerCase()).toContainString("not a cmms");
  });

  it("requires deterministic statuses only", () => {
    expect(prompt).toContainString("deterministic");
    expect(prompt).toContainString("never calculate or invent");
  });

  it("encodes the survey status taxonomy", () => {
    for (const status of ["CURRENT", "UPCOMING", "DUE_SOON", "OVERDUE", "BLOCKING", "UNKNOWN"]) {
      expect(prompt).toContainString(status);
    }
  });

  it("forbids claiming unsupported legal consequences", () => {
    expect(prompt).toContainString("Never claim a legal or commercial consequence");
  });

  it("declares memory is context, not authority", () => {
    expect(prompt).toContainString("context, never authority");
  });

  it("describes the compliance impact taxonomy distinctly", () => {
    const taxonomy = describeComplianceImpactTaxonomy();
    expect(taxonomy).toContainString("FACT");
    expect(taxonomy).toContainString("DETERMINISTIC_IMPACT");
    expect(taxonomy).toContainString("ADVISORY_RECOMMENDATION");
  });
});

run();
