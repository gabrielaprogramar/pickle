import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  GLOBAL_SULPHUR_LIMIT_PCT,
  ECA_SULPHUR_LIMIT_PCT,
  MED_SOX_ECA_EFFECTIVE_DATE,
  SOX_PARAMETER_SET,
  isMedSoxEcaEffective,
  getApplicableSulphurLimit,
  isSulphurConforming,
  formatSulphurLimit,
} from "../parameters";

describe("sox-eca parameters — versioned limits", () => {
  it("defines the global cap at 0.50% m/m", () => {
    expect(GLOBAL_SULPHUR_LIMIT_PCT).toBe(0.5);
  });

  it("defines the ECA cap at 0.10% m/m", () => {
    expect(ECA_SULPHUR_LIMIT_PCT).toBe(0.1);
  });

  it("carries a versioned parameter set", () => {
    expect(SOX_PARAMETER_SET.version).toBe("2025.1");
    expect(SOX_PARAMETER_SET.eca_code).toBe("MED_SOX_ECA");
  });
});

describe("sox-eca parameters — effective date", () => {
  it("is not effective before 2025-05-01", () => {
    expect(isMedSoxEcaEffective("2025-04-30T23:59:59.999Z")).toBe(false);
  });

  it("is effective on and after 2025-05-01", () => {
    expect(isMedSoxEcaEffective("2025-05-01T00:00:00.000Z")).toBe(true);
    expect(isMedSoxEcaEffective("2026-07-10T12:00:00.000Z")).toBe(true);
  });

  it("exposes the effective date constant", () => {
    expect(MED_SOX_ECA_EFFECTIVE_DATE).toBe("2025-05-01");
  });
});

describe("sox-eca parameters — applicable limit", () => {
  it("returns 0.10% inside the ECA after the effective date", () => {
    expect(getApplicableSulphurLimit(true, "2026-07-10T12:00:00.000Z")).toBe(0.1);
  });

  it("returns 0.50% inside the ECA before the effective date", () => {
    expect(getApplicableSulphurLimit(true, "2025-04-30T12:00:00.000Z")).toBe(0.5);
  });

  it("returns 0.50% outside the ECA regardless of date", () => {
    expect(getApplicableSulphurLimit(false, "2026-07-10T12:00:00.000Z")).toBe(0.5);
    expect(getApplicableSulphurLimit(false, "2025-01-01T00:00:00.000Z")).toBe(0.5);
  });
});

describe("sox-eca parameters — conforming check", () => {
  it("treats values at or below the limit as conforming", () => {
    expect(isSulphurConforming(0.1, 0.1)).toBe(true);
    expect(isSulphurConforming(0.05, 0.1)).toBe(true);
    expect(isSulphurConforming(0.5, 0.5)).toBe(true);
  });

  it("treats values above the limit as non-conforming", () => {
    expect(isSulphurConforming(0.11, 0.1)).toBe(false);
    expect(isSulphurConforming(0.51, 0.5)).toBe(false);
  });

  it("formats limits as percentages", () => {
    expect(formatSulphurLimit(0.1)).toBe("0.10% m/m");
    expect(formatSulphurLimit(0.5)).toBe("0.50% m/m");
  });
});

run();
