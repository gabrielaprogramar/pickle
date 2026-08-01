import type { IntentType } from "@/lib/assistant/types";

export type HandoffTarget =
  | "voyage"
  | "maintenance"
  | "ocr"
  | "captain"
  | "none";

export interface HandoffDecision {
  readonly target: HandoffTarget;
  readonly confidence: number;
  readonly reason: string;
}

export interface HandoffDetector {
  detectHandoff(query: string, intent: IntentType): HandoffDecision;
}

const VOYAGE_KEYWORDS = [
  "ais", "voyage data", "track", "position", "sailing", "route",
  "destination", "port call",
];

const MAINTENANCE_KEYWORDS = [
  "certificate", "survey", "inspection", "maintenance", "dry dock", "repair",
];

const OCR_KEYWORDS = [
  "ocr", "extraction", "scan quality", "document image", "blurry", "illegible",
];

const CAPTAIN_KEYWORDS = [
  "captain", "crew", "manning", "port readiness", "operational",
];

/**
 * Certificate *status* queries are deterministic registry data that this
 * assistant explains (via certificate registry handoff statements). Queries
 * about certificate *survey/inspection/maintenance* actions still route to
 * the Maintenance Assistant.
 */
const CERTIFICATE_STATUS_KEYWORDS = [
  "certificate status",
  "certificate expiry",
  "certificate expire",
  "certificate expires",
  "certificate expiration",
  "certificates expiring",
  "expire soon",
  "expires soon",
  "expiring",
  "expired",
  "expiration",
  "expiry",
  "certificate registry",
  "which certificates",
  "certificate valid",
  "certificate validity",
  "valid certificate",
  "certificate missing",
  "missing certificate",
  "certificate pending review",
  "certificate review required",
  "certificate requires review",
  "iapp valid",
  "iscc valid",
  "is the iapp",
  "is my iapp",
  "is the iscc",
];

const KEYWORD_MAP: Record<HandoffTarget, ReadonlyArray<string>> = {
  voyage: VOYAGE_KEYWORDS,
  maintenance: MAINTENANCE_KEYWORDS,
  ocr: OCR_KEYWORDS,
  captain: CAPTAIN_KEYWORDS,
  none: [],
};

const INTENT_TARGET_MAP: Partial<Record<IntentType, HandoffTarget>> = {
  VOYAGE: "voyage",
  CAPTAIN: "captain",
};

function countKeywordMatches(query: string, keywords: ReadonlyArray<string>): number {
  const lower = query.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw)).length;
}

/** True when a query asks about certificate *status* (registry data explained here). */
export function isCertificateStatusQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return CERTIFICATE_STATUS_KEYWORDS.some((kw) => lower.includes(kw));
}

export function createHandoffDetector(): HandoffDetector {
  function detectHandoff(query: string, intent: IntentType): HandoffDecision {
    const intentTarget = INTENT_TARGET_MAP[intent];
    if (intentTarget) {
      return {
        target: intentTarget,
        confidence: 1.0,
        reason: `Query classified with intent "${intent}", which maps to ${intentTarget} specialist.`,
      };
    }

    if (isCertificateStatusQuery(query)) {
      return {
        target: "none",
        confidence: 1.0,
        reason: "Certificate status is deterministic registry data that the Compliance Assistant explains from derived statuses — not a survey/maintenance action.",
      };
    }

    let bestTarget: HandoffTarget = "none";
    let bestScore = 0;
    let bestReason = "";

    for (const [target, keywords] of Object.entries(KEYWORD_MAP)) {
      if (target === "none") continue;
      const matches = countKeywordMatches(query, keywords);
      if (matches > 0) {
        const ratio = matches / keywords.length;
        if (ratio > bestScore) {
          bestScore = ratio;
          bestTarget = target as HandoffTarget;
          bestReason = `Query matched ${matches} keyword(s) indicating ${target} domain (confidence: ${(ratio * 100).toFixed(0)}%).`;
        }
      }
    }

    if (bestTarget === "none") {
      return {
        target: "none",
        confidence: 1.0,
        reason: "No handoff target matched the query. Keeping with compliance assistant.",
      };
    }

    return {
      target: bestTarget,
      confidence: Math.min(bestScore * 2, 1.0),
      reason: bestReason,
    };
  }

  return { detectHandoff };
}
