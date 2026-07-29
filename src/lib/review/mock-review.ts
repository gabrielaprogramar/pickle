import type {
  ReviewProvider,
  ReviewTaskDetail,
  FieldReview,
  AuditEntry,
} from "./types";

const NOW = "2026-07-29T10:00:00.000Z";
const REVIEWER = "alice@poseidon-ledger.io";

function makeFieldReview(
  overrides: Partial<FieldReview> & { fieldName: string; extractedValue: unknown },
): FieldReview {
  return {
    status: "pending",
    confidence: 0.95,
    warnings: [],
    ...overrides,
  };
}

const BDN_TASK: ReviewTaskDetail = {
  task: {
    id: "review-bdn-001",
    document_id: "doc-bdn-001",
    assigned_to: REVIEWER,
    status: "in_progress",
    priority: "high",
    due_at: "2026-08-05T10:00:00.000Z",
    completed_at: null,
    review_note: null,
    created_at: "2026-07-28T08:00:00.000Z",
    updated_at: "2026-07-28T08:00:00.000Z",
  },
  document: {
    id: "doc-bdn-001",
    title: "BDN — Port of Rotterdam — June 2026",
    filename: "bdn_rotterdam_jun2026.pdf",
    document_type: "imo_dcs",
    status: "under_review",
    vessel_id: "vessel-001",
    created_at: "2026-07-27T10:00:00.000Z",
  },
  validationScore: 100,
  validationStatus: "passed",
  readyForReview: true,
  aiConfidence: 0.97,
  aiSummary: "Bunker Delivery Note for M/V Test Vessel. 1,500 MT VLSFO delivered at Rotterdam on 15 June 2026. Supplier: Maritime Fuels B.V.",
  extractedFields: {
    imoNumber: "9876543",
    vesselName: "Test Vessel",
    deliveryDate: "2026-06-15",
    quantityTonnes: 1500,
    sulphurContentPct: 0.5,
    densityKgM3: 985,
    port: "Rotterdam",
    fuelType: "VLSFO",
    supplier: "Maritime Fuels B.V.",
  },
  ocrText: "BUNKER DELIVERY NOTE\n\nIMO Number: 9876543\nVessel Name: Test Vessel\nPort: Rotterdam\nDate: 2026-06-15\nFuel Type: VLSFO\nQuantity: 1,500 MT\nSulphur: 0.50%\nDensity: 985 kg/m³\nSupplier: Maritime Fuels B.V.",
  fieldReviews: [
    makeFieldReview({ fieldName: "imoNumber", extractedValue: "9876543", confidence: 0.99 }),
    makeFieldReview({ fieldName: "vesselName", extractedValue: "Test Vessel", confidence: 0.98 }),
    makeFieldReview({ fieldName: "deliveryDate", extractedValue: "2026-06-15", confidence: 0.99 }),
    makeFieldReview({ fieldName: "quantityTonnes", extractedValue: 1500, confidence: 0.95 }),
    makeFieldReview({ fieldName: "sulphurContentPct", extractedValue: 0.5, confidence: 0.94 }),
    makeFieldReview({ fieldName: "densityKgM3", extractedValue: 985, confidence: 0.9 }),
    makeFieldReview({ fieldName: "port", extractedValue: "Rotterdam", confidence: 0.99 }),
    makeFieldReview({ fieldName: "fuelType", extractedValue: "VLSFO", confidence: 0.97 }),
    makeFieldReview({ fieldName: "supplier", extractedValue: "Maritime Fuels B.V.", confidence: 0.88 }),
  ],
  auditHistory: [
    {
      id: "audit-001",
      reviewTaskId: "review-bdn-001",
      action: "assigned",
      reviewer: "system",
      notes: `Task assigned to ${REVIEWER}`,
      createdAt: "2026-07-28T08:00:00.000Z",
    },
  ],
};

const CII_TASK: ReviewTaskDetail = {
  task: {
    id: "review-cii-001",
    document_id: "doc-cii-001",
    assigned_to: null,
    status: "pending",
    priority: "normal",
    due_at: "2026-08-10T10:00:00.000Z",
    completed_at: null,
    review_note: null,
    created_at: "2026-07-28T09:00:00.000Z",
    updated_at: "2026-07-28T09:00:00.000Z",
  },
  document: {
    id: "doc-cii-001",
    title: "CII Report — M/V Test Vessel — 2025",
    filename: "cii_report_2025.pdf",
    document_type: "report",
    status: "under_review",
    vessel_id: "vessel-001",
    created_at: "2026-07-26T10:00:00.000Z",
  },
  validationScore: 100,
  validationStatus: "passed",
  readyForReview: true,
  aiConfidence: 0.94,
  aiSummary: "CII Annual Report for M/V Test Vessel (IMO 9876543). Operational CII: 5.2 gCO2/DWT-nm. Required CII: 5.8 gCO2/DWT-nm. Rating: A.",
  extractedFields: {
    imoNumber: "9876543",
    vesselName: "Test Vessel",
    operationalCii: 5.2,
    requiredCii: 5.8,
    attainedEexi: 4.9,
    rating: "A",
    reportingPeriod: "2025-01-01/2025-12-31",
  },
  ocrText: "CII ANNUAL REPORT\n\nIMO Number: 9876543\nVessel: Test Vessel\nPeriod: 2025\nOperational CII: 5.2 gCO2/DWT-nm\nRequired CII: 5.8 gCO2/DWT-nm\nAttained EEXI: 4.9\nRating: A",
  fieldReviews: [
    makeFieldReview({ fieldName: "imoNumber", extractedValue: "9876543", confidence: 0.99 }),
    makeFieldReview({ fieldName: "vesselName", extractedValue: "Test Vessel", confidence: 0.98 }),
    makeFieldReview({ fieldName: "operationalCii", extractedValue: 5.2, confidence: 0.93 }),
    makeFieldReview({ fieldName: "requiredCii", extractedValue: 5.8, confidence: 0.92 }),
    makeFieldReview({ fieldName: "rating", extractedValue: "A", confidence: 0.96 }),
  ],
  auditHistory: [
    {
      id: "audit-cii-001",
      reviewTaskId: "review-cii-001",
      action: "assigned",
      reviewer: "system",
      notes: "Task created — awaiting assignment",
      createdAt: "2026-07-28T09:00:00.000Z",
    },
  ],
};

const EU_ETS_TASK: ReviewTaskDetail = {
  task: {
    id: "review-euets-001",
    document_id: "doc-euets-001",
    assigned_to: "bob@poseidon-ledger.io",
    status: "in_progress",
    priority: "urgent",
    due_at: "2026-08-01T10:00:00.000Z",
    completed_at: null,
    review_note: null,
    created_at: "2026-07-27T14:00:00.000Z",
    updated_at: "2026-07-27T14:00:00.000Z",
  },
  document: {
    id: "doc-euets-001",
    title: "EU ETS Report — Q2 2026",
    filename: "eu_ets_q2_2026.pdf",
    document_type: "eu_mrv",
    status: "under_review",
    vessel_id: "vessel-002",
    created_at: "2026-07-25T10:00:00.000Z",
  },
  validationScore: 95,
  validationStatus: "warning",
  readyForReview: true,
  aiConfidence: 0.91,
  aiSummary: "EU ETS Emissions Report for M/V Container King (IMO 9707211). Total CO2: 12,450 tonnes. Allocated allowances: 11,200 tonnes. Surrender required by 30 Sep 2026.",
  extractedFields: {
    imoNumber: "9707211",
    vesselName: "Container King",
    totalCo2Tonnes: 12450,
    allocatedAllowances: 11200,
    reportingPeriod: "2026-04-01/2026-06-30",
    verificationBody: "DNV GL",
  },
  ocrText: "EU ETS EMISSIONS REPORT\n\nIMO Number: 9707211\nVessel: Container King\nPeriod: Q2 2026\nTotal CO2: 12,450 t\nAllocated Allowances: 11,200 t\nVerification: DNV GL",
  fieldReviews: [
    makeFieldReview({ fieldName: "imoNumber", extractedValue: "9707211", confidence: 0.99 }),
    makeFieldReview({ fieldName: "vesselName", extractedValue: "Container King", confidence: 0.98 }),
    makeFieldReview({ fieldName: "totalCo2Tonnes", extractedValue: 12450, confidence: 0.85, warnings: ["Value ±5% uncertainty from OCR"] }),
    makeFieldReview({ fieldName: "allocatedAllowances", extractedValue: 11200, confidence: 0.82, warnings: ["Value ±5% uncertainty from OCR"] }),
  ],
  auditHistory: [
    {
      id: "audit-euets-001",
      reviewTaskId: "review-euets-001",
      action: "assigned",
      reviewer: "system",
      notes: "Task assigned to bob@poseidon-ledger.io",
      createdAt: "2026-07-27T14:00:00.000Z",
    },
  ],
};

const COMPLETED_TASK: ReviewTaskDetail = {
  task: {
    id: "review-completed-001",
    document_id: "doc-completed-001",
    assigned_to: "carol@poseidon-ledger.io",
    status: "completed",
    priority: "high",
    due_at: "2026-07-20T10:00:00.000Z",
    completed_at: "2026-07-19T16:00:00.000Z",
    review_note: "All fields verified against physical BDN. Approved.",
    created_at: "2026-07-18T08:00:00.000Z",
    updated_at: "2026-07-19T16:00:00.000Z",
  },
  document: {
    id: "doc-completed-001",
    title: "BDN — Port of Singapore — May 2026",
    filename: "bdn_singapore_may2026.pdf",
    document_type: "imo_dcs",
    status: "approved",
    vessel_id: "vessel-001",
    created_at: "2026-07-17T10:00:00.000Z",
  },
  validationScore: 100,
  validationStatus: "passed",
  readyForReview: true,
  aiConfidence: 0.98,
  aiSummary: "Bunker Delivery Note for M/V Test Vessel. 2,000 MT VLSFO delivered at Singapore on 20 May 2026.",
  extractedFields: {
    imoNumber: "9876543",
    vesselName: "Test Vessel",
    deliveryDate: "2026-05-20",
    quantityTonnes: 2000,
    sulphurContentPct: 0.48,
    densityKgM3: 978,
    port: "Singapore",
    fuelType: "VLSFO",
    supplier: "Global Marine Fuels Pte Ltd",
  },
  ocrText: "BUNKER DELIVERY NOTE\n\nIMO: 9876543\nVessel: Test Vessel\nPort: Singapore\nDate: 2026-05-20\nFuel: VLSFO\nQty: 2,000 MT\nSulphur: 0.48%\nDensity: 978 kg/m³",
  fieldReviews: [
    makeFieldReview({ fieldName: "imoNumber", extractedValue: "9876543", status: "approved", reviewedValue: "9876543", reviewer: "carol@poseidon-ledger.io", reviewedAt: "2026-07-19T15:30:00.000Z" }),
    makeFieldReview({ fieldName: "vesselName", extractedValue: "Test Vessel", status: "approved", reviewedValue: "Test Vessel", reviewer: "carol@poseidon-ledger.io", reviewedAt: "2026-07-19T15:30:00.000Z" }),
    makeFieldReview({ fieldName: "deliveryDate", extractedValue: "2026-05-20", status: "approved", reviewedValue: "2026-05-20", reviewer: "carol@poseidon-ledger.io", reviewedAt: "2026-07-19T15:30:00.000Z" }),
    makeFieldReview({ fieldName: "quantityTonnes", extractedValue: 2000, status: "edited", reviewedValue: 2050, reviewer: "carol@poseidon-ledger.io", reviewedAt: "2026-07-19T15:45:00.000Z", comment: "Corrected per physical BDN: 2,050 MT" }),
    makeFieldReview({ fieldName: "sulphurContentPct", extractedValue: 0.48, status: "approved", reviewedValue: 0.48, reviewer: "carol@poseidon-ledger.io", reviewedAt: "2026-07-19T15:30:00.000Z" }),
    makeFieldReview({ fieldName: "port", extractedValue: "Singapore", status: "approved", reviewedValue: "Singapore", reviewer: "carol@poseidon-ledger.io", reviewedAt: "2026-07-19T15:30:00.000Z" }),
  ],
  auditHistory: [
    { id: "audit-c-001", reviewTaskId: "review-completed-001", action: "assigned", reviewer: "system", notes: "Task assigned to carol@poseidon-ledger.io", createdAt: "2026-07-18T08:00:00.000Z" },
    { id: "audit-c-002", reviewTaskId: "review-completed-001", action: "field_approved", fieldName: "imoNumber", reviewer: "carol@poseidon-ledger.io", createdAt: "2026-07-19T15:30:00.000Z" },
    { id: "audit-c-003", reviewTaskId: "review-completed-001", action: "field_edited", fieldName: "quantityTonnes", previousValue: 2000, newValue: 2050, reviewer: "carol@poseidon-ledger.io", notes: "Corrected per physical BDN", createdAt: "2026-07-19T15:45:00.000Z" },
    { id: "audit-c-004", reviewTaskId: "review-completed-001", action: "approved", reviewer: "carol@poseidon-ledger.io", notes: "All fields verified against physical BDN. Approved.", createdAt: "2026-07-19T16:00:00.000Z" },
  ],
};

const FIXTURES: ReviewTaskDetail[] = [
  BDN_TASK,
  CII_TASK,
  EU_ETS_TASK,
  COMPLETED_TASK,
];

export function createMockReviewProvider(): ReviewProvider {
  return {
    async getSeedTasks(): Promise<ReviewTaskDetail[]> {
      return FIXTURES.map((f) => structuredClone(f));
    },
    async getSeedTaskById(taskId: string): Promise<ReviewTaskDetail | null> {
      const fixture = FIXTURES.find((f) => f.task.id === taskId);
      return fixture ? structuredClone(fixture) : null;
    },
  };
}

export const MOCK_REVIEW_FIXTURES = {
  bdn: BDN_TASK,
  cii: CII_TASK,
  euEts: EU_ETS_TASK,
  completed: COMPLETED_TASK,
} as const;
