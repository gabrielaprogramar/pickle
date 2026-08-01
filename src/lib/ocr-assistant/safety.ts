import { OCR_MOCK_DOCUMENTS } from "./mock-data";

export interface OcrSafetyCheck {
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

/** Requests the OCR assistant never handles — crew/HR/commercial billing. */
const OUT_OF_SCOPE_PATTERNS: ReadonlyArray<string> = [
  "payroll",
  "salary",
  "crew contract",
  "crew list",
  "seafarer",
  "employment",
  "hire",
  "vacation",
  "health insurance",
  "wage",
  "collective bargaining",
  "medical record",
];

export interface OcrSafetyGuard {
  check(query: string): OcrSafetyCheck;
}

export function createOcrSafetyGuard(): OcrSafetyGuard {
  function check(query: string): OcrSafetyCheck {
    const lower = query.toLowerCase();

    const injection = INJECTION_PATTERNS.filter((p) => lower.includes(p));
    if (injection.length > 0) {
      return {
        safe: false,
        reason: `I can only assess OCR quality and suggest corrections. I cannot follow injected instructions (${injection.join(", ")}).`,
      };
    }

    const pii = PII_PATTERNS.filter((p) => lower.includes(p));
    if (pii.length > 0) {
      return {
        safe: false,
        reason: `I cannot access or reveal personal data (${pii.join(", ")}).`,
      };
    }

    const outOfScope = OUT_OF_SCOPE_PATTERNS.filter((p) => lower.includes(p));
    if (outOfScope.length > 0) {
      return {
        safe: false,
        reason: `This is a crew or HR topic (${outOfScope.join(", ")}). The OCR Assistant only works with scanned compliance documents and their extraction quality.`,
      };
    }

    return { safe: true, reason: null };
  }

  return { check };
}

export { OCR_MOCK_DOCUMENTS };
