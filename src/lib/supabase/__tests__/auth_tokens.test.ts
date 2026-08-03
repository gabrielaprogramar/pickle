/**
 * auth_tokens.test.ts — supabase AuthTokenRepository tests (Phase 4.5)
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createFakeSupabaseClient } from "./_fakeClient";
import { createAuthTokenRepository } from "../repositories/auth_tokens";
import { hashToken } from "@/lib/auth/tokens";

const NOW = "2026-08-01T12:00:00.000Z";
const FUTURE = "2026-08-02T12:00:00.000Z";

function tokenRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    token: hashToken("raw-token"),
    kind: "session",
    organization_id: "org-1",
    user_id: "user-1",
    email: "a@poseidon.com",
    expires_at: FUTURE,
    created_at: NOW,
    revoked_at: null,
    ...overrides,
  };
}

describe("AuthTokenRepository — insert / findByToken", () => {
  it("inserts a token", async () => {
    const fake = createFakeSupabaseClient();
    const repo = createAuthTokenRepository({ client: fake });

    const row = await repo.insert({
      token: hashToken("raw-token"),
      kind: "session",
      email: "a@poseidon.com",
      expires_at: FUTURE,
    });

    expect(row.token).toBe(hashToken("raw-token"));
    expect(row.organization_id).toBeNull();
    expect(row.user_id).toBeNull();
    expect(row.revoked_at).toBeNull();
  });

  it("finds a raw token by its hashed value", async () => {
    const fake = createFakeSupabaseClient({ tables: { auth_tokens: [tokenRow()] } });
    const repo = createAuthTokenRepository({ client: fake });

    const row = await repo.findByToken(hashToken("raw-token"));
    expect(row!.kind).toBe("session");
  });
});

describe("AuthTokenRepository — findValidByToken", () => {
  it("returns only non-revoked, unexpired tokens", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        auth_tokens: [
          tokenRow({ token: hashToken("valid") }),
          tokenRow({ token: hashToken("revoked"), revoked_at: NOW }),
          tokenRow({ token: hashToken("expired"), expires_at: "2026-01-01T00:00:00.000Z" }),
        ],
      },
    });
    const repo = createAuthTokenRepository({ client: fake });

    expect((await repo.findValidByToken(hashToken("valid"), { now: NOW }))!.token).toBe(hashToken("valid"));
    expect(await repo.findValidByToken(hashToken("revoked"), { now: NOW })).toBeNull();
    expect(await repo.findValidByToken(hashToken("expired"), { now: NOW })).toBeNull();
  });
});

describe("AuthTokenRepository — listValidByKind / revoke", () => {
  it("lists valid tokens of a kind for an email", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        auth_tokens: [
          tokenRow({ token: hashToken("session-a"), kind: "session" }),
          tokenRow({ token: hashToken("session-b"), kind: "session", revoked_at: NOW }),
          tokenRow({ token: hashToken("reset-a"), kind: "password_reset" }),
        ],
      },
    });
    const repo = createAuthTokenRepository({ client: fake });

    const sessions = await repo.listValidByKind("session", "a@poseidon.com", { now: NOW });
    expect(sessions.length).toBe(1);
    expect(sessions[0]!.token).toBe(hashToken("session-a"));
  });

  it("revokes a token", async () => {
    const fake = createFakeSupabaseClient({ tables: { auth_tokens: [tokenRow()] } });
    const repo = createAuthTokenRepository({ client: fake });

    const revoked = await repo.revoke(hashToken("raw-token"));
    expect(revoked!.revoked_at).toBeTruthy();
    expect(await repo.findValidByToken(hashToken("raw-token"), { now: NOW })).toBeNull();
  });
});

run();
