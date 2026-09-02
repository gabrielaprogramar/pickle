/**
 * passwords.test.ts — bcrypt password hashing + legacy mock re-hash detection
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  hashPassword,
  verifyPassword,
  isLegacyMockHash,
  isBcryptHash,
  needsRehash,
} from "../passwords";

describe("passwords — hashPassword (bcrypt)", () => {
  it("produces a bcrypt hash (not a mock hash)", () => {
    const h = hashPassword("demo1234");
    expect(isBcryptHash(h)).toBe(true);
    expect(isLegacyMockHash(h)).toBe(false);
  });

  it("is salted (same password yields different hashes)", () => {
    const a = hashPassword("demo1234");
    const b = hashPassword("demo1234");
    expect(a === b).toBe(false);
  });
});

describe("passwords — verifyPassword", () => {
  it("verifies a matching password", () => {
    expect(verifyPassword("demo1234", hashPassword("demo1234"))).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(verifyPassword("wrong", hashPassword("demo1234"))).toBe(false);
  });

  it("rejects non-hash stored values", () => {
    expect(verifyPassword("demo1234", "")).toBe(false);
    expect(verifyPassword("demo1234", "demo1234")).toBe(false);
    expect(verifyPassword("demo1234", "other$1$abcdef")).toBe(false);
  });
});

describe("passwords — legacy mock$v1$ handling", () => {
  // Reproduce the legacy mock hash for a known password so we can prove that
  // a dev DB seeded with the old format still verifies and is flagged.
  const LEGACY_SALT = "poseidon-ledger::phase-4.5";
  function legacyDigest(input: string): string {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }
  const LEGACY = `mock$v1$${legacyDigest(LEGACY_SALT + "::demo1234")}`;

  it("detects legacy mock hashes for re-hash", () => {
    expect(isLegacyMockHash(LEGACY)).toBe(true);
    expect(needsRehash(LEGACY)).toBe(true);
  });

  it("does not flag bcrypt hashes for re-hash", () => {
    expect(needsRehash(hashPassword("demo1234"))).toBe(false);
  });

  it("still verifies a legacy mock hash (backward-compatible login)", () => {
    expect(verifyPassword("demo1234", LEGACY)).toBe(true);
  });
});

run();
