/**
 * suggestions.ts — deterministic OCR repair suggestions
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Produces corrections for common OCR defects: IMO number checksum errors,
 * non-ISO dates, fuel / port spelling from the synonym dictionary, certificate
 * number spacing and merged characters. Suggestions are advisory only — the
 * assistant proposes, the human reviewer disposes.
 *
 * HOW IT FITS
 * ocr-tools.ts (suggest_corrections) and the API layer both call
 * generateRepairSuggestions. Every suggestion has a stable id, a confidence
 * and a human-readable reason.
 */

import { lookupFuelFuzzy, lookupPort, lookupPortFuzzy, normalizeToken } from "./dictionary";
import { classifyDocument } from "./classification";
import type { OcrDocumentInput, OcrRepairKind, OcrRepairSuggestion } from "./types";

// ── IMO checksum (IMO Resolution A.1078(28)) ─────────────────────────────────

/** Check digit for the first six digits of an IMO number. */
export function imoCheckDigit(firstSix: string): number {
  const digits = firstSix.split("").map(Number);
  if (digits.length !== 6 || digits.some((d) => Number.isNaN(d))) return -1;
  const weighted = digits.reduce((acc, d, i) => acc + (7 - i) * d, 0);
  return weighted % 10;
}

/** Whether a 7-digit IMO number passes the checksum. */
export function imoChecksumValid(digits: string): boolean {
  if (!/^\d{7}$/.test(digits)) return false;
  return imoCheckDigit(digits.slice(0, 6)) === Number(digits[6]);
}

const IMO_PREFIX = /imo[\s:.]{0,3}/i;

/** Collect 7-digit IMO candidates from text or IMO-typed extraction fields. */
function collectImoCandidates(input: OcrDocumentInput): Array<{ value: string; fieldKey: string }> {
  const found: Array<{ value: string; fieldKey: string }> = [];
  const push = (value: string, fieldKey: string) => {
    const digits = value.replace(/\D/g, "");
    if (/^\d{7}$/.test(digits) && !found.some((f) => f.value === digits)) {
      found.push({ value: digits, fieldKey });
    }
  };

  for (const [key, val] of Object.entries(input.extractedData)) {
    if (typeof val === "string" && /imo/i.test(key)) push(val, key);
  }

  const text = input.rawText ?? "";
  const lines = text.split(/\n/);
  for (const line of lines) {
    const idx = line.search(IMO_PREFIX);
    if (idx >= 0) {
      const after = line.slice(idx + line.slice(idx).match(IMO_PREFIX)![0].length);
      push(after, "imoNumber");
    }
  }
  return found;
}

export function imoChecksumSuggestions(input: OcrDocumentInput): OcrRepairSuggestion[] {
  const out: OcrRepairSuggestion[] = [];
  const candidates = collectImoCandidates(input);
  for (const c of candidates) {
    if (imoChecksumValid(c.value)) continue;
    const corrected = c.value.slice(0, 6) + imoCheckDigit(c.value.slice(0, 6));
    out.push({
      id: `imo_checksum_${out.length + 1}`,
      kind: "IMO_CHECKSUM",
      fieldKey: c.fieldKey,
      original: c.value,
      suggested: corrected,
      confidence: 0.95,
      severity: "error",
      reason: `IMO number ${c.value} fails the checksum (IMO Resolution A.1078(28)); the check digit ${c.value[6]} should be ${corrected[6]}.`,
    });
  }
  return out;
}

// ── Date format ──────────────────────────────────────────────────────────────

const SEPARATOR_DATE = /\b(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{2}|\d{4})\b/g;
const MONTH_DAY_YEAR = /\b(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/gi;
const MONTH_NAME_FIRST = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function fieldKeyForText(input: OcrDocumentInput, snippet: string): string {
  for (const [key, val] of Object.entries(input.extractedData)) {
    if (typeof val === "string" && val.includes(snippet.trim())) return key;
  }
  return "date";
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function dateFormatSuggestions(input: OcrDocumentInput): OcrRepairSuggestion[] {
  const out: OcrRepairSuggestion[] = [];
  const seen = new Set<string>();
  const text = input.rawText ?? "";

  const push = (original: string, iso: string, fieldKey: string, confidence: number, reason: string) => {
    if (seen.has(original)) return;
    seen.add(original);
    out.push({
      id: `date_format_${out.length + 1}`,
      kind: "DATE_FORMAT",
      fieldKey,
      original,
      suggested: iso,
      confidence,
      severity: "warning",
      reason,
    });
  };

  for (const m of text.matchAll(SEPARATOR_DATE)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const yearRaw = m[3] ?? "";
    let day: number;
    let month: number;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      day = b;
      month = a;
    } else {
      continue;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    if (!/^\d{2,4}$/.test(yearRaw)) continue;
    const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
    const iso = `${year}-${pad2(month)}-${pad2(day)}`;
    push(m[0], iso, fieldKeyForText(input, m[0]), 0.8, `Non-ISO date "${m[0]}" should be recorded as ${iso}.`);
  }

  for (const m of text.matchAll(MONTH_DAY_YEAR)) {
    const day = Number(m[1]);
    const month = MONTHS[(m[2] ?? "").toLowerCase().slice(0, 3)];
    const year = Number(m[3]);
    if (month === undefined || day < 1 || day > 31) continue;
    const iso = `${year}-${pad2(month)}-${pad2(day)}`;
    push(m[0], iso, fieldKeyForText(input, m[0]), 0.85, `Date "${m[0]}" should be recorded in ISO format as ${iso}.`);
  }

  for (const m of text.matchAll(MONTH_NAME_FIRST)) {
    const month = MONTHS[(m[1] ?? "").toLowerCase().slice(0, 3)];
    const day = Number(m[2]);
    const year = Number(m[3]);
    if (month === undefined || day < 1 || day > 31) continue;
    const iso = `${year}-${pad2(month)}-${pad2(day)}`;
    push(m[0], iso, fieldKeyForText(input, m[0]), 0.85, `Date "${m[0]}" should be recorded in ISO format as ${iso}.`);
  }

  return out;
}

// ── Fuel spelling ────────────────────────────────────────────────────────────

const FUEL_KEYS = new Set(["fuelType", "fuel_type", "grade", "consumedFuel", "bunkerGrade"]);

function scanFuelValues(input: OcrDocumentInput): Array<{ raw: string; fieldKey: string }> {
  const out: Array<{ raw: string; fieldKey: string }> = [];
  for (const [key, val] of Object.entries(input.extractedData)) {
    if (FUEL_KEYS.has(key) && typeof val === "string" && val.trim().length > 0) {
      out.push({ raw: val.trim(), fieldKey: key });
    }
  }
  const fuelText = (input.rawText ?? "").match(/[A-Za-z]{2,7}\d?/g) ?? [];
  for (const tok of fuelText) {
    if (tok.length >= 3 && !out.some((o) => normalizeToken(o.raw) === normalizeToken(tok))) {
      out.push({ raw: tok, fieldKey: "fuelType" });
    }
  }
  return out;
}

export function fuelSpellingSuggestions(input: OcrDocumentInput): OcrRepairSuggestion[] {
  const out: OcrRepairSuggestion[] = [];
  const seen = new Set<string>();
  for (const item of scanFuelValues(input)) {
    const entry = lookupFuelFuzzy(item.raw);
    if (!entry) continue;
    const canonical = entry.canonical;
    const normalizedOriginal = normalizeToken(item.raw);
    if (normalizedOriginal === normalizeToken(canonical)) continue;
    if (seen.has(normalizedOriginal)) continue;
    seen.add(normalizedOriginal);
    const exactAlias = item.raw.toLowerCase() !== canonical.toLowerCase();
    out.push({
      id: `fuel_spelling_${out.length + 1}`,
      kind: "FUEL_SPELLING",
      fieldKey: item.fieldKey,
      original: item.raw,
      suggested: canonical,
      confidence: exactAlias ? 0.85 : 0.6,
      severity: "warning",
      reason: `Fuel "${item.raw}" resolves to the known grade ${canonical} (${entry.description ?? "marine fuel"}).`,
    });
  }
  return out;
}

// ── Port spelling ────────────────────────────────────────────────────────────

const PORT_KEYS = new Set([
  "port",
  "deliveryPort",
  "delivery_port",
  "loadPort",
  "load_port",
  "dischargePort",
  "discharge_port",
  "deliveryLocation",
  "portOfDelivery",
]);

export function portSpellingSuggestions(input: OcrDocumentInput): OcrRepairSuggestion[] {
  const out: OcrRepairSuggestion[] = [];
  const seen = new Set<string>();
  for (const [key, val] of Object.entries(input.extractedData)) {
    if (!PORT_KEYS.has(key) || typeof val !== "string") continue;
    const raw = val.trim();
    if (raw.length === 0) continue;
    const entry = lookupPortFuzzy(raw);
    if (entry && normalizeToken(entry.canonical) !== normalizeToken(raw)) {
      if (seen.has(normalizeToken(raw))) continue;
      seen.add(normalizeToken(raw));
      const exactAlias = lookupPort(normalizeToken(raw)) !== null;
      out.push({
        id: `port_spelling_${out.length + 1}`,
        kind: "PORT_SPELLING",
        fieldKey: key,
        original: raw,
        suggested: entry.canonical,
        confidence: exactAlias ? 0.8 : 0.6,
        severity: "warning",
        reason: `Port "${raw}" resolves to ${entry.canonical}.`,
      });
    }
  }
  return out;
}

// ── Certificate number spacing ───────────────────────────────────────────────

const CERT_NUMBER_KEYS = new Set(["certificateNumber", "certNumber", "certificate_no"]);

export function certificateNumberSpacingSuggestions(input: OcrDocumentInput, family: string): OcrRepairSuggestion[] {
  if (family !== "CERTIFICATE") return [];
  const out: OcrRepairSuggestion[] = [];
  for (const [key, val] of Object.entries(input.extractedData)) {
    if (!CERT_NUMBER_KEYS.has(key) || typeof val !== "string") continue;
    const raw = val.trim();
    const letterRun = raw.match(/^[A-Za-z]{2,}/)?.[0];
    const digitRun = raw.replace(/\D/g, "");
    if (!letterRun || digitRun.length === 0) continue;
    const collapsed = `${letterRun}-${digitRun}`;
    if (collapsed !== raw && !raw.includes(letterRun + "-" + digitRun)) {
      out.push({
        id: `certificate_number_spacing_${out.length + 1}`,
        kind: "CERTIFICATE_NUMBER_SPACING",
        fieldKey: key,
        original: raw,
        suggested: collapsed,
        confidence: 0.9,
        severity: "info",
        reason: `Certificate number "${raw}" uses inconsistent spacing; the canonical form is ${collapsed}.`,
      });
    }
  }
  return out;
}

// ── Merged characters ────────────────────────────────────────────────────────

const MERGED_FUEL_PATTERN = /^([A-Za-z]{2,6})(\d{2,})$/;

export function mergedCharacterSuggestions(input: OcrDocumentInput): OcrRepairSuggestion[] {
  const out: OcrRepairSuggestion[] = [];
  const tokens = (input.rawText ?? "").split(/\s+/).filter((t) => t.length > 0);
  const seen = new Set<string>();

  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);

    const fuel = token.match(MERGED_FUEL_PATTERN);
    if (fuel) {
      const entry = lookupFuelFuzzy(fuel[1] ?? "");
      if (entry) {
        out.push({
          id: `merged_chars_${out.length + 1}`,
          kind: "MERGED_CHARACTERS",
          fieldKey: "fuelType",
          original: token,
          suggested: `${entry.canonical} ${fuel[2] ?? ""}`.trim(),
          confidence: 0.5,
          severity: "info",
          reason: `"${token}" looks like ${entry.canonical} merged with the value ${fuel[2]}.`,
        });
      }
      continue;
    }

    const camel = token.match(/^([a-z]+)([A-Z][A-Za-z]*)$/);
    if (camel) {
      const first = lookupFuelFuzzy(camel[1] ?? "");
      if (first) {
        out.push({
          id: `merged_chars_${out.length + 1}`,
          kind: "MERGED_CHARACTERS",
          fieldKey: "fuelType",
          original: token,
          suggested: `${first.canonical} ${camel[2] ?? ""}`.trim(),
          confidence: 0.5,
          severity: "info",
          reason: `"${token}" looks like two merged tokens: ${first.canonical} and ${camel[2] ?? ""}.`,
        });
      }
    }
  }
  return out;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export interface RepairSuggestionContext {
  readonly family?: string;
}

export function generateRepairSuggestions(
  input: OcrDocumentInput,
  ctx: RepairSuggestionContext = {},
): OcrRepairSuggestion[] {
  const family = ctx.family ?? classifyDocument(input).family;

  const sections: Array<{
    suggestions: OcrRepairSuggestion[];
    order: number;
  }> = [
    { suggestions: imoChecksumSuggestions(input), order: 1 },
    { suggestions: dateFormatSuggestions(input), order: 2 },
    { suggestions: fuelSpellingSuggestions(input), order: 3 },
    { suggestions: portSpellingSuggestions(input), order: 4 },
    { suggestions: certificateNumberSpacingSuggestions(input, family), order: 5 },
    { suggestions: mergedCharacterSuggestions(input), order: 6 },
  ];

  return sections
    .sort((a, b) => a.order - b.order)
    .flatMap((s) => s.suggestions);
}

export function repairKindLabel(kind: OcrRepairKind): string {
  switch (kind) {
    case "IMO_CHECKSUM":
      return "IMO number checksum";
    case "DATE_FORMAT":
      return "Date format";
    case "FUEL_SPELLING":
      return "Fuel spelling";
    case "PORT_SPELLING":
      return "Port spelling";
    case "CERTIFICATE_NUMBER_SPACING":
      return "Certificate number spacing";
    case "MERGED_CHARACTERS":
      return "Merged characters";
  }
}
