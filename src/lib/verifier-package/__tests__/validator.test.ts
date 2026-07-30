import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createPackageValidator } from "../validator";
import type { PackageBuildInput } from "../types";

const buildInput: PackageBuildInput = {
  vessel_id: "v1",
  reporting_year: 2025,
  report_ids: [],
  include_ais_data: true,
  include_bdn_documents: true,
  include_validation_reports: true,
  include_discrepancy_notes: true,
};

describe("PackageValidator", () => {
  it("validates successfully when all required data is present", async () => {
    const validator = createPackageValidator({
      getReportCount: async () => 3,
      getDocumentCount: async () => 5,
    });

    const result = await validator.validate(buildInput);
    expect(result.valid).toBe(true);
    expect(result.missing_required.length).toBe(0);
  });

  it("fails validation when no compliance reports exist", async () => {
    const validator = createPackageValidator({
      getReportCount: async () => 0,
      getDocumentCount: async () => 5,
    });

    const result = await validator.validate(buildInput);
    expect(result.valid).toBe(false);
    expect(result.missing_required.includes("compliance_report")).toBe(true);
  });

  it("fails validation when BDN documents are requested but none exist", async () => {
    const validator = createPackageValidator({
      getReportCount: async () => 3,
      getDocumentCount: async (_vesselId: string, types: ReadonlyArray<string>) => {
        if (types.includes("bdn")) return 0;
        return 5;
      },
    });

    const result = await validator.validate(buildInput);
    expect(result.valid).toBe(false);
    expect(result.missing_required.includes("bdn_documents")).toBe(true);
  });

  it("adds warning when AIS data is excluded", async () => {
    const validator = createPackageValidator({
      getReportCount: async () => 3,
      getDocumentCount: async () => 5,
    });

    const result = await validator.validate({ ...buildInput, include_ais_data: false });
    expect(result.valid).toBe(true);
    expect(result.missing_recommended.includes("ais_voyage_data")).toBe(true);
  });

  it("warns when BDN documents are present", async () => {
    const validator = createPackageValidator({
      getReportCount: async () => 3,
      getDocumentCount: async () => 5,
    });

    const result = await validator.validate(buildInput);
    expect(result.issues.some((i) => i.category === "bdn_coverage")).toBe(true);
    expect(result.issues.some((i) => i.category === "validation_data")).toBe(true);
  });
});

run();
