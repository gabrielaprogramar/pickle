import type {
  SearchAst,
  SearchEntity,
  SearchFilter,
  SearchResultRecord,
  SearchSort,
} from "./types";
import { SEARCH_HARD_LIMIT } from "./types";

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

const VESSELS: ReadonlyArray<Record<string, unknown>> = [
  { id: "vessel-001", imo: "9074729", vessel_name: "MV Aurelia", title: "MV Aurelia", vessel_type: "RoPax", flag: "PANAMA", gross_tonnage: 12450, status: "OPERATIONAL" },
  { id: "vessel-002", imo: "9812345", vessel_name: "MV Poseidon Voyager", title: "MV Poseidon Voyager", vessel_type: "Container", flag: "MARSHALL_ISLANDS", gross_tonnage: 85000, status: "OPERATIONAL" },
  { id: "vessel-003", imo: "9412345", vessel_name: "MV Ocean Guardian", title: "MV Ocean Guardian", vessel_type: "Bulk Carrier", flag: "GREECE", gross_tonnage: 72000, status: "OPERATIONAL" },
  { id: "vessel-004", imo: "9712345", vessel_name: "MV Baltic Trader", title: "MV Baltic Trader", vessel_type: "General Cargo", flag: "GERMANY", gross_tonnage: 45000, status: "IN_MAINTENANCE" },
  { id: "vessel-005", imo: "9912345", vessel_name: "MV Mediterranean Star", title: "MV Mediterranean Star", vessel_type: "Tanker", flag: "ITALY", gross_tonnage: 38000, status: "OPERATIONAL" },
];

const VOYAGES: ReadonlyArray<MockRecord> = [
  { id: "voyage-001", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Rotterdam → Palma", departure_port: "Rotterdam", arrival_port: "Palma", departure_date: "2025-05-10", arrival_date: "2025-05-14", distance_nm: 1180, status: "COMPLETED", deep_link: { label: "View voyage", path: "/voyages/voyage-001" } },
  { id: "voyage-002", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Palma → Barcelona", departure_port: "Palma", arrival_port: "Barcelona", departure_date: "2025-05-16", arrival_date: "2025-05-17", distance_nm: 110, status: "COMPLETED", deep_link: { label: "View voyage", path: "/voyages/voyage-002" } },
  { id: "voyage-003", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Barcelona → Genoa", departure_port: "Barcelona", arrival_port: "Genoa", departure_date: "2025-06-02", arrival_date: "2025-06-03", distance_nm: 340, status: "COMPLETED", deep_link: { label: "View voyage", path: "/voyages/voyage-003" } },
  { id: "voyage-004", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Genoa → Palma", departure_port: "Genoa", arrival_port: "Palma", departure_date: "2025-06-10", arrival_date: "2025-06-12", distance_nm: 430, status: "COMPLETED", deep_link: { label: "View voyage", path: "/voyages/voyage-004" } },
  { id: "voyage-005", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Palma → Valencia", departure_port: "Palma", arrival_port: "Valencia", departure_date: "2026-06-05", arrival_date: "2026-06-06", distance_nm: 150, status: "COMPLETED", deep_link: { label: "View voyage", path: "/voyages/voyage-005" } },
  { id: "voyage-006", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Valencia → Algeciras", departure_port: "Valencia", arrival_port: "Algeciras", departure_date: "2026-06-15", arrival_date: "2026-06-16", distance_nm: 320, status: "PLANNED", deep_link: { label: "View voyage", path: "/voyages/voyage-006" } },
  { id: "voyage-007", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", imo: "9812345", title: "Shanghai → Singapore", departure_port: "Shanghai", arrival_port: "Singapore", departure_date: "2025-07-01", arrival_date: "2025-07-05", distance_nm: 2240, status: "COMPLETED", deep_link: { label: "View voyage", path: "/voyages/voyage-007" } },
  { id: "voyage-008", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", imo: "9812345", title: "Singapore → Rotterdam", departure_port: "Singapore", arrival_port: "Rotterdam", departure_date: "2025-07-20", arrival_date: "2025-08-12", distance_nm: 8310, status: "COMPLETED", deep_link: { label: "View voyage", path: "/voyages/voyage-008" } },
  { id: "voyage-009", vessel_id: "vessel-003", vessel_name: "MV Ocean Guardian", imo: "9412345", title: "Santos → Algeciras", departure_port: "Santos", arrival_port: "Algeciras", departure_date: "2025-08-05", arrival_date: "2025-08-28", distance_nm: 4900, status: "COMPLETED", deep_link: { label: "View voyage", path: "/voyages/voyage-009" } },
  { id: "voyage-010", vessel_id: "vessel-004", vessel_name: "MV Baltic Trader", imo: "9712345", title: "Gdansk → Antwerp", departure_port: "Gdansk", arrival_port: "Antwerp", departure_date: "2025-03-15", arrival_date: "2025-03-20", distance_nm: 980, status: "COMPLETED", deep_link: { label: "View voyage", path: "/voyages/voyage-010" } },
  { id: "voyage-011", vessel_id: "vessel-005", vessel_name: "MV Mediterranean Star", imo: "9912345", title: "Piraeus → Valencia", departure_port: "Piraeus", arrival_port: "Valencia", departure_date: "2025-04-01", arrival_date: "2025-04-05", distance_nm: 1180, status: "COMPLETED", deep_link: { label: "View voyage", path: "/voyages/voyage-011" } },
];

const AIS_POSITIONS: ReadonlyArray<MockRecord> = [
  { id: "ais-001", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Aurelia near Valencia", timestamp: "2026-06-05T08:00:00Z", latitude: 38.68, longitude: 0.05, speed_knots: 14, heading: 270, zone: "EU_ETS", deep_link: { label: "Open map", path: "/ais" } },
  { id: "ais-002", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Aurelia approaching Algeciras", timestamp: "2026-06-15T12:00:00Z", latitude: 36.4, longitude: -5.3, speed_knots: 8, heading: 240, zone: "EU_ETS", deep_link: { label: "Open map", path: "/ais" } },
  { id: "ais-003", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", imo: "9812345", title: "Poseidon Voyager in Mediterranean", timestamp: "2026-06-10T10:00:00Z", latitude: 41.3, longitude: 2.2, speed_knots: 18, heading: 285, zone: "EU_ETS", deep_link: { label: "Open map", path: "/ais" } },
  { id: "ais-004", vessel_id: "vessel-003", vessel_name: "MV Ocean Guardian", imo: "9412345", title: "Ocean Guardian off Gibraltar", timestamp: "2026-06-20T06:00:00Z", latitude: 36.1, longitude: -4.2, speed_knots: 12, heading: 90, zone: "EU_ETS", deep_link: { label: "Open map", path: "/ais" } },
  { id: "ais-005", vessel_id: "vessel-004", vessel_name: "MV Baltic Trader", imo: "9712345", title: "Baltic Trader at Gdansk anchorage", timestamp: "2026-06-01T14:00:00Z", latitude: 54.4, longitude: 18.7, speed_knots: 0, heading: 0, zone: "OPEN_SEA", deep_link: { label: "Open map", path: "/ais" } },
  { id: "ais-006", vessel_id: "vessel-005", vessel_name: "MV Mediterranean Star", imo: "9912345", title: "Mediterranean Star leaving Piraeus", timestamp: "2026-06-08T22:00:00Z", latitude: 37.9, longitude: 23.7, speed_knots: 11, heading: 200, zone: "EU_ETS", deep_link: { label: "Open map", path: "/ais" } },
];

const FUEL_DELIVERIES: ReadonlyArray<MockRecord> = [
  { id: "bdn-001", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "BDN 001 — Palma", port: "Palma", delivery_date: "2025-03-12", fuel_type: "HFO", quantity_mt: 850, supplier: "Cepsa Energia", confidence: 0.94, status: "APPROVED", source: "MANUAL", deep_link: { label: "View BDN", path: "/documents/doc-101" } },
  { id: "bdn-002", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "BDN 002 — Palma", port: "Palma", delivery_date: "2025-06-18", fuel_type: "VLSFO", quantity_mt: 620, supplier: "OMV Bunkering", confidence: 0.88, status: "APPROVED", source: "EMAIL", deep_link: { label: "View BDN", path: "/documents/doc-102" } },
  { id: "bdn-003", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "BDN 003 — Palma", port: "Palma", delivery_date: "2025-10-05", fuel_type: "MGO", quantity_mt: 140, supplier: "Bunker One", confidence: 0.72, status: "PENDING", source: "OCR", deep_link: { label: "View BDN", path: "/documents/doc-103" } },
  { id: "bdn-004", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "BDN 004 — Barcelona", port: "Barcelona", delivery_date: "2025-11-22", fuel_type: "VLSFO", quantity_mt: 700, supplier: "Shell Marine", confidence: 0.95, status: "APPROVED", source: "EMAIL", deep_link: { label: "View BDN", path: "/documents/doc-104" } },
  { id: "bdn-005", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", imo: "9812345", title: "BDN 005 — Rotterdam", port: "Rotterdam", delivery_date: "2025-04-14", fuel_type: "VLSFO", quantity_mt: 1800, supplier: "Vitol Bunkers", confidence: 0.91, status: "APPROVED", source: "EMAIL", deep_link: { label: "View BDN", path: "/documents/doc-105" } },
  { id: "bdn-006", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", imo: "9812345", title: "BDN 006 — Singapore", port: "Singapore", delivery_date: "2025-07-08", fuel_type: "VLSFO", quantity_mt: 2200, supplier: "Sentek Marine", confidence: 0.97, status: "APPROVED", source: "EMAIL", deep_link: { label: "View BDN", path: "/documents/doc-106" } },
  { id: "bdn-007", vessel_id: "vessel-003", vessel_name: "MV Ocean Guardian", imo: "9412345", title: "BDN 007 — Algeciras", port: "Algeciras", delivery_date: "2025-08-29", fuel_type: "HFO", quantity_mt: 1200, supplier: "CEPSA", confidence: 0.65, status: "PENDING", source: "OCR", deep_link: { label: "View BDN", path: "/documents/doc-107" } },
  { id: "bdn-008", vessel_id: "vessel-004", vessel_name: "MV Baltic Trader", imo: "9712345", title: "BDN 008 — Antwerp", port: "Antwerp", delivery_date: "2025-03-20", fuel_type: "MGO", quantity_mt: 260, supplier: "Bunkerpartner", confidence: 0.89, status: "APPROVED", source: "MANUAL", deep_link: { label: "View BDN", path: "/documents/doc-108" } },
  { id: "bdn-009", vessel_id: "vessel-005", vessel_name: "MV Mediterranean Star", imo: "9912345", title: "BDN 009 — Piraeus", port: "Piraeus", delivery_date: "2025-04-03", fuel_type: "HFO", quantity_mt: 950, supplier: "Aegean Bunkering", confidence: 0.79, status: "REJECTED", source: "OCR", deep_link: { label: "View BDN", path: "/documents/doc-109" } },
  { id: "bdn-010", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "BDN 010 — Palma", port: "Palma", delivery_date: "2026-02-20", fuel_type: "VLSFO", quantity_mt: 580, supplier: "OMV Bunkering", confidence: 0.93, status: "APPROVED", source: "EMAIL", deep_link: { label: "View BDN", path: "/documents/doc-110" } },
];

const DOCUMENTS: ReadonlyArray<MockRecord> = [
  { id: "doc-001", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", document_type: "THETIS", title: "THETIS_2024_Aurelia.pdf", filename: "THETIS_2024_Aurelia.pdf", summary: "THETIS 2024 inspection report for MV Aurelia", status: "PROCESSED", source: "EMAIL", confidence: 0.96, uploaded_at: "2025-01-15", deep_link: { label: "Open document", path: "/documents/doc-001" } },
  { id: "doc-002", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", document_type: "BDN", title: "BDN_Palma_2025-06-18.pdf", filename: "BDN_Palma_2025-06-18.pdf", summary: "Bunker delivery note from OMV Bunkering, Palma", status: "PROCESSED", source: "EMAIL", confidence: 0.88, uploaded_at: "2025-06-19", deep_link: { label: "Open document", path: "/documents/doc-002" } },
  { id: "doc-003", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", document_type: "BDN", title: "BDN_Palma_2025-10-05.pdf", filename: "BDN_Palma_2025-10-05.pdf", summary: "Bunker delivery note from Bunker One, Palma (low OCR confidence)", status: "PENDING", source: "OCR", confidence: 0.72, uploaded_at: "2025-10-06", deep_link: { label: "Open document", path: "/documents/doc-003" } },
  { id: "doc-004", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", imo: "9812345", document_type: "FuelEU", title: "FuelEU_Monitoring_Plan_2025.pdf", filename: "FuelEU_Monitoring_Plan_2025.pdf", summary: "FuelEU Maritime monitoring plan", status: "PROCESSED", source: "MANUAL", confidence: 0.99, uploaded_at: "2025-02-01", deep_link: { label: "Open document", path: "/documents/doc-004" } },
  { id: "doc-005", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", imo: "9812345", document_type: "MRV", title: "MRV_2024_Report.pdf", filename: "MRV_2024_Report.pdf", summary: "MRV emissions report 2024", status: "PROCESSED", source: "EMAIL", confidence: 0.94, uploaded_at: "2025-04-30", deep_link: { label: "Open document", path: "/documents/doc-005" } },
  { id: "doc-006", vessel_id: "vessel-003", vessel_name: "MV Ocean Guardian", imo: "9412345", document_type: "EU_ETS", title: "EU_ETS_2025_Plan.pdf", filename: "EU_ETS_2025_Plan.pdf", summary: "EU ETS monitoring plan", status: "PENDING", source: "MANUAL", confidence: 0.9, uploaded_at: "2025-01-20", deep_link: { label: "Open document", path: "/documents/doc-006" } },
  { id: "doc-007", vessel_id: "vessel-004", vessel_name: "MV Baltic Trader", imo: "9712345", document_type: "Certificate", title: "Class_Certificate_2025.pdf", filename: "Class_Certificate_2025.pdf", summary: "Class certificate (poor scan quality)", status: "FAILED", source: "OCR", confidence: 0.58, uploaded_at: "2025-05-11", deep_link: { label: "Open document", path: "/documents/doc-007" } },
  { id: "doc-008", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", document_type: "Logbook", title: "Logbook_June_2025.pdf", filename: "Logbook_June_2025.pdf", summary: "Deck logbook June 2025", status: "PROCESSED", source: "EMAIL", confidence: 0.93, uploaded_at: "2025-07-05", deep_link: { label: "Open document", path: "/documents/doc-008" } },
  { id: "doc-009", vessel_id: "vessel-005", vessel_name: "MV Mediterranean Star", imo: "9912345", document_type: "Invoice", title: "Bunker_Invoice_2025-04.pdf", filename: "Bunker_Invoice_2025-04.pdf", summary: "Bunker invoice from Aegean Bunkering", status: "PROCESSED", source: "EMAIL", confidence: 0.91, uploaded_at: "2025-04-10", deep_link: { label: "Open document", path: "/documents/doc-009" } },
  { id: "doc-010", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", imo: "9812345", document_type: "BDN", title: "BDN_Singapore_2025-07-08.pdf", filename: "BDN_Singapore_2025-07-08.pdf", summary: "Bunker delivery note from Sentek Marine, Singapore", status: "PROCESSED", source: "EMAIL", confidence: 0.97, uploaded_at: "2025-07-09", deep_link: { label: "Open document", path: "/documents/doc-010" } },
];

const OCR_RESULTS: ReadonlyArray<MockRecord> = [
  { id: "ocr-001", document_id: "doc-001", document_title: "THETIS_2024_Aurelia.pdf", vessel_id: "vessel-001", vessel_name: "MV Aurelia", title: "OCR extraction — THETIS_2024_Aurelia.pdf", confidence: 0.96, extracted_text_length: 8500, page_count: 12, status: "SUCCESS", processed_at: "2025-01-16", deep_link: { label: "View extraction", path: "/documents/doc-001" } },
  { id: "ocr-002", document_id: "doc-003", document_title: "BDN_Palma_2025-10-05.pdf", vessel_id: "vessel-001", vessel_name: "MV Aurelia", title: "OCR extraction — BDN_Palma_2025-10-05.pdf", confidence: 0.72, extracted_text_length: 2100, page_count: 3, status: "LOW_CONFIDENCE", processed_at: "2025-10-06", deep_link: { label: "View extraction", path: "/documents/doc-003" } },
  { id: "ocr-003", document_id: "doc-007", document_title: "Class_Certificate_2025.pdf", vessel_id: "vessel-004", vessel_name: "MV Baltic Trader", title: "OCR extraction — Class_Certificate_2025.pdf", confidence: 0.58, extracted_text_length: 1450, page_count: 2, status: "LOW_CONFIDENCE", processed_at: "2025-05-11", deep_link: { label: "View extraction", path: "/documents/doc-007" } },
  { id: "ocr-004", document_id: "doc-002", document_title: "BDN_Palma_2025-06-18.pdf", vessel_id: "vessel-001", vessel_name: "MV Aurelia", title: "OCR extraction — BDN_Palma_2025-06-18.pdf", confidence: 0.88, extracted_text_length: 2300, page_count: 4, status: "SUCCESS", processed_at: "2025-06-19", deep_link: { label: "View extraction", path: "/documents/doc-002" } },
  { id: "ocr-005", document_id: "doc-010", document_title: "BDN_Singapore_2025-07-08.pdf", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", title: "OCR extraction — BDN_Singapore_2025-07-08.pdf", confidence: 0.97, extracted_text_length: 2600, page_count: 4, status: "SUCCESS", processed_at: "2025-07-09", deep_link: { label: "View extraction", path: "/documents/doc-010" } },
  { id: "ocr-006", document_id: "doc-009", document_title: "Bunker_Invoice_2025-04.pdf", vessel_id: "vessel-005", vessel_name: "MV Mediterranean Star", title: "OCR extraction — Bunker_Invoice_2025-04.pdf", confidence: 0.91, extracted_text_length: 1800, page_count: 2, status: "SUCCESS", processed_at: "2025-04-10", deep_link: { label: "View extraction", path: "/documents/doc-009" } },
];

const VALIDATION_REPORTS: ReadonlyArray<MockRecord> = [
  { id: "vr-001", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", report_type: "FuelEU", title: "FuelEU 2025 validation report — Aurelia", year: 2025, passed: true, errors_count: 0, warnings_count: 2, generated_at: "2025-12-10", deep_link: { label: "View validation", path: "/review" } },
  { id: "vr-002", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", report_type: "EU_ETS", title: "EU ETS 2025 validation report — Aurelia", year: 2025, passed: true, errors_count: 0, warnings_count: 1, generated_at: "2025-12-10", deep_link: { label: "View validation", path: "/review" } },
  { id: "vr-003", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", imo: "9812345", report_type: "FuelEU", title: "FuelEU 2025 validation report — Poseidon Voyager", year: 2025, passed: true, errors_count: 0, warnings_count: 3, generated_at: "2025-12-12", deep_link: { label: "View validation", path: "/review" } },
  { id: "vr-004", vessel_id: "vessel-004", vessel_name: "MV Baltic Trader", imo: "9712345", report_type: "MRV", title: "MRV 2024 validation report — Baltic Trader", year: 2024, passed: false, errors_count: 2, warnings_count: 5, generated_at: "2025-03-28", deep_link: { label: "View validation", path: "/review" } },
  { id: "vr-005", vessel_id: "vessel-003", vessel_name: "MV Ocean Guardian", imo: "9412345", report_type: "EU_ETS", title: "EU ETS 2025 validation report — Ocean Guardian", year: 2025, passed: true, errors_count: 0, warnings_count: 0, generated_at: "2025-12-11", deep_link: { label: "View validation", path: "/review" } },
];

const REVIEW_TASKS: ReadonlyArray<MockRecord> = [
  { id: "rt-001", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Review BDN_Palma_2025-10-05 (low OCR confidence)", task_type: "DOCUMENT_REVIEW", status: "PENDING", assignee: "reviewer-01", created_at: "2025-10-07", deep_link: { label: "Open review", path: "/review/rt-001" } },
  { id: "rt-002", vessel_id: "vessel-004", vessel_name: "MV Baltic Trader", imo: "9712345", title: "Escalate MRV 2024 validation errors", task_type: "VALIDATION_ESCALATION", status: "PENDING", assignee: "reviewer-02", created_at: "2025-03-29", deep_link: { label: "Open review", path: "/review/rt-002" } },
  { id: "rt-003", vessel_id: "vessel-003", vessel_name: "MV Ocean Guardian", imo: "9412345", title: "Review BDN_Algeciras_2025-08-29", task_type: "DOCUMENT_REVIEW", status: "IN_PROGRESS", assignee: "reviewer-01", created_at: "2025-08-30", deep_link: { label: "Open review", path: "/review/rt-003" } },
  { id: "rt-004", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", imo: "9812345", title: "Verify Class certificate renewal", task_type: "CERTIFICATE_CHECK", status: "PENDING", assignee: "reviewer-03", created_at: "2025-05-12", deep_link: { label: "Open review", path: "/review/rt-004" } },
  { id: "rt-005", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Approve FuelEU annual report 2025", task_type: "REPORT_APPROVAL", status: "COMPLETED", assignee: "reviewer-02", created_at: "2025-12-15", deep_link: { label: "Open review", path: "/review/rt-005" } },
  { id: "rt-006", vessel_id: "vessel-005", vessel_name: "MV Mediterranean Star", imo: "9912345", title: "Re-review bunker invoice extraction", task_type: "DOCUMENT_REVIEW", status: "IN_PROGRESS", assignee: "reviewer-01", created_at: "2025-04-11", deep_link: { label: "Open review", path: "/review/rt-006" } },
];

const REPORTS: ReadonlyArray<MockRecord> = [
  { id: "rep-001", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", report_type: "THETIS", year: 2024, title: "THETIS 2024 inspection report for MV Aurelia", status: "COMPLETED", generated_at: "2025-01-20", submission_deadline: null, deep_link: { label: "View report", path: "/documents/doc-001" } },
  { id: "rep-002", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", report_type: "FuelEU", year: 2025, title: "FuelEU Maritime annual report 2025", status: "DRAFT", generated_at: "2025-12-20", submission_deadline: "2026-04-30", deep_link: { label: "View vessel", path: "/fleet/9074729" } },
  { id: "rep-003", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", report_type: "EU_ETS", year: 2025, title: "EU ETS emissions report 2025", status: "DRAFT", generated_at: "2025-12-20", submission_deadline: "2026-09-30", deep_link: { label: "View vessel", path: "/fleet/9074729" } },
  { id: "rep-004", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", report_type: "MRV", year: 2024, title: "MRV emissions report 2024", status: "SUBMITTED", generated_at: "2025-04-10", submission_deadline: "2025-04-30", deep_link: { label: "View vessel", path: "/fleet/9074729" } },
  { id: "rep-005", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", imo: "9812345", report_type: "FuelEU", year: 2025, title: "FuelEU Maritime annual report 2025", status: "DRAFT", generated_at: "2025-12-22", submission_deadline: "2026-04-30", deep_link: { label: "View vessel", path: "/fleet/9812345" } },
  { id: "rep-006", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", imo: "9812345", report_type: "EU_ETS", year: 2024, title: "EU ETS emissions report 2024", status: "SUBMITTED", generated_at: "2025-04-11", submission_deadline: "2025-09-30", deep_link: { label: "View vessel", path: "/fleet/9812345" } },
  { id: "rep-007", vessel_id: "vessel-003", vessel_name: "MV Ocean Guardian", imo: "9412345", report_type: "MRV", year: 2025, title: "MRV emissions report 2025", status: "DRAFT", generated_at: "2025-12-21", submission_deadline: "2026-04-30", deep_link: { label: "View vessel", path: "/fleet/9412345" } },
  { id: "rep-008", vessel_id: "vessel-005", vessel_name: "MV Mediterranean Star", imo: "9912345", report_type: "FuelEU", year: 2026, title: "FuelEU Maritime annual report 2026", status: "NOT_STARTED", generated_at: null, submission_deadline: "2027-04-30", deep_link: { label: "View vessel", path: "/fleet/9912345" } },
];

const VERIFIER_PACKAGES: ReadonlyArray<MockRecord> = [
  { id: "vp-001", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", year: 2024, title: "Verifier package 2024 — Aurelia", status: "SUBMITTED", generated_at: "2025-05-01", deep_link: { label: "View package", path: "/fleet/9074729" } },
  { id: "vp-002", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", year: 2025, title: "Verifier package 2025 — Aurelia", status: "IN_PROGRESS", generated_at: "2026-01-10", deep_link: { label: "View package", path: "/fleet/9074729" } },
  { id: "vp-003", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", imo: "9812345", year: 2024, title: "Verifier package 2024 — Poseidon Voyager", status: "SUBMITTED", generated_at: "2025-04-30", deep_link: { label: "View package", path: "/fleet/9812345" } },
  { id: "vp-004", vessel_id: "vessel-003", vessel_name: "MV Ocean Guardian", imo: "9412345", year: 2025, title: "Verifier package 2025 — Ocean Guardian", status: "NOT_STARTED", generated_at: null, deep_link: { label: "View package", path: "/fleet/9412345" } },
];

const AUDIT_EVENTS: ReadonlyArray<MockRecord> = [
  { id: "audit-001", organization_id: "org-001", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Search executed", actor: "user-001", actor_role: "OPERATOR", event_type: "SEARCH_EXECUTED", entity: "search", entity_id: null, description: "User executed a search across documents", timestamp: "2026-07-30T09:12:00Z", deep_link: { label: "Open analytics", path: "/analytics" } },
  { id: "audit-002", organization_id: "org-001", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Document uploaded", actor: "user-001", actor_role: "OPERATOR", event_type: "DOCUMENT_UPLOAD", entity: "document", entity_id: "doc-002", description: "BDN uploaded via email (Palma, 2025-06-18)", timestamp: "2025-06-19T08:40:00Z", deep_link: { label: "Open document", path: "/documents/doc-002" } },
  { id: "audit-003", organization_id: "org-001", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Validation run", actor: "user-001", actor_role: "OPERATOR", event_type: "VALIDATION_RUN", entity: "validation", entity_id: "vr-001", description: "FuelEU 2025 validation run completed", timestamp: "2025-12-10T15:30:00Z", deep_link: { label: "View validation", path: "/review" } },
  { id: "audit-004", organization_id: "org-001", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Report generated", actor: "user-002", actor_role: "COMPLIANCE_OFFICER", event_type: "REPORT_GENERATED", entity: "report", entity_id: "rep-002", description: "FuelEU annual report generated", timestamp: "2025-12-20T10:00:00Z", deep_link: { label: "View report", path: "/fleet/9074729" } },
  { id: "audit-005", organization_id: "org-001", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Review task created", actor: "user-003", actor_role: "REVIEWER", event_type: "REVIEW_TASK_CREATED", entity: "review_task", entity_id: "rt-001", description: "Review task created for low-confidence BDN", timestamp: "2025-10-07T11:20:00Z", deep_link: { label: "Open review", path: "/review/rt-001" } },
  { id: "audit-006", organization_id: "org-001", vessel_id: "vessel-001", vessel_name: "MV Aurelia", imo: "9074729", title: "Tool executed", actor: "user-001", actor_role: "OPERATOR", event_type: "TOOL_EXECUTED", entity: "tool", entity_id: "get_vessel_compliance_score", description: "Compliance score tool executed", timestamp: "2026-07-15T13:45:00Z", deep_link: { label: "Open analytics", path: "/analytics" } },
  { id: "audit-007", organization_id: "org-001", title: "User signed in", actor: "user-002", actor_role: "COMPLIANCE_OFFICER", event_type: "LOGIN", entity: "session", entity_id: null, description: "User signed in", timestamp: "2026-07-30T08:00:00Z", deep_link: { label: "Open analytics", path: "/analytics" } },
  { id: "audit-008", organization_id: "org-001", vessel_id: "vessel-002", vessel_name: "MV Poseidon Voyager", imo: "9812345", title: "Saved search created", actor: "user-001", actor_role: "OPERATOR", event_type: "SAVED_SEARCH_CREATED", entity: "saved_search", entity_id: "saved-1", description: "Saved search 'BDN audit' created", timestamp: "2026-07-28T16:10:00Z", deep_link: { label: "Open analytics", path: "/analytics" } },
];

const REGULATORY_KB: ReadonlyArray<MockRecord> = [
  { id: "reg-001", document_id: "kb-1", source_title: "FuelEU Maritime Regulation (EU) 2023/1805", title: "Reduction of ships' greenhouse gas intensity", regulation: "FuelEU Maritime", article_section: "Article 1 — Subject matter", version: "2023", content: "This Regulation lays down rules for reducing greenhouse gas intensity of energy used on board ships calling at EEA ports.", relevance_score: 0.95, deep_link: { label: "Ask Compliance Assistant", path: "/compliance-assistant" } },
  { id: "reg-002", document_id: "kb-2", source_title: "EU ETS Directive 2003/87/EC", title: "Maritime transport included in EU ETS", regulation: "EU ETS", article_section: "Article 3ga — Maritime transport", version: "2023-10", content: "Emissions from maritime transport activities are included in the EU ETS from 2024, phased in progressively.", relevance_score: 0.9, deep_link: { label: "Ask Compliance Assistant", path: "/compliance-assistant" } },
  { id: "reg-003", document_id: "kb-3", source_title: "EU MRV Regulation (EU) 2015/757", title: "Monitoring, reporting and verification", regulation: "EU MRV", article_section: "Article 4 — Monitoring and reporting", version: "2023", content: "Companies shall monitor CO2 emissions of ships on voyages to, from and within EEA ports.", relevance_score: 0.92, deep_link: { label: "Ask Compliance Assistant", path: "/compliance-assistant" } },
  { id: "reg-004", document_id: "kb-4", source_title: "MARPOL Annex VI", title: "Energy efficiency requirements", regulation: "MARPOL", article_section: "Regulation 22 — Attained EEDI", version: "2021", content: "Ships must meet energy efficiency requirements including EEDI and EEXI.", relevance_score: 0.88, deep_link: { label: "Ask Compliance Assistant", path: "/compliance-assistant" } },
  { id: "reg-005", document_id: "kb-5", source_title: "FuelEU Maritime Regulation (EU) 2023/1805", title: "Compliance balance and pooling", regulation: "FuelEU Maritime", article_section: "Article 20 — Compliance surplus and pooling", version: "2023", content: "Compliance surpluses may be banked and compliance deficits may be pooled between ships.", relevance_score: 0.89, deep_link: { label: "Ask Compliance Assistant", path: "/compliance-assistant" } },
];

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
  for (const key of ["timestamp", "uploaded_at", "processed_at", "generated_at", "created_at", "delivery_date", "arrival_date", "departure_date"]) {
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
