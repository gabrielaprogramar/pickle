/**
 * passwords.test.ts — mock password hashing tests (Phase 4.5)
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { hashPassword, verifyPassword } from "../passwords";

describe("passwords — hashPassword", () => {
  it("produces a deterministic mock hash with the v1 prefix", () => {
    const a = hashPassword("demo1234");
    const b = hashPassword("demo1234");
    expect(a.startsWith("mock$v1$")).toBe(true);
    expect(a).toBe(b);
  });

  it("produces different hashes for different passwords", () => {
    expect(hashPassword("demo1234") === hashPassword("demo1235")).toBe(false);
  });
});

describe("passwords — verifyPassword", () => {
  it("verifies a matching password", () => {
    expect(verifyPassword("demo1234", hashPassword("demo1234"))).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(verifyPassword("wrong", hashPassword("demo1234"))).toBe(false);
  });

  it("rejects values without the mock prefix", () => {
    expect(verifyPassword("demo1234", "other$1$abcdef")).toBe(false);
    expect(verifyPassword("demo1234", "")).toBe(false);
    expect(verifyPassword("demo1234", "demo1234")).toBe(false);
  });
});

run();
