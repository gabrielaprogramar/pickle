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
