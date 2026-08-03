/**
 * credentials.test.ts — mock integration credential envelope tests (Phase 4.5)
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { decryptConfig, encryptConfig, isEnvelope } from "../credentials";

describe("integration credentials — encryptConfig", () => {
  it("wraps each value in the mock envelope", () => {
    const enc = encryptConfig({ apiKey: "sk-secret", endpoint: "https://api.example.com" });
    expect(isEnvelope(enc.apiKey)).toBe(true);
    expect(isEnvelope(enc.endpoint)).toBe(true);
    expect(String(enc.apiKey).startsWith("pl:mock:v1:")).toBe(true);
  });

  it("round-trips through decryptConfig", () => {
    const plain = { apiKey: "sk-secret", projectId: "poseidon-123" };
    expect(decryptConfig(encryptConfig(plain))).toEqual(plain);
  });

  it("handles an empty config", () => {
    expect(encryptConfig({})).toEqual({});
  });

  it("does not expose the secret in the envelope", () => {
    const enc = encryptConfig({ apiKey: "super-secret" });
    expect(String(enc.apiKey).includes("super-secret")).toBe(false);
  });
});

describe("integration credentials — decryptConfig", () => {
  it("passes through plain (non-envelope) values unchanged", () => {
    expect(decryptConfig({ projectId: "plain-value" })).toEqual({
      projectId: "plain-value",
    });
  });

  it("handles non-string values", () => {
    expect(decryptConfig({ count: 3, nested: { a: 1 } })).toEqual({
      count: 3,
      nested: { a: 1 },
    });
  });

  it("isEnvelope rejects non-envelope inputs", () => {
    expect(isEnvelope("sk-secret")).toBe(false);
    expect(isEnvelope(42)).toBe(false);
    expect(isEnvelope(null)).toBe(false);
    expect(isEnvelope("pl:mock:v1:c2VjcmV0")).toBe(true);
  });
});

run();
