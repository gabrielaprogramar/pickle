/**
 * classification.ts — deterministic document-family classifier
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Determines which document family an OCR scan belongs to by matching weighted
 * content signals. The classifier never relies on the declared type: a file
 * uploaded as one type is classified from its content alone, so mismatches can
 * be surfaced instead of asserted away.
 *
 * HOW IT FITS
 * quality.ts uses the classification to pick expected fields. ocr-tools.ts
 * exposes classify_document. The mock Wrong-Document-Type fixture relies on it.
 */

import type { OcrClassification, OcrDocumentFamily, OcrDocumentInput } from "./types";
import { OCR_DOCUMENT_FAMILIES } from "./types";

interface FamilySignal {
  readonly pattern: RegExp;
  readonly weight: number;
  readonly label: string;
}

/** Content signals per family. Weight = importance; 3 = decisive. */
const FAMILY_SIGNALS: Readonly<Record<OcrDocumentFamily, ReadonlyArray<FamilySignal>>> = {
  BDN: [
    { pattern: /\bbunker\s+delivery\s+note\b/i, weight: 3, label: "bunker delivery note" },
    { pattern: /\bbdr\b|\bbunker\s+delivery\s+receipt\b/i, weight: 3, label: "bunker delivery receipt" },
    { pattern: /\b(ifo\s?380|vlsfo|ulsfo|lsfo|hfo|mgo|mdo|lng|lpg)\b/i, weight: 2, label: "marine fuel grade" },
    { pattern: /(quantity|tonnes|metric tons?)\s*(delivered)?/i, weight: 1, label: "delivery quantity" },
    { pattern: /\b(supplier|barge|bunker\s+tanker|delivered\s+by)\b/i, weight: 1, label: "delivery supplier" },
  ],
  NOON_REPORT: [
    { pattern: /\bnoon\s+report\b/i, weight: 3, label: "noon report" },
    { pattern: /\bposition\b/i, weight: 2, label: "position" },
    { pattern: /\b(distance|rpm|consumption|fuel\s+consumption|speed)\b/i, weight: 1, label: "voyage metrics" },
    { pattern: /\blatitude\b|\blongitude\b|\blat\b|\blon\b/i, weight: 1, label: "coordinates" },
  ],
  LOGBOOK: [
    { pattern: /\b(log\s?book|bridge\s+log|deck\s+log)\b/i, weight: 3, label: "logbook" },
    { pattern: /\bentry\b/i, weight: 1, label: "log entries" },
    { pattern: /\bwatch\b/i, weight: 1, label: "watch records" },
    { pattern: /\bofficer\s+of\s+the\s+watch\b|\boow\b/i, weight: 1, label: "officer of the watch" },
  ],
  MRV: [
    { pattern: /\b(mrv|monitoring,\s*reporting\s+and\s+verification)\b/i, weight: 3, label: "EU MRV" },
    { pattern: /\bco2\b|\bco₂\b/i, weight: 2, label: "CO2 emissions" },
    { pattern: /\b(reporting\s+period|annual\s+report|verifier)\b/i, weight: 1, label: "MRV report fields" },
  ],
  FUEL_EU: [
    { pattern: /\b(fuel\s?eu\s?maritime|fueleu|fuel\s?eu)\b/i, weight: 3, label: "FuelEU Maritime" },
    { pattern: /\b(ghg\s?intensity|greenhouse\s+gas)\b/i, weight: 2, label: "GHG intensity" },
    { pattern: /\b(well-to-wake|wtw|tank-to-wake|ttw)\b/i, weight: 2, label: "well-to-wake basis" },
    { pattern: /\bpenalty\b.*\b(eur|euros?|€)\b/i, weight: 1, label: "compliance penalty" },
  ],
  EU_ETS: [
    { pattern: /\beu\s?ets\b/i, weight: 3, label: "EU ETS" },
    { pattern: /\b(allowances?|eua|eu\s+allowance)\b/i, weight: 2, label: "EU allowances" },
    { pattern: /\bverified\s+emissions\b|\bemissions\b/i, weight: 1, label: "emissions" },
    { pattern: /\bverifier\b/i, weight: 1, label: "verifier" },
  ],
  CERTIFICATE: [
    { pattern: /\b(certificate|cert)\b/i, weight: 3, label: "certificate" },
    { pattern: /\b(iapp|iopp|ioppc|smc|issc|itc|clc|iee|ieep|doc)\b/i, weight: 3, label: "certificate code" },
    { pattern: /\b(class\s+society|dnv|lloyd|bureau\s+veritas|classnk|rina|american\s+bureau)\b/i, weight: 2, label: "class society" },
    { pattern: /\b(issued|valid\s+until|date\s+of\s+issue)\b/i, weight: 1, label: "issue/validity dates" },
  ],
  INVOICE: [
    { pattern: /\binvoice\b/i, weight: 3, label: "invoice" },
    { pattern: /\b(bill\s+to|payment\s+terms|invoice\s+number)\b/i, weight: 2, label: "invoice fields" },
    { pattern: /\bamount\b.*\b(usd|eur|gbp|\$|€)\b/i, weight: 2, label: "amount currency" },
    { pattern: /\bvat\b|\btax\b|\bdue\s+date\b/i, weight: 1, label: "vat/tax/due date" },
  ],
  BUNKER_ANALYSIS: [
    { pattern: /\b(bunker\s+analysis|analysis\s+report|test\s+report|bunker\s+test)\b/i, weight: 3, label: "bunker analysis" },
    { pattern: /\b(viscosity|flash\s+point)\b/i, weight: 2, label: "fuel test properties" },
    { pattern: /\bsulphur\b.*\b%\b|\bsulfur\b.*\b%\b/i, weight: 1, label: "sulphur content" },
    { pattern: /\bdensity\b.*\b(kg|g\/cm|°c|15)\b/i, weight: 1, label: "density at 15°C" },
  ],
  STATEMENT: [
    { pattern: /\b(statement|account\s+statement)\b/i, weight: 3, label: "statement" },
    { pattern: /\b(opening\s+balance|closing\s+balance|balance)\b/i, weight: 2, label: "balance" },
    { pattern: /\b(credit|debit)\b/i, weight: 1, label: "credit/debit entries" },
  ],
  OTHER: [],
  UNKNOWN: [],
};

/** Human-readable label for a family. */
export function familyLabel(family: OcrDocumentFamily): string {
  switch (family) {
    case "BDN":
      return "Bunker Delivery Note";
    case "NOON_REPORT":
      return "Noon Report";
    case "LOGBOOK":
      return "Logbook";
    case "MRV":
      return "EU MRV Report";
    case "FUEL_EU":
      return "FuelEU Maritime Report";
    case "EU_ETS":
      return "EU ETS Report";
    case "CERTIFICATE":
      return "Certificate";
    case "INVOICE":
      return "Invoice";
    case "BUNKER_ANALYSIS":
      return "Bunker Analysis";
    case "STATEMENT":
      return "Statement";
    case "OTHER":
      return "Other";
    case "UNKNOWN":
      return "Unknown";
  }
}

export const DEFAULT_CLASSIFICATION_THRESHOLD = 0.25;

/** Families with at least one content signal (excludes OTHER/UNKNOWN). */
function signalFamilies(): ReadonlyArray<OcrDocumentFamily> {
  return OCR_DOCUMENT_FAMILIES.filter(
    (f) => f !== "OTHER" && f !== "UNKNOWN" && FAMILY_SIGNALS[f].length > 0,
  );
}

/**
 * Classify a document from its content only. Returns UNKNOWN when no family
 * reaches the confidence threshold — the assistant never guesses.
 */
export function classifyDocument(input: OcrDocumentInput, threshold = DEFAULT_CLASSIFICATION_THRESHOLD): OcrClassification {
  const text = input.rawText ?? "";

  const scored = signalFamilies()
    .map((family) => {
      const signals = FAMILY_SIGNALS[family];
      let matchedWeight = 0;
      let totalWeight = 0;
      const matched: string[] = [];
      for (const s of signals) {
        totalWeight += s.weight;
        if (s.pattern.test(text)) {
          matchedWeight += s.weight;
          matched.push(s.label);
        }
      }
      const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;
      return { family, confidence, matchedWeight, matched, totalWeight };
    })
    .filter((s) => s.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence || b.matchedWeight - a.matchedWeight);

  if (scored.length === 0) {
    return {
      family: "UNKNOWN",
      confidence: 0,
      matchedSignals: [],
      reason: "No document family reached the classification threshold; nothing was guessed.",
    };
  }

  const best = scored[0];
  if (!best) {
    return {
      family: "UNKNOWN",
      confidence: 0,
      matchedSignals: [],
      reason: "No document family reached the classification threshold; nothing was guessed.",
    };
  }
  const runnerUp = scored[1];
  const tied = runnerUp !== undefined && Math.abs(runnerUp.confidence - best.confidence) < 0.001;
  const winner = tied && runnerUp.matchedWeight > best.matchedWeight ? runnerUp : best;

  return {
    family: winner.family,
    confidence: Number(winner.confidence.toFixed(3)),
    matchedSignals: winner.matched,
    reason: `Matched ${winner.matched.length} signal group(s) (${winner.matched.join(", ") || "none"}) with confidence ${winner.confidence.toFixed(2)}.`,
  };
}
