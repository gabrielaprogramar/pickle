/**
 * mock-data.ts — deterministic OCR assistant fixtures
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * Nine fixed mock documents that each exercise one scan defect. The raw text,
 * extracted data, word confidences and page signals are all hard-coded so the
 * classification, quality, suggestions and priority engines produce stable
 * outputs that tests can assert against. No randomness, no network.
 *
 * HOW IT FITS
 * The mock state feeds the OCR assistant service and tools in the same way
 * maintenance-assistant/mock-data.ts feeds the maintenance service.
 */

import type { OcrDocumentInput, OcrMockDocument, OcrPageSignal } from "./types";

/** Fixed "now" used by the OCR assistant for deterministic reasoning. */
export const OCR_MOCK_NOW = "2026-08-01T12:00:00.000Z";

/** Build a deterministic word-confidence array from per-band counts. */
function words(counts: {
  readonly high: number;
  readonly medium: number;
  readonly low: number;
  readonly veryLow: number;
}): number[] {
  const out: number[] = [];
  for (let i = 0; i < counts.high; i++) out.push(0.9);
  for (let i = 0; i < counts.medium; i++) out.push(0.75);
  for (let i = 0; i < counts.low; i++) out.push(0.6);
  for (let i = 0; i < counts.veryLow; i++) out.push(0.3);
  return out;
}

const PERFECT_BDN_TEXT = [
  "BUNKER DELIVERY NOTE",
  "Delivery Note No.: BDN-2026-0718",
  "Vessel: M/T Aurelia",
  "IMO No.: 9074729",
  "Port of Delivery: Singapore",
  "Supplier: Oceania Marine Fuels Pte Ltd",
  "Delivery Date: 2026-07-18",
  "Fuel Type: VLSFO",
  "Quantity: 450.0 MT delivered",
  "Grade: RMG 380",
  "Sulphur Content: 0.49 %",
  "Density: 985.2 kg/m3",
  "BDR No.: BDR-2026-0718",
].join("\n");

const ROTATED_BDN_TEXT = [
  "BUNKER DELIVERY NOTE (scanned rotated 90deg)",
  "Delivery Note No.: BDN-2026-0719",
  "Vessel: AURELIA",
  "IMO No.: 9321481",
  "Port of Delivery: Singapore",
  "SuppIier: Oceania Marine Fuels Pte Ltd",
  "Ouantity: 420.0 MT",
  "Fuel: VLSF0",
  "Delivery Date: 14/05/2024",
  "BDR No.: BDR-2026-0719",
].join("\n");

const BLURRED_CERT_TEXT = [
  "INTERNATIONAL AIR POLLUTION PREVENTION CERTIFICATE",
  "Certificate No.: IAPP 2024 0581",
  "Issued by: DNV (Det Norske Veritas)",
  "Date of Issue: 2024-05-11",
  "Vessel: M/T Aurelia",
  "IMO No.: 9074729",
  "Class Society: DNV",
  "Flag State: Marshall Islands",
].join("\n");

const UNREADABLE_NOON_TEXT = [
  "NOON REPORT",
  "Vessel: AURELIA",
  "Pos1tion: ###",
  "D1stance: ###",
  "RPM: ###",
  "C0nsumption: ###",
].join("\n");

const MIXED_LANGUAGE_BDN_TEXT = [
  "BUNKER DELIVERY NOTE",
  "Vessel: AURELIA",
  "IMO No.: 9074729",
  "Port of Delivery: Singapore",
  "Supplier: Группа Океан Топливо",
  "Delivery Date: 2026-07-20",
  "Fuel Type: MGO",
  "Quantity: 25.0 MT",
].join("\n");

const DUPLICATE_SCAN_TEXT = [
  "BUNKER DELIVERY NOTE",
  "Vessel: AURELIA",
  "IMO No.: 9074729",
  "Port of Delivery: Singapore",
  "Delivery Date: 2026-07-21",
  "Fuel Type: VLSFO",
  "Quantity: 310.0 MT",
  "Page 1 of 2",
  "Page 2 of 2 — duplicate of page 1",
].join("\n");

const DAMAGED_ETS_TEXT = [
  "EU ETS REP0RT",
  "Vess@l: AURELIA",
  "IMO No.: 9074729",
  "Reporting Period: 2025",
  "Tota1 C02 Em1ss1ons: ###",
  "EU Allowances: ###",
].join("\n");

const CROPPED_STATEMENT_TEXT = [
  "ACCOUNT STATEMENT",
  "Account Holder: Poseidon Shipping Ltd.",
  "Statement Period: 2026-07",
  "Opening Balance: USD 12,400.00",
  "[bottom cropped — closing balance not captured]",
].join("\n");

const WRONG_TYPE_BDN_TEXT = [
  "BUNKER DELIVERY NOTE",
  "Delivery Note No.: BDN-2026-0722",
  "Vessel: M/T Aurelia",
  "IMO No.: 9074729",
  "Port of Delivery: Fujairah",
  "Supplier: Gulf Marine Bunkers FZE",
  "Delivery Date: 2026-07-22",
  "Fuel Type: IFO380",
  "Quantity: 500.0 MT",
  "Grade: RMG 380",
  "Sulphur Content: 0.48 %",
  "Density: 987.0 kg/m3",
  "BDR No.: BDR-2026-0722",
].join("\n");

export const OCR_MOCK_DOCUMENTS: ReadonlyArray<OcrMockDocument> = [
  {
    id: "ocr-doc-perfect-bdn",
    title: "BDN — Aurelia (Singapore, 2026-07-18)",
    declaredType: "BDN",
    family: "BDN",
    rawText: PERFECT_BDN_TEXT,
    extractedData: {
      imoNumber: "9074729",
      vesselName: "AURELIA",
      port: "Singapore",
      deliveryDate: "2026-07-18",
      fuelType: "VLSFO",
      quantityTonnes: 450,
      sulphurContentPct: 0.49,
      densityKgM3: 985.2,
      supplier: "Oceania Marine Fuels Pte Ltd",
      bdnReference: "BDN-2026-0718",
    },
    ocrConfidence: 0.95,
    wordConfidence: words({ high: 48, medium: 12, low: 0, veryLow: 0 }),
    pageSignals: [],
    injectedIssue: "none — clean scan",
    expectedLevel: "HIGH",
  },
  {
    id: "ocr-doc-rotated-bdn",
    title: "BDN — Aurelia (rotated 90°)",
    declaredType: "BDN",
    family: "BDN",
    rawText: ROTATED_BDN_TEXT,
    extractedData: {
      imoNumber: "9321481",
      vesselName: "AURELIA",
      port: "Singapore",
      fuelType: "VLSF0",
      quantityTonnes: 420,
      supplier: "Oceania Marine Fuels Pte Ltd",
      bdnReference: "BDN-2026-0719",
    },
    ocrConfidence: 0.6,
    wordConfidence: words({ high: 12, medium: 10, low: 12, veryLow: 6 }),
    pageSignals: [{ page: 1, rotated: true }],
    injectedIssue: "page scanned rotated 90 degrees",
    expectedLevel: "MEDIUM",
  },
  {
    id: "ocr-doc-blurred-certificate",
    title: "IAPP Certificate — Aurelia (blurred)",
    declaredType: "CERTIFICATE",
    family: "CERTIFICATE",
    rawText: BLURRED_CERT_TEXT,
    extractedData: {
      certificateType: "IAPP",
      certificateNumber: "IAPP 2024 0581",
      issuer: "DNV",
      issueDate: "2024-05-11",
      vesselName: "AURELIA",
      imoNumber: "9074729",
      classSociety: "DNV",
      flagState: "Marshall Islands",
    },
    ocrConfidence: 0.45,
    wordConfidence: words({ high: 4, medium: 8, low: 12, veryLow: 6 }),
    pageSignals: [{ page: 1, blurred: true }],
    injectedIssue: "blurred scan; expiry date unreadable",
    expectedLevel: "MEDIUM",
  },
  {
    id: "ocr-doc-unreadable-noon-report",
    title: "Noon Report — Aurelia (unreadable)",
    declaredType: "NOON_REPORT",
    family: "NOON_REPORT",
    rawText: UNREADABLE_NOON_TEXT,
    extractedData: {},
    ocrConfidence: 0.2,
    wordConfidence: words({ high: 0, medium: 0, low: 0, veryLow: 12 }),
    pageSignals: [{ page: 1, damaged: true }],
    injectedIssue: "unreadable scan; data lines illegible",
    expectedLevel: "VERY_LOW",
  },
  {
    id: "ocr-doc-mixed-language",
    title: "BDN — Aurelia (mixed-language supplier block)",
    declaredType: "BDN",
    family: "BDN",
    rawText: MIXED_LANGUAGE_BDN_TEXT,
    extractedData: {
      imoNumber: "9074729",
      vesselName: "AURELIA",
      port: "Singapore",
      deliveryDate: "2026-07-20",
      fuelType: "MGO",
      quantityTonnes: 25,
      supplier: "Группа Океан Топливо",
    },
    ocrConfidence: 0.8,
    wordConfidence: words({ high: 20, medium: 0, low: 6, veryLow: 4 }),
    pageSignals: [],
    injectedIssue: "supplier block in a non-Latin script",
    expectedLevel: "MEDIUM",
  },
  {
    id: "ocr-doc-duplicate-scan",
    title: "BDN — Aurelia (duplicate page scan)",
    declaredType: "BDN",
    family: "BDN",
    rawText: DUPLICATE_SCAN_TEXT,
    extractedData: {
      imoNumber: "9074729",
      vesselName: "AURELIA",
      port: "Singapore",
      deliveryDate: "2026-07-21",
      fuelType: "VLSFO",
      quantityTonnes: 310,
    },
    ocrConfidence: 0.75,
    wordConfidence: words({ high: 14, medium: 6, low: 10, veryLow: 0 }),
    pageSignals: [
      { page: 1, characterCount: 980 },
      { page: 2, characterCount: 980 },
    ],
    injectedIssue: "page 2 is a duplicate of page 1",
    expectedLevel: "MEDIUM",
  },
  {
    id: "ocr-doc-damaged-scan",
    title: "EU ETS Report — Aurelia (damaged scan)",
    declaredType: "EU_ETS",
    family: "EU_ETS",
    rawText: DAMAGED_ETS_TEXT,
    extractedData: {},
    ocrConfidence: 0.3,
    wordConfidence: words({ high: 0, medium: 0, low: 0, veryLow: 30 }),
    pageSignals: [{ page: 1, damaged: true }],
    injectedIssue: "water-damaged scan; values illegible",
    expectedLevel: "VERY_LOW",
  },
  {
    id: "ocr-doc-cropped-statement",
    title: "Account Statement — Aurelia Shipping (cropped)",
    declaredType: "STATEMENT",
    family: "STATEMENT",
    rawText: CROPPED_STATEMENT_TEXT,
    extractedData: {
      accountHolder: "Poseidon Shipping Ltd.",
      period: "2026-07",
      openingBalance: "USD 12,400.00",
    },
    ocrConfidence: 0.8,
    wordConfidence: words({ high: 18, medium: 0, low: 9, veryLow: 3 }),
    pageSignals: [{ page: 1, cropped: true }],
    injectedIssue: "bottom of page cropped; closing balance missing",
    expectedLevel: "MEDIUM",
  },
  {
    id: "ocr-doc-wrong-type",
    title: "Uploaded as Certificate — content is a BDN",
    declaredType: "CERTIFICATE",
    family: "BDN",
    rawText: WRONG_TYPE_BDN_TEXT,
    extractedData: {
      imoNumber: "9074729",
      vesselName: "AURELIA",
      port: "Fujairah",
      deliveryDate: "2026-07-22",
      fuelType: "IFO380",
      quantityTonnes: 500,
      sulphurContentPct: 0.48,
      densityKgM3: 987,
      supplier: "Gulf Marine Bunkers FZE",
      bdnReference: "BDN-2026-0722",
    },
    ocrConfidence: 0.95,
    wordConfidence: words({ high: 48, medium: 12, low: 0, veryLow: 0 }),
    pageSignals: [],
    injectedIssue: "file uploaded as Certificate but content is a BDN",
    expectedLevel: "HIGH",
  },
];

/** Convert a mock fixture into the engine input shape. */
export function toOcrDocumentInput(doc: OcrMockDocument): OcrDocumentInput {
  return {
    documentId: doc.id,
    title: doc.title,
    documentType: doc.declaredType,
    rawText: doc.rawText,
    extractedData: doc.extractedData,
    ocrConfidence: doc.ocrConfidence,
    wordConfidence: doc.wordConfidence,
    pageSignals: doc.pageSignals,
  };
}

/** Mock state passed to the OCR assistant service. */
export interface OcrMockState {
  readonly documents: ReadonlyArray<OcrMockDocument>;
  readonly now: string;
}

export function createOcrMockState(now = OCR_MOCK_NOW): OcrMockState {
  return { documents: OCR_MOCK_DOCUMENTS, now };
}

/** Shared page signal factory for tests. */
export function pageSignal(overrides: Partial<OcrPageSignal> & { page: number }): OcrPageSignal {
  return overrides;
}
