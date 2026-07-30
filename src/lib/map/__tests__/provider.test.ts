import { describe, it, expect } from "vitest";
import { DefaultMapProvider } from "../provider";
import { MockMapProvider } from "../mock-provider";
import { createDefaultMapConfig } from "../types";

describe("DefaultMapProvider", () => {
  it("returns default config", () => {
    const p = new DefaultMapProvider();
    const config = p.getConfig();
    expect(config.provider).toBe("mock");
    expect(config.isMock).toBe(true);
    expect(config.tile.url).toContain("cartocdn.com");
    expect(config.style.defaultZoom).toBe(5);
  });

  it("accepts partial overrides", () => {
    const p = new DefaultMapProvider({ provider: "leaflet", isMock: false });
    const config = p.getConfig();
    expect(config.provider).toBe("leaflet");
    expect(config.isMock).toBe(false);
  });
});

describe("MockMapProvider", () => {
  it("creates mock config", () => {
    const config = MockMapProvider.createConfig();
    expect(config.isMock).toBe(true);
    expect(config.provider).toBe("mock");
  });

  it("name is 'mock'", () => {
    const p = new MockMapProvider();
    expect(p.name).toBe("mock");
  });
});

describe("createDefaultMapConfig", () => {
  it("has correct default values", () => {
    const cfg = createDefaultMapConfig();
    expect(cfg.style.defaultCenter.lat).toBe(38);
    expect(cfg.style.defaultCenter.lng).toBe(15);
    expect(cfg.style.trackColor).toBe("#00B89F");
    expect(cfg.tile.maxZoom).toBe(18);
  });
});
