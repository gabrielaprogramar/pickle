/**
 * tokens.test.ts — session/reset token tests (Phase 4.5)
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import {
  PASSWORD_RESET_TTL_MS,
  SESSION_TTL_MS,
  generateToken,
  hashToken,
  resetExpiry,
  sessionExpiry,
} from "../tokens";

describe("tokens — generateToken", () => {
  it("returns a non-empty base64url string", () => {
    const token = generateToken();
    expect(token.length > 0).toBe(true);
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  it("is unique across calls", () => {
    expect(generateToken() === generateToken()).toBe(false);
  });
});

describe("tokens — hashToken", () => {
  it("is deterministic and stable", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("differs between tokens", () => {
    expect(hashToken("abc") === hashToken("abd")).toBe(false);
  });

  it("never exposes the raw token", () => {
    const token = "super-secret-token";
    const digest = hashToken(token);
    expect(digest.includes(token)).toBe(false);
  });
});

describe("tokens — expiry helpers", () => {
  it("computes the 12h session expiry", () => {
    const now = "2026-08-01T00:00:00.000Z";
    const expected = new Date(new Date(now).getTime() + SESSION_TTL_MS).toISOString();
    expect(sessionExpiry(now)).toBe(expected);
  });

  it("computes the 1h reset expiry", () => {
    const now = "2026-08-01T00:00:00.000Z";
    const expected = new Date(new Date(now).getTime() + PASSWORD_RESET_TTL_MS).toISOString();
    expect(resetExpiry(now)).toBe(expected);
  });
});

run();
