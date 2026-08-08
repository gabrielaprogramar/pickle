import type {
  SearchAst,
  SearchEntity,
  SearchFilter,
  SearchResultRecord,
  SearchSort,
} from "./types";
import { SEARCH_HARD_LIMIT } from "./types";
import {
  buildMockCertificateRegistry,
  CERT_MOCK_NOW,
  CERT_MOCK_VESSEL,
  certificateTypeLabel,
  DEFAULT_CERTIFICATE_THRESHOLDS,
  viewFor,
} from "@/lib/certificates";

export interface SearchToolContext {
  readonly organizationId: string;
  readonly userId: string;
}

export interface SearchToolResult {
  readonly total: number;
  readonly results: ReadonlyArray<SearchResultRecord>;
  readonly filters: SearchFilter;
}

export interface SearchTool {
  readonly name: string;
  readonly description: string;
  readonly entity: SearchEntity;
  execute(ast: SearchAst, context: SearchToolContext): Promise<SearchToolResult>;
}

export interface SearchToolOutcome {
  readonly tool: SearchTool;
  readonly result: SearchToolResult;
}

export interface SearchToolRegistry {
  getTool(entity: SearchEntity): SearchTool | undefined;
  listTools(): ReadonlyArray<SearchTool>;
  execute(ast: SearchAst, context: SearchToolContext): Promise<SearchToolOutcome>;
}

interface MockRecord extends Record<string, unknown> {
  readonly id: string;
  readonly title: string;
}

const DAY = 86_400_000;
const HOUR = 3_600_000;
const isoDateTime = (offsetMs: number): string => new Date(Date.now() + offsetMs).toISOString();
const isoDateOnly = (offsetMs: number): string => isoDateTime(offsetMs).slice(0, 10);

const VESSEL_LOOKUP: Record<string, { readonly name: string; readonly imo: string }> = {
  "vsl-aurelia": { name: "Aurelia", imo: "9074729" },
  "vsl-atlas": { name: "Atlas", imo: "9432891" },
  "vsl-horizon": { name: "Horizon", imo: "9587420" },
  "vsl-neptune": { name: "Neptune", imo: "9338490" },
  "vsl-odyssey": { name: "Odyssey", imo: "9712215" },
};

const VESSELS: ReadonlyArray<Record<string, unknown>> = [
  { id: "vsl-aurelia", imo: "9074729", vessel_name: "Aurelia", title: "Aurelia", mmsi: "310625000", ship_id: "371663", gross_tonnage: 31240, vessel_type: "RoPax", flag: "PANAMA", status: "OPERATIONAL", deep_link: { label: "View fleet profile", path: "/fleet/9074729" } },
  { id: "vsl-atlas", imo: "9432891", vessel_name: "Atlas", title: "Atlas", mmsi: "538005432", ship_id: "411552", gross_tonnage: 55460, vessel_type: "Container", flag: "LIBERIA", status: "OPERATIONAL", deep_link: { label: "View fleet profile", path: "/fleet/9432891" } },
  { id: "vsl-horizon", imo: "9587420", vessel_name: "Horizon", title: "Horizon", mmsi: "636012345", ship_id: "623451", gross_tonnage: 29870, vessel_type: "Bulk Carrier", flag: "MARSHALL_ISLANDS", status: "OPERATIONAL", deep_link: { label: "View fleet profile", path: "/fleet/9587420" } },
  { id: "vsl-neptune", imo: "9338490", vessel_name: "Neptune", title: "Neptune", mmsi: "215008765", ship_id: "884532", gross_tonnage: 18650, vessel_type: "General Cargo", flag: "MALTA", status: "OPERATIONAL", deep_link: { label: "View fleet profile", path: "/fleet/9338490" } },
  { id: "vsl-odyssey", imo: "9712215", vessel_name: "Odyssey", title: "Odyssey", mmsi: "374712000", ship_id: "915611", gross_tonnage: 38980, vessel_type: "Tanker", flag: "GREECE", status: "OPERATIONAL", deep_link: { label: "View fleet profile", path: "/fleet/9712215" } },
];

const VOYAGE_DEFS: ReadonlyArray<{
  readonly id: string;
  readonly vesselId: string;
  readonly departurePort: string;
  readonly arrivalPort: string;
  readonly depOffsetMs: number;
  readonly arrOffsetMs: number | null;
  readonly distanceNm: number;
}> = [
  { id: "voy-aur-1", vesselId: "vsl-aurelia", departurePort: "Piraeus", arrivalPort: "Valencia", depOffsetMs: -9 * DAY, arrOffsetMs: -7 * DAY, distanceNm: 1002 },
  { id: "voy-aur-2", vesselId: "vsl-aurelia", departurePort: "Valencia", arrivalPort: "Genoa", depOffsetMs: -30 * HOUR, arrOffsetMs: 34 * HOUR, distanceNm: 623 },
  { id: "voy-atl-1", vesselId: "vsl-atlas", departurePort: "Rotterdam", arrivalPort: "Piraeus", depOffsetMs: -12 * DAY, arrOffsetMs: -10 * DAY, distanceNm: 2695 },
  { id: "voy-atl-2", vesselId: "vsl-atlas", departurePort: "Piraeus", arrivalPort: "Marseille", depOffsetMs: -48 * HOUR, arrOffsetMs: 10 * HOUR, distanceNm: 1280 },
  { id: "voy-hrz-1", vesselId: "vsl-horizon", departurePort: "Rotterdam", arrivalPort: "Hamburg", depOffsetMs: -6 * HOUR, arrOffsetMs: 5 * HOUR, distanceNm: 398 },
  { id: "voy-hrz-2", vesselId: "vsl-horizon", departurePort: "Hamburg", arrivalPort: "Rotterdam", depOffsetMs: -5 * DAY, arrOffsetMs: -4 * DAY, distanceNm: 398 },
  { id: "voy-nep-1", vesselId: "vsl-neptune", departurePort: "Algeciras", arrivalPort: "Barcelona", depOffsetMs: -3 * DAY, arrOffsetMs: 16 * HOUR, distanceNm: 760 },
  { id: "voy-nep-2", vesselId: "vsl-neptune", departurePort: "Barcelona", arrivalPort: "Algeciras", depOffsetMs: -15 * DAY, arrOffsetMs: -13 * DAY, distanceNm: 760 },
  { id: "voy-ody-1", vesselId: "vsl-odyssey", departurePort: "Singapore", arrivalPort: "Fujairah", depOffsetMs: -5 * DAY, arrOffsetMs: 6 * DAY, distanceNm: 3185 },
  { id: "voy-ody-2", vesselId: "vsl-odyssey", departurePort: "Fujairah", arrivalPort: "Singapore", depOffsetMs: -30 * DAY, arrOffsetMs: -27 * DAY, distanceNm: 3185 },
  { id: "voy-ody-3", vesselId: "vsl-odyssey", departurePort: "Singapore", arrivalPort: "Fujairah", depOffsetMs: -45 * DAY, arrOffsetMs: -42 * DAY, distanceNm: 3185 },
];

const VOYAGES: ReadonlyArray<MockRecord> = VOYAGE_DEFS.map((v) => {
  const vessel = VESSEL_LOOKUP[v.vesselId]!;
  return {
    id: v.id,
    vessel_id: v.vesselId,
    vessel_name: vessel.name,
    imo: vessel.imo,
    title: `${v.departurePort} → ${v.arrivalPort}`,
    departure_port: v.departurePort,
    arrival_port: v.arrivalPort,
    departure_date: isoDateOnly(v.depOffsetMs),
    arrival_date: v.arrOffsetMs === null ? null : isoDateOnly(v.arrOffsetMs),
    distance_nm: v.distanceNm,
    status: v.arrOffsetMs !== null && v.arrOffsetMs > 0 ? "PLANNED" : "COMPLETED",
    deep_link: { label: "View voyage", path: `/voyages/${v.id}` },
  };
});

const AIS_POSITIONS: ReadonlyArray<MockRecord> = [
  { id: "ais-vsl-aurelia", vessel_id: "vsl-aurelia", vessel_name: "Aurelia", imo: "9074729", title: "Aurelia in the Mediterranean", timestamp: isoDateTime(-2 * HOUR), latitude: 41.95, longitude: 7.95, speed_knots: 15.2, heading: 47, zone: "EU_ETS", deep_link: { label: "Open map", path: "/ais" } },
  { id: "ais-vsl-atlas", vessel_id: "vsl-atlas", vessel_name: "Atlas", imo: "9432891", title: "Atlas in the Mediterranean", timestamp: isoDateTime(-2 * HOUR), latitude: 41.2, longitude: 5.8, speed_knots: 14, heading: 275, zone: "EU_ETS", deep_link: { label: "Open map", path: "/ais" } },
  { id: "ais-vsl-horizon", vessel_id: "vsl-horizon", vessel_name: "Horizon", imo: "9587420", title: "Horizon approaching Hamburg", timestamp: isoDateTime(-2 * HOUR), latitude: 53.3, longitude: 7.2, speed_knots: 11.5, heading: 92, zone: "OPEN_SEA", deep_link: { label: "Open map", path: "/ais" } },
  { id: "ais-vsl-neptune", vessel_id: "vsl-neptune", vessel_name: "Neptune", imo: "9338490", title: "Neptune in the Mediterranean", timestamp: isoDateTime(-2 * HOUR), latitude: 37.85, longitude: 1.1, speed_knots: 13.8, heading: 52, zone: "EU_ETS", deep_link: { label: "Open map", path: "/ais" } },
  { id: "ais-vsl-odyssey", vessel_id: "vsl-odyssey", vessel_name: "Odyssey", imo: "9712215", title: "Odyssey in the Arabian Sea", timestamp: isoDateTime(-2 * HOUR), latitude: 12.6, longitude: 77.2, speed_knots: 16.4, heading: 305, zone: "OPEN_SEA", deep_link: { label: "Open map", path: "/ais" } },
];

const FUEL_DELIVERY_DEFS: ReadonlyArray<{
  readonly id: string;
  readonly vesselId: string;
  readonly port: string;
  readonly offsetMs: number;
  readonly fuelType: string;
  readonly quantityMt: number;
  readonly supplier: string;
  readonly status: string;
  readonly documentId: string;
  readonly bdn: string;
  readonly confidence: number;
}> = [
  { id: "fuel-aur-1", vesselId: "vsl-aurelia", port: "Valencia", offsetMs: -8 * DAY, fuelType: "VLSFO", quantityMt: 320, supplier: "Bunker Holding Iberia S.L.", status: "reconciled", documentId: "doc-bdn-aurelia-valencia", bdn: "BDN-2026-0726", confidence: 0.95 },
  { id: "fuel-atl-1", vesselId: "vsl-atlas", port: "Piraeus", offsetMs: -11 * DAY, fuelType: "VLSFO", quantityMt: 400, supplier: "Hellas Bunkers S.A.", status: "reconciled", documentId: "doc-bdn-atlas-piraeus", bdn: "BDN-2026-0723", confidence: 0.94 },
  { id: "fuel-atl-2", vesselId: "vsl-atlas", port: "Rotterdam", offsetMs: -13 * DAY, fuelType: "LSMGO", quantityMt: 120, supplier: "Vitol Bunkers B.V.", status: "verified", documentId: "doc-bdn-atlas-rotterdam", bdn: "BDN-2026-0721", confidence: 0.93 },
  { id: "fuel-hrz-1", vesselId: "vsl-horizon", port: "Rotterdam", offsetMs: -7 * DAY, fuelType: "VLSFO", quantityMt: 480, supplier: "Vitol Bunkers B.V.", status: "verified", documentId: "doc-bdn-horizon-rotterdam", bdn: "BDN-2026-0727", confidence: 0.92 },
  { id: "fuel-hrz-2", vesselId: "vsl-horizon", port: "Hamburg", offsetMs: -4 * DAY, fuelType: "LSMGO", quantityMt: 90, supplier: "Marine Bunkers GmbH", status: "pending", documentId: "doc-bdn-horizon-hamburg", bdn: "BDN-2026-0730", confidence: 0.86 },
  { id: "fuel-nep-1", vesselId: "vsl-neptune", port: "Algeciras", offsetMs: -3 * DAY, fuelType: "VLSFO", quantityMt: 550, supplier: "Cepsa Marine", status: "pending", documentId: "doc-bdn-neptune-algeciras", bdn: "BDN-2026-0731", confidence: 0.88 },
  { id: "fuel-nep-2", vesselId: "vsl-neptune", port: "Barcelona", offsetMs: -14 * DAY, fuelType: "MGO", quantityMt: 40, supplier: "Cepsa Marine", status: "reconciled", documentId: "doc-bdn-neptune-barcelona", bdn: "BDN-2026-0720", confidence: 0.9 },
  { id: "fuel-ody-1", vesselId: "vsl-odyssey", port: "Singapore", offsetMs: -5 * DAY, fuelType: "VLSFO", quantityMt: 700, supplier: "Oceania Marine Fuels Pte Ltd", status: "verified", documentId: "doc-bdn-odyssey-singapore", bdn: "BDN-2026-0729", confidence: 0.93 },
  { id: "fuel-ody-2", vesselId: "vsl-odyssey", port: "Fujairah", offsetMs: -29 * DAY, fuelType: "HFO", quantityMt: 500, supplier: "Gulf Marine Bunkers FZE", status: "reconciled", documentId: "doc-bdn-odyssey-fujairah", bdn: "BDN-2026-0705", confidence: 0.9 },
];

const FUEL_DELIVERIES: ReadonlyArray<MockRecord> = FUEL_DELIVERY_DEFS.map((f) => {
  const vessel = VESSEL_LOOKUP[f.vesselId]!;
  return {
    id: f.id,
    vessel_id: f.vesselId,
    vessel_name: vessel.name,
    imo: vessel.imo,
    title: `BDN ${f.bdn} — ${f.port}`,
    bdn_reference: f.bdn,
    port: f.port,
    delivery_date: isoDateOnly(f.offsetMs),
    fuel_type: f.fuelType,
    quantity_mt: f.quantityMt,
    supplier: f.supplier,
    confidence: f.confidence,
    status: f.status,
    source: "EMAIL",
    deep_link: { label: "View BDN", path: `/documents/${f.documentId}` },
  };
});

const DOCUMENT_DEFS: ReadonlyArray<{
  readonly id: string;
  readonly vesselId: string | null;
  readonly documentType: string;
  readonly title: string;
  readonly filename: string;
  readonly summary: string;
  readonly status: string;
  readonly source: string;
  readonly confidence: number;
  readonly offsetMs: number;
}> = [
  { id: "doc-bdn-aurelia-valencia", vesselId: "vsl-aurelia", documentType: "bdn", title: "BDN — Aurelia (Valencia, 2026-07-26)", filename: "bdn-aurelia-valencia-2026-0726.pdf", summary: "Bunker delivery note from Bunker Holding Iberia S.L., Valencia", status: "approved", source: "EMAIL", confidence: 0.95, offsetMs: -8 * DAY },
  { id: "doc-bdn-atlas-piraeus", vesselId: "vsl-atlas", documentType: "bdn", title: "BDN — Atlas (Piraeus, 2026-07-23)", filename: "bdn-atlas-piraeus-2026-0723.pdf", summary: "Bunker delivery note from Hellas Bunkers S.A., Piraeus", status: "approved", source: "EMAIL", confidence: 0.94, offsetMs: -11 * DAY },
  { id: "doc-bdn-atlas-rotterdam", vesselId: "vsl-atlas", documentType: "bdn", title: "BDN — Atlas (Rotterdam, 2026-07-21)", filename: "bdn-atlas-rotterdam-2026-0721.pdf", summary: "Bunker delivery note from Vitol Bunkers B.V., Rotterdam", status: "approved", source: "EMAIL", confidence: 0.93, offsetMs: -13 * DAY },
  { id: "doc-bdn-horizon-rotterdam", vesselId: "vsl-horizon", documentType: "bdn", title: "BDN — Horizon (Rotterdam, 2026-07-27)", filename: "bdn-horizon-rotterdam-2026-0727.pdf", summary: "Bunker delivery note from Vitol Bunkers B.V., Rotterdam", status: "extracted", source: "EMAIL", confidence: 0.9, offsetMs: -7 * DAY },
  { id: "doc-bdn-horizon-hamburg", vesselId: "vsl-horizon", documentType: "bdn", title: "BDN — Horizon (Hamburg, 2026-07-30)", filename: "bdn-horizon-hamburg-2026-0730.pdf", summary: "Bunker delivery note from Marine Bunkers GmbH, Hamburg (low OCR confidence)", status: "processing", source: "EMAIL", confidence: 0.6, offsetMs: -4 * DAY },
  { id: "doc-bdn-neptune-algeciras", vesselId: "vsl-neptune", documentType: "bdn", title: "BDN — Neptune (Algeciras, 2026-07-31)", filename: "bdn-neptune-algeciras-2026-0731.pdf", summary: "Bunker delivery note from Cepsa Marine, Algeciras", status: "ocr_complete", source: "EMAIL", confidence: 0.9, offsetMs: -3 * DAY },
  { id: "doc-bdn-neptune-barcelona", vesselId: "vsl-neptune", documentType: "bdn", title: "BDN — Neptune (Barcelona, 2026-07-20)", filename: "bdn-neptune-barcelona-2026-0720.pdf", summary: "Bunker delivery note from Cepsa Marine, Barcelona", status: "approved", source: "EMAIL", confidence: 0.92, offsetMs: -14 * DAY },
  { id: "doc-bdn-odyssey-singapore", vesselId: "vsl-odyssey", documentType: "bdn", title: "BDN — Odyssey (Singapore, 2026-07-29)", filename: "bdn-odyssey-singapore-2026-0729.pdf", summary: "Bunker delivery note from Oceania Marine Fuels Pte Ltd, Singapore", status: "extracted", source: "EMAIL", confidence: 0.91, offsetMs: -5 * DAY },
  { id: "doc-bdn-odyssey-fujairah", vesselId: "vsl-odyssey", documentType: "bdn", title: "BDN — Odyssey (Fujairah, 2026-07-05)", filename: "bdn-odyssey-fujairah-2026-0705.pdf", summary: "Bunker delivery note from Gulf Marine Bunkers FZE, Fujairah", status: "approved", source: "EMAIL", confidence: 0.93, offsetMs: -29 * DAY },
  { id: "doc-iapp-aurelia", vesselId: "vsl-aurelia", documentType: "certificate", title: "IAPP Certificate — Aurelia", filename: "iapp-aurelia-2025.pdf", summary: "International Air Pollution Prevention certificate for Aurelia", status: "approved", source: "MANUAL", confidence: 0.98, offsetMs: -50 * DAY },
  { id: "doc-mrv-atlas-2025", vesselId: "vsl-atlas", documentType: "eu_mrv", title: "MRV Report — Atlas (2025)", filename: "mrv-atlas-2025.pdf", summary: "THETIS-MRV 2025 emissions report for Atlas", status: "approved", source: "MANUAL", confidence: 0.97, offsetMs: -20 * DAY },
  { id: "doc-corr-harbourmaster", vesselId: "vsl-horizon", documentType: "correspondence", title: "Hamburg Harbourmaster — pre-arrival correspondence", filename: "hamburg-hm-2026-0729.eml", summary: "Pre-arrival correspondence with Hamburg Harbourmaster", status: "archived", source: "EMAIL", confidence: 0.7, offsetMs: -5 * DAY },
];

const DOCUMENTS: ReadonlyArray<MockRecord> = DOCUMENT_DEFS.map((d) => {
  const vessel = d.vesselId ? VESSEL_LOOKUP[d.vesselId] : undefined;
  return {
    id: d.id,
    vessel_id: d.vesselId,
    vessel_name: vessel?.name ?? null,
    imo: vessel?.imo ?? null,
    document_type: d.documentType,
    title: d.title,
    filename: d.filename,
    summary: d.summary,
    status: d.status,
    source: d.source,
    confidence: d.confidence,
    uploaded_at: isoDateOnly(d.offsetMs),
    deep_link: { label: "Open document", path: `/documents/${d.id}` },
  };
});

const OCR_MIRROR_DEFS: ReadonlyArray<{
  readonly documentId: string;
  readonly documentTitle: string;
  readonly confidence: number;
  readonly offsetMs: number;
}> = [
  { documentId: "ocr-doc-perfect-bdn", documentTitle: "BDN — Aurora (Singapore, 2026-07-18)", confidence: 0.95, offsetMs: -8 * DAY },
  { documentId: "ocr-doc-rotated-bdn", documentTitle: "BDN — Aurora (rotated 90°)", confidence: 0.6, offsetMs: -7 * DAY },
  { documentId: "ocr-doc-blurred-certificate", documentTitle: "IAPP Certificate — Aurora (blurred)", confidence: 0.45, offsetMs: -7 * DAY },
  { documentId: "ocr-doc-unreadable-noon-report", documentTitle: "Noon Report — Aurora (unreadable)", confidence: 0.2, offsetMs: -7 * DAY },
  { documentId: "ocr-doc-mixed-language", documentTitle: "BDN — Aurora (mixed-language supplier block)", confidence: 0.8, offsetMs: -6 * DAY },
  { documentId: "ocr-doc-duplicate-scan", documentTitle: "BDN — Aurora (duplicate page scan)", confidence: 0.75, offsetMs: -6 * DAY },
  { documentId: "ocr-doc-damaged-scan", documentTitle: "EU ETS Report — Aurora (damaged scan)", confidence: 0.3, offsetMs: -6 * DAY },
  { documentId: "ocr-doc-wrong-type", documentTitle: "Uploaded as Certificate — content is a BDN", confidence: 0.95, offsetMs: -5 * DAY },
];

const OCR_RESULTS: ReadonlyArray<MockRecord> = OCR_MIRROR_DEFS.map((o) => ({
  id: `ocr-${o.documentId}`,
  document_id: o.documentId,
  document_title: o.documentTitle,
  vessel_id: null,
  vessel_name: null,
  imo: null,
  title: `OCR extraction — ${o.documentTitle}`,
  confidence: o.confidence,
  extracted_text_length: 2100,
  page_count: 3,
  status: o.confidence >= 0.8 ? "SUCCESS" : "LOW_CONFIDENCE",
  processed_at: isoDateOnly(o.offsetMs),
  deep_link: { label: "View extraction", path: `/documents/${o.documentId}` },
}));

const VALIDATION_REPORTS: ReadonlyArray<MockRecord> = [
  { id: "mrv-atlas-2025", vessel_id: "vsl-atlas", vessel_name: "Atlas", imo: "9432891", report_type: "MRV", title: "MRV 2025 validation report — Atlas", year: 2025, passed: true, errors_count: 0, warnings_count: 1, generated_at: isoDateOnly(-14 * DAY), deep_link: { label: "View validation", path: "/review" } },
  { id: "mrv-aurelia-2025", vessel_id: "vsl-aurelia", vessel_name: "Aurelia", imo: "9074729", report_type: "MRV", title: "MRV 2025 validation report — Aurelia", year: 2025, passed: true, errors_count: 0, warnings_count: 0, generated_at: isoDateOnly(-14 * DAY), deep_link: { label: "View validation", path: "/review" } },
  { id: "mrv-neptune-2025", vessel_id: "vsl-neptune", vessel_name: "Neptune", imo: "9338490", report_type: "MRV", title: "MRV 2025 validation report — Neptune", year: 2025, passed: false, errors_count: 2, warnings_count: 3, generated_at: isoDateOnly(-14 * DAY), deep_link: { label: "View validation", path: "/review" } },
];

const REVIEW_TASK_DEFS: ReadonlyArray<{
  readonly id: string;
  readonly vesselId: string | null;
  readonly title: string;
  readonly taskType: string;
  readonly status: string;
  readonly assignee: string | null;
  readonly offsetMs: number;
}> = [
  { id: "rt-ocr-rotated", vesselId: null, title: "Review BDN scanned rotated 90°", taskType: "DOCUMENT_REVIEW", status: "in_progress", assignee: "user-marina", offsetMs: -1 * DAY },
  { id: "rt-ocr-blurred", vesselId: null, title: "Review IAPP certificate scan (blurred)", taskType: "DOCUMENT_REVIEW", status: "pending", assignee: "user-marina", offsetMs: -1 * DAY },
  { id: "rt-ocr-unreadable", vesselId: null, title: "Review unreadable noon report", taskType: "DOCUMENT_REVIEW", status: "pending", assignee: null, offsetMs: -1 * DAY },
  { id: "rt-ocr-duplicate", vesselId: null, title: "Review BDN duplicate page scan", taskType: "DOCUMENT_REVIEW", status: "pending", assignee: "user-marina", offsetMs: -1 * DAY },
  { id: "rt-ocr-wrongtype", vesselId: null, title: "Review document type mismatch (BDN uploaded as certificate)", taskType: "DOCUMENT_REVIEW", status: "pending", assignee: null, offsetMs: -1 * DAY },
  { id: "rt-bdn-horizon", vesselId: "vsl-horizon", title: "Reconcile BDN — Horizon (Hamburg, 2026-07-30)", taskType: "BDN_RECONCILIATION", status: "in_progress", assignee: "user-marina", offsetMs: -1 * DAY },
  { id: "rt-bdn-neptune", vesselId: "vsl-neptune", title: "Assign vessel for BDN — Neptune (Algeciras, 2026-07-31)", taskType: "BDN_RECONCILIATION", status: "pending", assignee: null, offsetMs: -1 * DAY },
  { id: "rt-mrv-atlas", vesselId: "vsl-atlas", title: "Verify MRV 2025 report — Atlas", taskType: "REPORT_APPROVAL", status: "completed", assignee: "user-marina", offsetMs: -3 * DAY },
  { id: "rt-ocr-damaged", vesselId: null, title: "Review damaged EU ETS report scan", taskType: "DOCUMENT_REVIEW", status: "pending", assignee: null, offsetMs: -1 * DAY },
];

const REVIEW_TASKS: ReadonlyArray<MockRecord> = REVIEW_TASK_DEFS.map((t) => {
  const vessel = t.vesselId ? VESSEL_LOOKUP[t.vesselId] : undefined;
  return {
    id: t.id,
    vessel_id: t.vesselId,
    vessel_name: vessel?.name ?? null,
    imo: vessel?.imo ?? null,
    title: t.title,
    task_type: t.taskType,
    status: t.status,
    assignee: t.assignee,
    created_at: isoDateOnly(t.offsetMs),
    deep_link: { label: "Open review", path: `/review/${t.id}` },
  };
});

const REPORT_DEFS: ReadonlyArray<{
  readonly id: string;
  readonly vesselId: string | null;
  readonly reportType: string;
  readonly year: number;
  readonly title: string;
  readonly status: string;
  readonly generatedOffsetMs: number | null;
  readonly submissionDeadline: string | null;
  readonly deepPath: string;
}> = [
  { id: "cr-fueleu-fleet-2026", vesselId: null, reportType: "fueleu", year: 2026, title: "FuelEU Maritime — Fleet 2026 (provisional)", status: "GENERATED", generatedOffsetMs: -4 * DAY, submissionDeadline: "2027-04-30", deepPath: "/compliance" },
  { id: "cr-fueleu-atlas-2025", vesselId: "vsl-atlas", reportType: "fueleu", year: 2025, title: "FuelEU Maritime — Atlas 2025", status: "GENERATED", generatedOffsetMs: -5 * DAY, submissionDeadline: "2026-04-30", deepPath: "/fleet/9432891" },
  { id: "cr-mrv-atlas-2025", vesselId: "vsl-atlas", reportType: "thetis_mrv", year: 2025, title: "THETIS-MRV — Atlas 2025", status: "GENERATED", generatedOffsetMs: -6 * DAY, submissionDeadline: "2026-04-30", deepPath: "/fleet/9432891" },
  { id: "cr-mrv-aurelia-2025", vesselId: "vsl-aurelia", reportType: "thetis_mrv", year: 2025, title: "THETIS-MRV — Aurelia 2025", status: "GENERATED", generatedOffsetMs: -7 * DAY, submissionDeadline: "2026-04-30", deepPath: "/fleet/9074729" },
  { id: "cr-mrv-neptune-2025", vesselId: "vsl-neptune", reportType: "thetis_mrv", year: 2025, title: "THETIS-MRV — Neptune 2025", status: "FAILED", generatedOffsetMs: -2 * DAY, submissionDeadline: "2026-04-30", deepPath: "/fleet/9338490" },
  { id: "cr-ets-fleet-2025", vesselId: null, reportType: "fleet_summary", year: 2025, title: "EU ETS — Fleet surrender plan 2025", status: "DRAFT", generatedOffsetMs: null, submissionDeadline: "2026-09-30", deepPath: "/compliance" },
  { id: "cr-green-fleet-2026", vesselId: null, reportType: "green_zone", year: 2026, title: "Green Zone — fleet exposure Q2 2026", status: "DRAFT", generatedOffsetMs: null, submissionDeadline: null, deepPath: "/compliance" },
  { id: "cr-esg-2025", vesselId: null, reportType: "esg_package", year: 2025, title: "ESG package — FY2025", status: "DRAFT", generatedOffsetMs: null, submissionDeadline: null, deepPath: "/compliance" },
];

const REPORTS: ReadonlyArray<MockRecord> = REPORT_DEFS.map((r) => {
  const vessel = r.vesselId ? VESSEL_LOOKUP[r.vesselId] : undefined;
  return {
    id: r.id,
    vessel_id: r.vesselId,
    vessel_name: vessel?.name ?? null,
    imo: vessel?.imo ?? null,
    report_type: r.reportType,
    year: r.year,
    title: r.title,
    status: r.status,
    generated_at: r.generatedOffsetMs === null ? null : isoDateOnly(r.generatedOffsetMs),
    submission_deadline: r.submissionDeadline,
    deep_link: { label: "View report", path: r.deepPath },
  };
});

const VERIFIER_PACKAGE_DEFS: ReadonlyArray<{
  readonly id: string;
  readonly vesselId: string;
  readonly year: number;
  readonly status: string;
  readonly generatedOffsetMs: number | null;
}> = [
  { id: "vp-atlas-2025", vesselId: "vsl-atlas", year: 2025, status: "GENERATED", generatedOffsetMs: -4 * DAY },
  { id: "vp-aurelia-2025", vesselId: "vsl-aurelia", year: 2025, status: "GENERATED", generatedOffsetMs: -5 * DAY },
  { id: "vp-neptune-2025", vesselId: "vsl-neptune", year: 2025, status: "FAILED", generatedOffsetMs: null },
];

const VERIFIER_PACKAGES: ReadonlyArray<MockRecord> = VERIFIER_PACKAGE_DEFS.map((p) => {
  const vessel = VESSEL_LOOKUP[p.vesselId]!;
  return {
    id: p.id,
    vessel_id: p.vesselId,
    vessel_name: vessel.name,
    imo: vessel.imo,
    year: p.year,
    title: `${vessel.name} — verifier package ${p.year}`,
    status: p.status,
    generated_at: p.generatedOffsetMs === null ? null : isoDateOnly(p.generatedOffsetMs),
    deep_link: { label: "View package", path: `/fleet/${vessel.imo}` },
  };
});

const AUDIT_EVENTS: ReadonlyArray<MockRecord> = [
  { id: "audit-001", organization_id: "org-001", vessel_id: "vsl-aurelia", vessel_name: "Aurelia", imo: "9074729", title: "Search executed", actor: "user-001", actor_role: "OPERATOR", event_type: "SEARCH_EXECUTED", entity: "search", entity_id: null, description: "User executed a search across documents", timestamp: isoDateTime(-3 * HOUR), deep_link: { label: "Open analytics", path: "/analytics" } },
  { id: "audit-002", organization_id: "org-001", vessel_id: "vsl-aurelia", vessel_name: "Aurelia", imo: "9074729", title: "Document uploaded", actor: "user-001", actor_role: "OPERATOR", event_type: "DOCUMENT_UPLOAD", entity: "document", entity_id: "doc-bdn-aurelia-valencia", description: "BDN uploaded via email (Valencia, 2026-07-26)", timestamp: isoDateTime(-8 * DAY), deep_link: { label: "Open document", path: "/documents/doc-bdn-aurelia-valencia" } },
  { id: "audit-003", organization_id: "org-001", vessel_id: "vsl-aurelia", vessel_name: "Aurelia", imo: "9074729", title: "Validation run", actor: "user-001", actor_role: "OPERATOR", event_type: "VALIDATION_RUN", entity: "validation", entity_id: "mrv-aurelia-2025", description: "MRV 2025 validation run completed", timestamp: isoDateTime(-14 * DAY), deep_link: { label: "View validation", path: "/review" } },
  { id: "audit-004", organization_id: "org-001", vessel_id: "vsl-aurelia", vessel_name: "Aurelia", imo: "9074729", title: "Report generated", actor: "user-002", actor_role: "COMPLIANCE_OFFICER", event_type: "REPORT_GENERATED", entity: "report", entity_id: "cr-mrv-aurelia-2025", description: "THETIS-MRV 2025 report generated", timestamp: isoDateTime(-7 * DAY), deep_link: { label: "View report", path: "/fleet/9074729" } },
  { id: "audit-005", organization_id: "org-001", vessel_id: "vsl-aurelia", vessel_name: "Aurelia", imo: "9074729", title: "Review task created", actor: "user-003", actor_role: "REVIEWER", event_type: "REVIEW_TASK_CREATED", entity: "review_task", entity_id: "rt-ocr-rotated", description: "Review task created for rotated BDN scan", timestamp: isoDateTime(-1 * DAY), deep_link: { label: "Open review", path: "/review/rt-ocr-rotated" } },
  { id: "audit-006", organization_id: "org-001", vessel_id: "vsl-aurelia", vessel_name: "Aurelia", imo: "9074729", title: "Fuel delivery reconciled", actor: "user-001", actor_role: "OPERATOR", event_type: "FUEL_DELIVERY_RECONCILED", entity: "fuel_delivery", entity_id: "fuel-aur-1", description: "BDN-2026-0726 reconciled to voyage voy-aur-1", timestamp: isoDateTime(-8 * DAY), deep_link: { label: "View BDN", path: "/documents/doc-bdn-aurelia-valencia" } },
  { id: "audit-007", organization_id: "org-001", title: "User signed in", actor: "user-002", actor_role: "COMPLIANCE_OFFICER", event_type: "LOGIN", entity: "session", entity_id: null, description: "User signed in", timestamp: isoDateTime(-2 * HOUR), deep_link: { label: "Open analytics", path: "/analytics" } },
  { id: "audit-008", organization_id: "org-001", vessel_id: "vsl-odyssey", vessel_name: "Odyssey", imo: "9712215", title: "Document uploaded", actor: "user-001", actor_role: "OPERATOR", event_type: "DOCUMENT_UPLOAD", entity: "document", entity_id: "doc-bdn-odyssey-singapore", description: "BDN uploaded via email (Singapore, 2026-07-29)", timestamp: isoDateTime(-5 * DAY), deep_link: { label: "Open document", path: "/documents/doc-bdn-odyssey-singapore" } },
];

const REGULATORY_KB: ReadonlyArray<MockRecord> = [
  { id: "reg-001", document_id: "kb-1", source_title: "FuelEU Maritime Regulation (EU) 2023/1805", title: "Reduction of ships' greenhouse gas intensity", regulation: "FuelEU Maritime", article_section: "Article 1 — Subject matter", version: "2023", content: "This Regulation lays down rules for reducing greenhouse gas intensity of energy used on board ships calling at EEA ports.", relevance_score: 0.95, deep_link: { label: "Ask Compliance Assistant", path: "/compliance-assistant" } },
  { id: "reg-002", document_id: "kb-2", source_title: "EU ETS Directive 2003/87/EC", title: "Maritime transport included in EU ETS", regulation: "EU ETS", article_section: "Article 3ga — Maritime transport", version: "2023-10", content: "Emissions from maritime transport activities are included in the EU ETS from 2024, phased in progressively.", relevance_score: 0.9, deep_link: { label: "Ask Compliance Assistant", path: "/compliance-assistant" } },
  { id: "reg-003", document_id: "kb-3", source_title: "EU MRV Regulation (EU) 2015/757", title: "Monitoring, reporting and verification", regulation: "EU MRV", article_section: "Article 4 — Monitoring and reporting", version: "2023", content: "Companies shall monitor CO2 emissions of ships on voyages to, from and within EEA ports.", relevance_score: 0.92, deep_link: { label: "Ask Compliance Assistant", path: "/compliance-assistant" } },
  { id: "reg-004", document_id: "kb-4", source_title: "MARPOL Annex VI", title: "Energy efficiency requirements", regulation: "MARPOL", article_section: "Regulation 22 — Attained EEDI", version: "2021", content: "Ships must meet energy efficiency requirements including EEDI and EEXI.", relevance_score: 0.88, deep_link: { label: "Ask Compliance Assistant", path: "/compliance-assistant" } },
  { id: "reg-005", document_id: "kb-5", source_title: "FuelEU Maritime Regulation (EU) 2023/1805", title: "Compliance balance and pooling", regulation: "FuelEU Maritime", article_section: "Article 20 — Compliance surplus and pooling", version: "2023", content: "Compliance surpluses may be banked and compliance deficits may be pooled between ships.", relevance_score: 0.89, deep_link: { label: "Ask Compliance Assistant", path: "/compliance-assistant" } },
];

const CERTIFICATES: ReadonlyArray<MockRecord> = buildMockCertificateRegistry(CERT_MOCK_NOW).records
  .map((record) => {
    const view = viewFor(record, CERT_MOCK_NOW, DEFAULT_CERTIFICATE_THRESHOLDS);
    const title = certificateTypeLabel(record.certificate_type);
    return {
      id: record.id,
      vessel_id: record.vessel_id,
      vessel_name: CERT_MOCK_VESSEL.name,
      imo: record.imo,
      certificate_type: record.certificate_type,
      certificate_title: title,
      certificate_number: record.certificate_number,
      issuing_authority: record.issuing_authority,
      class_society: record.class_society,
      expiry_date: record.expiry_date,
      status: view.status,
      reason_code: view.reasonCode,
      blocking: view.blocking,
      review_required: view.reviewRequired,
      days_until_expiry: view.daysUntilExpiry,
      confidence: record.confidence,
      source: record.source,
      document_type: "Certificate",
      title: `${title} — ${view.status}`,
      summary: `${title} (${record.certificate_number ?? "no number"}) is ${view.status} on the evidence on file${
        record.expiry_date ? `; expires ${record.expiry_date}` : ""
      }. Status is derived deterministically from the registry — no expiry date is ever inferred.`,
      deep_link: { label: "Open certificate registry", path: `/fleet/${record.imo}#certificates` },
    };
  })
  .sort((a, b) => (a.days_until_expiry ?? Infinity) - (b.days_until_expiry ?? Infinity));

interface EntityConfig {
  readonly entity: SearchEntity;
  readonly name: string;
  readonly description: string;
  readonly data: ReadonlyArray<MockRecord>;
  readonly dateField: string;
}

const ENTITY_CONFIGS: ReadonlyArray<EntityConfig> = [
  { entity: "vessels", name: "search_vessels", description: "Retrieve vessels for the organization", data: VESSELS as ReadonlyArray<MockRecord>, dateField: "" },
  { entity: "voyages", name: "search_voyages", description: "Retrieve voyages for the organization", data: VOYAGES, dateField: "arrival_date" },
  { entity: "ais_positions", name: "search_ais_positions", description: "Retrieve AIS positions for the organization", data: AIS_POSITIONS, dateField: "timestamp" },
  { entity: "fuel_deliveries", name: "search_fuel_deliveries", description: "Retrieve fuel delivery (BDN) records for the organization", data: FUEL_DELIVERIES, dateField: "delivery_date" },
  { entity: "documents", name: "search_documents", description: "Retrieve documents for the organization", data: DOCUMENTS, dateField: "uploaded_at" },
  { entity: "ocr_results", name: "search_ocr_results", description: "Retrieve OCR extraction results for the organization", data: OCR_RESULTS, dateField: "processed_at" },
  { entity: "validation_reports", name: "search_validation_reports", description: "Retrieve validation reports for the organization", data: VALIDATION_REPORTS, dateField: "generated_at" },
  { entity: "review_tasks", name: "search_review_tasks", description: "Retrieve review tasks for the organization", data: REVIEW_TASKS, dateField: "created_at" },
  { entity: "reports", name: "search_reports", description: "Retrieve compliance reports for the organization", data: REPORTS, dateField: "generated_at" },
  { entity: "verifier_packages", name: "search_verifier_packages", description: "Retrieve verifier packages for the organization", data: VERIFIER_PACKAGES, dateField: "generated_at" },
  { entity: "audit_log", name: "search_audit_log", description: "Retrieve audit events for the organization", data: AUDIT_EVENTS, dateField: "timestamp" },
  { entity: "regulatory", name: "regulatory_search", description: "Retrieve regulatory knowledge base documents", data: REGULATORY_KB, dateField: "" },
  { entity: "certificates", name: "search_certificates", description: "Retrieve certificate registry records for the organization", data: CERTIFICATES, dateField: "expiry_date" },
];

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function recordDate(record: MockRecord, dateField: string): string {
  if (!dateField) return "";
  const value = str(record[dateField]);
  if (value.length > 10) return value.slice(0, 10);
  return value;
}

function recordYear(record: MockRecord): number | undefined {
  const explicit = num(record.year ?? record.reporting_year);
  if (!Number.isNaN(explicit)) return explicit;
  const dateKey = inferDateField(record);
  if (!dateKey) return undefined;
  const m = str(record[dateKey]).match(/^(\d{4})/);
  return m ? parseInt(m[1]!, 10) : undefined;
}

function matches(record: MockRecord, filters: SearchFilter): boolean {
  if (filters.vesselName) {
    const rv = str(record.vessel_name).toLowerCase();
    if (!rv.includes(filters.vesselName.toLowerCase())) return false;
  }
  if (filters.vesselId) {
    if (str(record.vessel_id) !== filters.vesselId) return false;
  }
  if (filters.imo) {
    const rimo = str(record.imo);
    if (!rimo.includes(filters.imo)) return false;
  }
  if (filters.port) {
    const port = str(record.port || record.departure_port || record.arrival_port || "").toLowerCase();
    if (!port.includes(filters.port.toLowerCase())) return false;
  }
  if (filters.status) {
    const status = str(record.status).toLowerCase();
    if (status !== filters.status.toLowerCase()) return false;
  }
  if (filters.source) {
    const source = str(record.source).toLowerCase();
    if (source !== filters.source.toLowerCase()) return false;
  }
  if (filters.documentType) {
    const dt = str(record.document_type || record.report_type);
    if (dt && !dt.toLowerCase().includes(filters.documentType.toLowerCase())) return false;
  }
  if (filters.year !== undefined) {
    const y = recordYear(record);
    if (y !== filters.year) return false;
  }
  if (filters.confidenceMin !== undefined) {
    const conf = num(record.confidence);
    if (!Number.isNaN(conf) && conf < filters.confidenceMin) return false;
  }
  if (filters.confidenceMax !== undefined) {
    const conf = num(record.confidence);
    if (!Number.isNaN(conf) && conf >= filters.confidenceMax) return false;
  }
  if (filters.text) {
    const haystack = `${str(record.title)} ${str(record.summary)} ${str(record.description)} ${str(record.vessel_name)}`.toLowerCase();
    if (!haystack.includes(filters.text.toLowerCase())) return false;
  }
  return true;
}

function inferDateField(record: MockRecord): string {
  for (const key of ["timestamp", "uploaded_at", "processed_at", "generated_at", "created_at", "delivery_date", "arrival_date", "departure_date", "expiry_date"]) {
    if (record[key] !== undefined && record[key] !== null) return key;
  }
  return "";
}

function applyDateFilters(record: MockRecord, filters: SearchFilter): boolean {
  const dateField = inferDateField(record);
  if (!dateField) return true;
  const d = recordDate(record, dateField);
  if (!d) return true;
  if (filters.dateFrom && d < filters.dateFrom) return false;
  if (filters.dateTo && d > filters.dateTo) return false;
  return true;
}

function matchesWithDate(record: MockRecord, filters: SearchFilter): boolean {
  return matches(record, filters) && applyDateFilters(record, filters);
}

export function rankResults<T extends SearchResultRecord>(
  results: ReadonlyArray<T>,
): ReadonlyArray<T> {
  return [...results].sort((a, b) => {
    const confDelta = (b.confidence ?? 0) - (a.confidence ?? 0);
    if (confDelta !== 0) return confDelta;
    const dateDelta = (b.date ?? "").localeCompare(a.date ?? "");
    if (dateDelta !== 0) return dateDelta;
    return a.id.localeCompare(b.id);
  });
}

function applySort(
  records: ReadonlyArray<MockRecord>,
  sort: SearchSort,
): ReadonlyArray<MockRecord> {
  const dir = sort.direction === "asc" ? 1 : -1;
  const field = sort.field;
  const valueOf = (r: MockRecord): string => {
    if (field === "date") return inferDateValue(r);
    if (field === "confidence") return String(num(r.confidence) || 0);
    if (field === "title") return str(r.title);
    if (field === "vessel_name") return str(r.vessel_name);
    return inferDateValue(r);
  };
  return [...records].sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    const fa = Number(va);
    const fb = Number(vb);
    if (field === "confidence") return (fa - fb) * dir;
    if (Number.isFinite(fa) && Number.isFinite(fb) && field === "date") return (fa - fb) * dir;
    return va.localeCompare(vb) * dir;
  });
}

function inferDateValue(record: MockRecord): string {
  const key = inferDateField(record);
  if (!key) return "";
  const value = str(record[key]);
  if (value.length > 10) return value.slice(0, 10);
  return value;
}

function toResultRecord(entity: SearchEntity, raw: MockRecord, dateField: string): SearchResultRecord {
  const date = dateField ? recordDate(raw, dateField) : "";
  const deepLink =
    raw.deep_link && typeof raw.deep_link === "object"
      ? {
          label: String((raw.deep_link as Record<string, unknown>).label ?? "View"),
          path: String((raw.deep_link as Record<string, unknown>).path ?? ""),
        }
      : undefined;
  const sourceRecordId = str(raw.source_record_id) || raw.id;
  const { deep_link, ...rest } = raw as Record<string, unknown>;
  return {
    ...rest,
    entity,
    id: raw.id,
    title: str(raw.title),
    date,
    sourceRecordId,
    deepLink: deepLink,
  } as SearchResultRecord;
}

function createMockTool(config: EntityConfig): SearchTool {
  return {
    name: config.name,
    description: config.description,
    entity: config.entity,
    async execute(ast: SearchAst, _context: SearchToolContext): Promise<SearchToolResult> {
      // NOTE: No compliance figures are computed here. This tool ONLY retrieves
      // and filters existing deterministic records. Regulated values (GHG
      // intensity, EUA obligations, penalties) are stored data, never derived.
      const page = Math.max(1, ast.pagination.page);
      const pageSize = Math.min(SEARCH_HARD_LIMIT, Math.max(1, ast.pagination.pageSize));

      const filtered = config.data.filter((record) =>
        matchesWithDate(record, ast.filters),
      );
      const sorted = applySort(filtered, ast.sort);
      const ranked = rankResults(
        sorted.map((r) => toResultRecord(config.entity, r, config.dateField)),
      );

      const start = (page - 1) * pageSize;
      const pageItems = ranked.slice(start, start + pageSize);

      return {
        total: ranked.length,
        results: pageItems,
        filters: ast.filters,
      };
    },
  };
}

export function createSearchToolRegistry(
  tools?: ReadonlyArray<SearchTool>,
): SearchToolRegistry {
  const byEntity = new Map<SearchEntity, SearchTool>();
  const toolList =
    tools && tools.length > 0
      ? [...tools]
      : ENTITY_CONFIGS.map((config) => createMockTool(config));
  for (const tool of toolList) {
    byEntity.set(tool.entity, tool);
  }

  return {
    getTool(entity: SearchEntity): SearchTool | undefined {
      return byEntity.get(entity);
    },
    listTools(): ReadonlyArray<SearchTool> {
      const list: SearchTool[] = [];
      byEntity.forEach((tool) => {
        list.push(tool);
      });
      return list;
    },
    async execute(ast: SearchAst, context: SearchToolContext): Promise<SearchToolOutcome> {
      const entity = ast.entity;
      if (!entity) {
        throw new Error("Cannot execute search tool: query has no entity");
      }
      const tool = byEntity.get(entity);
      if (!tool) {
        throw new Error(`No search tool registered for entity "${entity}"`);
      }
      const result = await tool.execute(ast, context);
      return { tool, result };
    },
  };
}
