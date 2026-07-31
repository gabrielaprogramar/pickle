import type { MaintenanceVessel } from "./types";
import { MAINTENANCE_MOCK_VESSELS } from "./mock-data";

export interface MaintenanceSafetyCheck {
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
  "work order",
  "spare part",
  "inventory",
  "technician schedule",
  "predictive maintenance",
  "cmmms",
  "cmm",
  "bill me",
  "invoice",
];

export interface MaintenanceSafetyGuard {
  check(query: string, assignedVessel: MaintenanceVessel): MaintenanceSafetyCheck;
  detectOtherVessel(query: string, assignedVessel: MaintenanceVessel): string | null;
}

export function createMaintenanceSafetyGuard(): MaintenanceSafetyGuard {
  function detectOtherVessel(query: string, assignedVessel: MaintenanceVessel): string | null {
    const lower = query.toLowerCase();
    for (const vessel of MAINTENANCE_MOCK_VESSELS) {
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

  function check(query: string, assignedVessel: MaintenanceVessel): MaintenanceSafetyCheck {
    const lower = query.toLowerCase();

    const injection = INJECTION_PATTERNS.filter((p) => lower.includes(p));
    if (injection.length > 0) {
      return {
        safe: false,
        reason: `I can only help with survey and certificate status. I cannot follow injected instructions (${injection.join(", ")}).`,
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

    const outOfScope = OUT_OF_SCOPE_PATTERNS.filter((p) => lower.includes(p));
    if (outOfScope.length > 0) {
      return {
        safe: false,
        reason: `This is a CMMS-style request (${outOfScope.join(", ")}). The Maintenance Assistant does not manage work orders, spare parts or technicians.`,
      };
    }

    return { safe: true, reason: null };
  }

  return { check, detectOtherVessel };
}
