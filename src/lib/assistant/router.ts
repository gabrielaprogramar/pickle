import type { IntentType, IntentClassification, RouterInput, RouterOutput } from "./types";
import type { LlmProvider } from "./llm-provider";

export interface RouterOptions {
  readonly llmProvider?: LlmProvider;
  readonly useMock: boolean;
}

export interface Router {
  classify(input: RouterInput): Promise<RouterOutput>;
  getSupportedIntents(): ReadonlyArray<IntentType>;
  detectHandoff(query: string, intent: IntentType): { target: string; confidence: number; reason: string };
}

const SUPPORTED_INTENTS: ReadonlyArray<IntentType> = [
  "REGULATORY",
  "COMPLIANCE",
  "VOYAGE",
  "DOCUMENT",
  "SEARCH",
  "CAPTAIN",
  "UNKNOWN",
];

const INTENT_KEYWORDS: Record<IntentType, ReadonlyArray<string>> = {
  REGULATORY: ["regulation", "directive", "marpol", "annex", "fuel eu", "ets", "compliance requirement", "regulatory", "ghg", "emission"],
  COMPLIANCE: ["compliance", "score", "violation", "penalty", "balance", "surplus", "deficit", "non-compliant", "obligation"],
  VOYAGE: ["voyage", "route", "port", "destination", "sailing", "departure", "arrival", "eta", "etd"],
  DOCUMENT: ["document", "upload", "report", "bunker", "bdn", "certificate", "file", "submission"],
  SEARCH: ["search", "find", "look up", "what is", "how to", "tell me about", "explain"],
  CAPTAIN: ["captain", "crew", "manning", "certificate", "license", "seafarer", "officer", "master"],
  UNKNOWN: [],
};

export function createRouter(opts: Partial<RouterOptions> = {}): Router {
  const useMock = opts.useMock ?? true;

  function classifyByKeywords(query: string): RouterOutput {
    const lower = query.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    const totalWords = words.length;

    let bestIntent: IntentType = "UNKNOWN";
    let bestScore = 0;

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      let matches = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          matches++;
        }
      }
      if (matches > bestScore) {
        bestScore = matches;
        bestIntent = intent as IntentType;
      }
    }

    const confidence = totalWords > 0 ? Math.min(bestScore / totalWords, 1.0) : 0;

    return {
      intent: bestIntent,
      confidence: Math.max(confidence, bestScore > 0 ? 0.3 : 0),
      specialistRequired: bestIntent !== "UNKNOWN" && confidence < 0.5,
    };
  }

  function detectHandoff(query: string, intent: IntentType): { target: string; confidence: number; reason: string } {
    if (intent !== "COMPLIANCE" && intent !== "UNKNOWN" && intent !== "DOCUMENT") {
      return { target: "none", confidence: 1.0, reason: "Intent already handled by current assistant" };
    }

    const lower = query.toLowerCase();
    const triggers: Array<{ keywords: string[]; target: string; reason: string }> = [
      { keywords: ["ais", "voyage data", "track", "position", "sailing", "route", "destination", "port call", "eta", "etd"], target: "voyage", reason: "Query relates to voyage/AIS data which is handled by the Voyage Assistant" },
      { keywords: ["certificate", "survey", "inspection", "maintenance", "dry dock", "repair", "classification"], target: "maintenance", reason: "Query relates to certificates or maintenance which is handled by the Maintenance Assistant" },
      { keywords: ["ocr", "extraction", "scan quality", "blurry", "illegible", "image quality"], target: "ocr", reason: "Query relates to document extraction quality which is handled by the OCR Assistant" },
      { keywords: ["captain", "crew", "manning", "port readiness", "operational", "seafarer", "officer", "master"], target: "captain", reason: "Query relates to crew or operational readiness which is handled by the Captain Assistant" },
    ];

    for (const trigger of triggers) {
      const matches = trigger.keywords.filter(kw => lower.includes(kw)).length;
      if (matches > 0) {
        return { target: trigger.target, confidence: Math.min(matches / trigger.keywords.length + 0.1, 1.0), reason: trigger.reason };
      }
    }

    return { target: "none", confidence: 0, reason: "" };
  }

  return {
    async classify(input: RouterInput): Promise<RouterOutput> {
      if (useMock) {
        return classifyByKeywords(input.query);
      }

      if (opts.llmProvider) {
        try {
          const systemMsg = `Classify the user query into one of these intents: ${SUPPORTED_INTENTS.join(", ")}. Respond with only the intent name.`;
          const response = await opts.llmProvider.generate({
            messages: [
              { role: "system", content: systemMsg },
              { role: "user", content: input.query },
            ],
            temperature: 0.1,
            maxTokens: 50,
          });

          const intent = response.content.trim().toUpperCase() as IntentType;
          if (SUPPORTED_INTENTS.includes(intent)) {
            return { intent, confidence: 0.9, specialistRequired: false };
          }
        } catch {
          return classifyByKeywords(input.query);
        }
      }

      return classifyByKeywords(input.query);
    },

    getSupportedIntents(): ReadonlyArray<IntentType> {
      return SUPPORTED_INTENTS;
    },

    detectHandoff,
  };
}
