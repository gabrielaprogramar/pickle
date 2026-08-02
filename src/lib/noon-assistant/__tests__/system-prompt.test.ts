/**
 * system-prompt.test.ts — noon-assistant system prompt tests
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Run via: npx tsx src/lib/noon-assistant/__tests__/system-prompt.test.ts
 */

import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { buildNoonSystemPrompt } from "../system-prompt";
import { NOON_SYSTEM_PROMPT_VERSION } from "../types";
import { POSEIDON } from "../mock-data";

const prompt = buildNoonSystemPrompt({
  vesselName: POSEIDON.name,
  vesselImo: POSEIDON.imo,
});

describe("Noon system prompt", () => {
  it("identifies the assistant and the assigned vessel", () => {
    expect(prompt).toContainString("Noon Report Assistant");
    expect(prompt).toContainString(POSEIDON.name);
    expect(prompt).toContainString(POSEIDON.imo);
  });

  it("encodes the default version and allows overrides", () => {
    expect(prompt).toContainString(`(v${NOON_SYSTEM_PROMPT_VERSION})`);
    const custom = buildNoonSystemPrompt(
      { vesselName: POSEIDON.name, vesselImo: POSEIDON.imo },
      "9.9.9",
    );
    expect(custom).toContainString("(v9.9.9)");
  });

  it("enforces determinism and forbids fabrication", () => {
    expect(prompt).toContainString("deterministic noon engine output");
    expect(prompt).toContainString("never recompute or invent a value");
  });

  it("restricts scope to the assigned vessel and forbids other vessels", () => {
    expect(prompt).toContainString("assigned vessel");
    expect(prompt).toContainString("Refuse any request for another vessel");
  });

  it("documents hand-off boundaries", () => {
    expect(prompt).toContainString("Captain Assistant");
    expect(prompt).toContainString("Compliance Assistant");
    expect(prompt).toContainString("Search Assistant");
    expect(prompt).toContainString("Voyage Assistant");
  });

  it("keeps memory subordinate to deterministic analysis", () => {
    expect(prompt).toContainString("never override the deterministic analysis");
  });
});

run();
