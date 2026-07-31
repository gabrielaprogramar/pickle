import type { VoyageVessel } from "./types";
import { VOYAGE_MOCK_VESSELS } from "./mock-data";

export interface VoyageSafetyCheck {
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

const OUT_OF_SCOPE_PATTERNS: ReadonlyArray<string> = [
  "crew schedule",
  "crew wages",
  "seafarer contract",
  "cargo booking",
  "freight rate",
  "charter hire",
  "insurance claim",
  "tonnage tax",
];

const NO_FABRICATION_PATTERNS: ReadonlyArray<string> = [
  "make up positions",
  "fabricate positions",
  "invent positions",
  "fill in the gap with",
  "synthesize positions",
  "fake ais",
  "fake positions",
  "pretend the vessel",
  "assume the vessel was at",
  "generate positions",
  "simulate ais",
  "imagine a position",
  "add a position",
  "invent an ais",
];

export interface VoyageSafetyGuard {
  check(query: string, assignedVessel: VoyageVessel): VoyageSafetyCheck;
  detectOtherVessel(query: string, assignedVessel: VoyageVessel): string | null;
}

export function createVoyageSafetyGuard(): VoyageSafetyGuard {
  function detectOtherVessel(query: string, assignedVessel: VoyageVessel): string | null {
    const lower = query.toLowerCase();
    for (const vessel of VOYAGE_MOCK_VESSELS) {
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

  function check(query: string, assignedVessel: VoyageVessel): VoyageSafetyCheck {
    const lower = query.toLowerCase();

    const injection = INJECTION_PATTERNS.filter((p) => lower.includes(p));
    if (injection.length > 0) {
      return {
        safe: false,
        reason: `I can only help with voyage ledger and AIS data integrity. I cannot follow injected instructions (${injection.join(", ")}).`,
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

    const fabrication = NO_FABRICATION_PATTERNS.filter((p) => lower.includes(p));
    if (fabrication.length > 0) {
      return {
        safe: false,
        reason: `I cannot fabricate AIS positions or invent vessel locations (${fabrication.join(", ")}). Gaps are substantiated with source records, never invented.`,
      };
    }

    const outOfScope = OUT_OF_SCOPE_PATTERNS.filter((p) => lower.includes(p));
    if (outOfScope.length > 0) {
      return {
        safe: false,
        reason: `This is outside the voyage console scope (${outOfScope.join(", ")}). I handle voyage records, AIS data gaps, port calls, consistency and ETS coverage facts.`,
      };
    }

    return { safe: true, reason: null };
  }

  return { check, detectOtherVessel };
}
