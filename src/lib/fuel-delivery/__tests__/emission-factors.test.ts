import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  getFuelEmissionInfo,
  calculateCo2,
  calculateSox,
  calculatePm,
  calculateTotalEmissions,
} from "../emission-factors";

describe("getFuelEmissionInfo", () => {
  it("returns VLSFO factors", () => {
    const info = getFuelEmissionInfo("vlsfo");
    expect(info.co2_factor).toBe(3.151);
    expect(info.sox_factor).toBe(0.005);
    expect(info.pm_factor).toBe(0.0010);
    expect(info.display_name).toBe("VLSFO");
  });

  it("returns fallback for unknown fuel type", () => {
    const info = getFuelEmissionInfo("unknown_fuel_x");
    expect(info.co2_factor).toBe(3.206);
    expect(info.display_name).toBe("Unknown");
  });
});

describe("calculateCo2", () => {
  it("calculates CO2 for VLSFO", () => {
    const co2 = calculateCo2("vlsfo", 100);
    expect(co2).toBeGreaterThan(314);
    expect(co2).toBeLessThanOrEqual(316);
  });

  it("calculates CO2 for MGO", () => {
    const co2 = calculateCo2("mgo", 50);
    expect(co2).toBeGreaterThan(160);
    expect(co2).toBeLessThanOrEqual(161);
  });
});

describe("calculateSox", () => {
  it("uses default sox factor when sulphur not provided", () => {
    const sox = calculateSox("hfo_380", 100);
    expect(sox).toBeGreaterThan(1.9);
    expect(sox).toBeLessThanOrEqual(2.1);
  });

  it("adjusts for actual sulphur content", () => {
    const sox = calculateSox("hfo_380", 100, 0.5);
    expect(sox).toBeGreaterThan(0.9);
    expect(sox).toBeLessThanOrEqual(1.1);
  });
});

describe("calculatePm", () => {
  it("calculates PM for HFO", () => {
    const pm = calculatePm("hfo_380", 100);
    expect(pm).toBeGreaterThan(0.15);
    expect(pm).toBeLessThanOrEqual(0.25);
  });
});

describe("calculateTotalEmissions", () => {
  it("returns all three components for a delivery", () => {
    const result = calculateTotalEmissions("vlsfo", 250, 0.5);
    expect(result.co2).toBeGreaterThan(787);
    expect(result.co2).toBeLessThanOrEqual(788);
    expect(result.sox).toBeGreaterThan(0.6);
    expect(result.sox).toBeLessThanOrEqual(0.7);
    expect(result.pm).toBe(0.25);
  });
});

run();
