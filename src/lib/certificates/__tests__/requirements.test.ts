/**
 * certificates/__tests__/requirements.test.ts — source-driven applicability service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Verifies the REGULATORY_RESEARCH.md gating in requirements.ts: known types gate
 * deterministically from the vessel profile, ungated types (TONNAGE, ISCC) resolve
 * to UNKNOWN + review, and NOT_REQUIRED/REQUIRED outcomes are derived, never invented.
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  evaluateRequirements,
  placeholderRecordFor,
  certificateTypeLabel,
} from "../requirements";
import type { VesselCertProfile } from "../requirements";
import type { RequirementSpec } from "../types";
import { CERTIFICATE_REASON_CODES } from "../types";

const MOCK_PROFILE: VesselCertProfile = {
  imo: "9074729",
  name: "Aurelia",
  vesselType: "commercial",
  gt: 1250,
  lengthM: 60,
  ballastTanks: null,
};

function specFor(
  specs: ReadonlyArray<RequirementSpec>,
  certificateType: string,
): RequirementSpec {
  const spec = specs.find((s) => s.certificate_type === certificateType);
  if (!spec) throw new Error(`No spec for ${certificateType}`);
  return spec;
}

describe("evaluateRequirements — Aurelia mock profile (commercial, GT 1250)", () => {
  it("gates IAPP and IOPP as REQUIRED at GT >= 400", () => {
    const specs = evaluateRequirements(MOCK_PROFILE);
    expect(specFor(specs, "AIR_POLLUTION_PREVENTION").applicability).toBe("REQUIRED");
    expect(specFor(specs, "MARPOL").applicability).toBe("REQUIRED");
  });

  it("gates ISPS as REQUIRED for commercial >= 500 GT", () => {
    const specs = evaluateRequirements(MOCK_PROFILE);
    expect(specFor(specs, "ISPS").applicability).toBe("REQUIRED");
  });

  it("gates LOAD_LINE and CLASS_CERTIFICATE as REQUIRED for commercial craft", () => {
    const specs = evaluateRequirements(MOCK_PROFILE);
    expect(specFor(specs, "LOAD_LINE").applicability).toBe("REQUIRED");
    expect(specFor(specs, "CLASS_CERTIFICATE").applicability).toBe("REQUIRED");
  });

  it("gates SAFETY_MANAGEMENT and SAFETY_CERTIFICATE as REQUIRED for commercial", () => {
    const specs = evaluateRequirements(MOCK_PROFILE);
    expect(specFor(specs, "SAFETY_MANAGEMENT").applicability).toBe("REQUIRED");
    expect(specFor(specs, "SAFETY_CERTIFICATE").applicability).toBe("REQUIRED");
  });

  it("marks SEEMP NOT_REQUIRED below 5,000 GT", () => {
    const specs = evaluateRequirements(MOCK_PROFILE);
    expect(specFor(specs, "SEEMP").applicability).toBe("NOT_REQUIRED");
  });

  it("marks TONNAGE and ISCC as UNKNOWN + review (not gated by research)", () => {
    const specs = evaluateRequirements(MOCK_PROFILE);
    const tonnage = specFor(specs, "TONNAGE");
    const iscc = specFor(specs, "ISCC");
    expect(tonnage.applicability).toBe("UNKNOWN");
    expect(tonnage.requiresReview).toBe(true);
    expect(iscc.applicability).toBe("UNKNOWN");
    expect(iscc.requiresReview).toBe(true);
  });

  it("marks BALLAST_WATER UNKNOWN when ballast capability is not on file", () => {
    const specs = evaluateRequirements(MOCK_PROFILE);
    const bwm = specFor(specs, "BALLAST_WATER");
    expect(bwm.applicability).toBe("UNKNOWN");
    expect(bwm.requiresReview).toBe(true);
  });

  it("cites REGULATORY_RESEARCH.md for every determination", () => {
    const specs = evaluateRequirements(MOCK_PROFILE);
    for (const spec of specs) {
      expect(spec.source.startsWith("REGULATORY_RESEARCH.md")).toBe(true);
    }
  });
});

describe("evaluateRequirements — GT gating", () => {
  it("marks IAPP NOT_REQUIRED below 400 GT", () => {
    const specs = evaluateRequirements({ ...MOCK_PROFILE, gt: 200 });
    expect(specFor(specs, "AIR_POLLUTION_PREVENTION").applicability).toBe("NOT_REQUIRED");
  });

  it("marks ISPS NOT_REQUIRED below 500 GT", () => {
    const specs = evaluateRequirements({ ...MOCK_PROFILE, gt: 350 });
    expect(specFor(specs, "ISPS").applicability).toBe("NOT_REQUIRED");
  });

  it("marks IAPP UNKNOWN + review when GT is not on file", () => {
    const specs = evaluateRequirements({ ...MOCK_PROFILE, gt: null });
    const iapp = specFor(specs, "AIR_POLLUTION_PREVENTION");
    expect(iapp.applicability).toBe("UNKNOWN");
    expect(iapp.requiresReview).toBe(true);
  });

  it("gates SEEMP REQUIRED at >= 5,000 GT", () => {
    const specs = evaluateRequirements({ ...MOCK_PROFILE, gt: 8000 });
    expect(specFor(specs, "SEEMP").applicability).toBe("REQUIRED");
  });
});

describe("evaluateRequirements — vessel type gating", () => {
  it("marks private pleasure craft SAFETY_MANAGEMENT NOT_REQUIRED", () => {
    const specs = evaluateRequirements({ ...MOCK_PROFILE, vesselType: "private" });
    expect(specFor(specs, "SAFETY_MANAGEMENT").applicability).toBe("NOT_REQUIRED");
  });

  it("marks private SAFETY_CERTIFICATE NOT_REQUIRED", () => {
    const specs = evaluateRequirements({ ...MOCK_PROFILE, vesselType: "private" });
    expect(specFor(specs, "SAFETY_CERTIFICATE").applicability).toBe("NOT_REQUIRED");
  });

  it("marks unknown vessel type SAFETY_MANAGEMENT UNKNOWN + review", () => {
    const specs = evaluateRequirements({ ...MOCK_PROFILE, vesselType: "unknown" });
    const sm = specFor(specs, "SAFETY_MANAGEMENT");
    expect(sm.applicability).toBe("UNKNOWN");
    expect(sm.requiresReview).toBe(true);
  });
});

describe("evaluateRequirements — BWM ballast-tank gating", () => {
  it("marks BALLAST_WATER NOT_REQUIRED for a vessel without ballast tanks", () => {
    const specs = evaluateRequirements({ ...MOCK_PROFILE, ballastTanks: false });
    expect(specFor(specs, "BALLAST_WATER").applicability).toBe("NOT_REQUIRED");
  });

  it("marks BALLAST_WATER REQUIRED for >= 400 GT with ballast tanks", () => {
    const specs = evaluateRequirements({ ...MOCK_PROFILE, ballastTanks: true });
    expect(specFor(specs, "BALLAST_WATER").applicability).toBe("REQUIRED");
  });
});

describe("placeholderRecordFor", () => {
  it("creates a MISSING placeholder with MISSING_DOCUMENT for a REQUIRED spec", () => {
    const specs = evaluateRequirements(MOCK_PROFILE);
    const p = placeholderRecordFor(specFor(specs, "AIR_POLLUTION_PREVENTION"), {
      vessel_id: "vsl-aurelia",
      imo: "9074729",
    });
    expect(p.status).toBe("MISSING");
    expect(p.reason_code).toBe(CERTIFICATE_REASON_CODES.MISSING_DOCUMENT);
    expect(p.review_required).toBe(false);
    expect(p.source).toBe("unknown");
    expect(p.notes).toContainString("REGULATORY_RESEARCH.md");
  });

  it("creates an UNKNOWN placeholder with review for an uncertain spec", () => {
    const specs = evaluateRequirements(MOCK_PROFILE);
    const p = placeholderRecordFor(specFor(specs, "TONNAGE"), {
      vessel_id: "vsl-aurelia",
      imo: "9074729",
    });
    expect(p.status).toBe("UNKNOWN");
    expect(p.reason_code).toBe(CERTIFICATE_REASON_CODES.UNCERTAIN_APPLICABILITY);
    expect(p.review_required).toBe(true);
  });
});

describe("certificateTypeLabel", () => {
  it("returns the human label for a known type", () => {
    expect(certificateTypeLabel("AIR_POLLUTION_PREVENTION")).toContainString("IAPP");
  });

  it("falls back to the raw code for an unknown type", () => {
    expect(certificateTypeLabel("SOMETHING_ELSE")).toBe("SOMETHING_ELSE");
  });
});

run();
