import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { normalizeFuelType, isDropInFuel, classifyFuel, normalizePortName } from "../normalization";

describe("normalizeFuelType", () => {
  it("normalises common VLSFO variants", () => {
    expect(normalizeFuelType("VLSFO")).toBe("vlsfo");
    expect(normalizeFuelType("vlsfo 0.5")).toBe("vlsfo");
    expect(normalizeFuelType("VLSFO 0.50")).toBe("vlsfo");
  });

  it("normalises HFO variants", () => {
    expect(normalizeFuelType("HFO 380")).toBe("hfo_380");
    expect(normalizeFuelType("IFO380")).toBe("hfo_380");
    expect(normalizeFuelType("RMG 380")).toBe("rmg_380");
    expect(normalizeFuelType("RMK380")).toBe("rmk_380");
  });

  it("normalises distillate fuels", () => {
    expect(normalizeFuelType("MGO")).toBe("mgo");
    expect(normalizeFuelType("Marine Gas Oil")).toBe("mgo");
    expect(normalizeFuelType("LSMGO")).toBe("lsmgo");
    expect(normalizeFuelType("MDO")).toBe("mdo");
  });

  it("normalises alternative fuels", () => {
    expect(normalizeFuelType("LNG")).toBe("lng");
    expect(normalizeFuelType("Liquefied Natural Gas")).toBe("lng");
    expect(normalizeFuelType("Methanol")).toBe("methanol");
    expect(normalizeFuelType("B100")).toBe("biodiesel");
  });

  it("returns lowercased original when no match exists", () => {
    expect(normalizeFuelType("CustomFuel X")).toBe("customfuel x");
  });
});

describe("isDropInFuel", () => {
  it("returns true for residual and distillate fuels", () => {
    expect(isDropInFuel("vlsfo")).toBe(true);
    expect(isDropInFuel("mgo")).toBe(true);
    expect(isDropInFuel("hfo_380")).toBe(true);
  });

  it("returns false for alternative fuels needing modifications", () => {
    expect(isDropInFuel("lng")).toBe(false);
    expect(isDropInFuel("methanol")).toBe(false);
    expect(isDropInFuel("hydrogen")).toBe(false);
    expect(isDropInFuel("ammonia")).toBe(false);
  });
});

describe("classifyFuel", () => {
  it("classifies residual fuels", () => {
    expect(classifyFuel("vlsfo")).toBe("residual");
    expect(classifyFuel("hfo_380")).toBe("residual");
  });

  it("classifies distillate fuels", () => {
    expect(classifyFuel("mgo")).toBe("distillate");
    expect(classifyFuel("lsmgo")).toBe("distillate");
  });

  it("classifies alternative fuels", () => {
    expect(classifyFuel("lng")).toBe("lng");
    expect(classifyFuel("methanol")).toBe("methanol");
  });

  it("returns 'other' for unknown fuels", () => {
    expect(classifyFuel("custom_x")).toBe("other");
  });
});

describe("normalizePortName", () => {
  it("removes 'port of' prefix", () => {
    expect(normalizePortName("Port of Rotterdam")).toBe("rotterdam");
  });

  it("removes 'port ' prefix", () => {
    expect(normalizePortName("Port Rotterdam")).toBe("rotterdam");
  });

  it("removes 'the ' prefix", () => {
    expect(normalizePortName("The Hague")).toBe("hague");
  });

  it("lowercases and trims", () => {
    expect(normalizePortName("  Singapore  ")).toBe("singapore");
  });
});

run();
