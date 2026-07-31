import type { CaptainVessel } from "./types";
import { CAPTAIN_MOCK_VESSELS } from "./mock-data";

export interface CaptainSafetyCheck {
  readonly safe: boolean;
  readonly reason: string | null;
}

const INJECTION_PATTERNS: ReadonlyArray<string> = [
  "ignore previous",
  "ignore all previous",
  "disregard",
  "forget your instructions",
  "forget your rules",
  "system prompt",
  "system prompt:",
  "act as an openai",
  "jailbreak",
  "you are now",
  "reveal your",
  "print your",
  "output your instructions",
  "developer mode",
  "sql injection",
  "drop table",
  "union select",
  "select * from",
  "delete from",
  "insert into",
  "truncate ",
  "credentials",
  "password",
  "api key",
  "secret key",
];

const PII_PATTERNS: ReadonlyArray<string> = [
  "passport",
  "social security",
  "credit card",
  "phone number",
  "home address",
];

export interface CaptainSafetyGuard {
  check(query: string, assignedVessel: CaptainVessel): CaptainSafetyCheck;
  detectOtherVessel(query: string, assignedVessel: CaptainVessel): string | null;
}

export function createCaptainSafetyGuard(): CaptainSafetyGuard {
  function detectOtherVessel(query: string, assignedVessel: CaptainVessel): string | null {
    const lower = query.toLowerCase();
    for (const vessel of CAPTAIN_MOCK_VESSELS) {
      if (vessel.vesselId === assignedVessel.vesselId) continue;
      if (lower.includes(vessel.name.toLowerCase()) || lower.includes(vessel.imo)) {
        return vessel.name;
      }
    }
    const imoMatch = lower.match(/\b9\d{6}\b|\b7\d{6}\b|\b6\d{6}\b/);
    if (imoMatch && imoMatch[0] !== assignedVessel.imo) {
      return `IMO ${imoMatch[0]}`;
    }
    return null;
  }

  function check(query: string, assignedVessel: CaptainVessel): CaptainSafetyCheck {
    const lower = query.toLowerCase();

    const injection = INJECTION_PATTERNS.filter((p) => lower.includes(p));
    if (injection.length > 0) {
      return {
        safe: false,
        reason: `I can only help with your vessel's next operation. I cannot follow injected instructions (${injection.join(", ")}).`,
      };
    }

    const pii = PII_PATTERNS.filter((p) => lower.includes(p));
    if (pii.length > 0) {
      return {
        safe: false,
        reason: `I cannot access or reveal personal data (${pii.join(", ")}).`,
      };
    }

    const other = detectOtherVessel(query, assignedVessel);
    if (other) {
      return {
        safe: false,
        reason: `I only have information for your assigned vessel ${assignedVessel.name} (${assignedVessel.imo}). I cannot access data for ${other}.`,
      };
    }

    return { safe: true, reason: null };
  }

  return { check, detectOtherVessel };
}
