import type {
  CaptainVessel,
  IngestEvent,
  IsccStatus,
  PortCall,
  PortRequirement,
  VesselDocumentStatus,
} from "./types";

export type CaptainScenarioKey =
  | "green"
  | "amber"
  | "red"
  | "bdn-received"
  | "bdn-processing"
  | "bdn-review"
  | "bdn-complete"
  | "upcoming-port"
  | "no-port"
  | "unknown";

export const CAPTAIN_MOCK_NOW = "2026-08-01T12:00:00.000Z";

export const CAPTAIN_MOCK_VESSELS: ReadonlyArray<CaptainVessel> = [
  { vesselId: "vsl-aurelia", name: "Aurelia", imo: "9074729" },
  { vesselId: "vsl-serenity", name: "Serenity", imo: "9384711" },
  { vesselId: "vsl-marguerite", name: "Marguerite", imo: "9612358" },
];

export const AURELIA: CaptainVessel = CAPTAIN_MOCK_VESSELS[0]!;

export interface CaptainNotificationSeed {
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly severity: "INFO" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly timestamp: string;
}

export interface CaptainMockState {
  readonly vessel: CaptainVessel;
  readonly portCalls: ReadonlyArray<PortCall>;
  readonly requirements: ReadonlyArray<PortRequirement>;
  readonly documents: ReadonlyArray<VesselDocumentStatus>;
  readonly iscc: IsccStatus;
  readonly ingest: ReadonlyArray<IngestEvent>;
  readonly notifications: ReadonlyArray<CaptainNotificationSeed>;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function addHours(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString();
}

const ANTIBES_REQUIREMENTS: ReadonlyArray<PortRequirement> = [
  {
    id: "req-antibes-bdn",
    port: "Antibes",
    requirement: "BDN evidence for bunker delivery",
    category: "BDN",
    blocking: true,
    reference: "FuelEU Maritime — Regulation (EU) 2023/1805, Art. 12; MRV verification file",
  },
  {
    id: "req-antibes-iapp",
    port: "Antibes",
    requirement: "IAPP certificate (MARPOL Annex VI)",
    category: "CERTIFICATE",
    blocking: true,
    reference: "MARPOL Annex VI, Reg. 6/8",
  },
  {
    id: "req-antibes-monitoring-plan",
    port: "Antibes",
    requirement: "Approved monitoring plan",
    category: "DOCUMENT",
    blocking: true,
    reference: "Regulation (EU) 2018/2066, Art. 12",
  },
  {
    id: "req-antibes-iscc",
    port: "Antibes",
    requirement: "ISCC certificate (biofuel blend)",
    category: "CERTIFICATE",
    blocking: false,
    reference: "FuelEU Maritime — ISCC EU certification",
  },
];

function buildAntibesPortCalls(): ReadonlyArray<PortCall> {
  return [
    {
      id: "pc-antibes",
      port: "Antibes",
      arrivalDate: addDays(CAPTAIN_MOCK_NOW, 5),
      departureDate: addDays(CAPTAIN_MOCK_NOW, 7),
      status: "CONFIRMED",
    },
  ];
}

function buildPalmaPortCalls(): ReadonlyArray<PortCall> {
  return [
    {
      id: "pc-palma",
      port: "Palma",
      arrivalDate: addDays(CAPTAIN_MOCK_NOW, 12),
      departureDate: addDays(CAPTAIN_MOCK_NOW, 14),
      status: "ESTIMATED",
    },
  ];
}

function buildFullDocuments(): ReadonlyArray<VesselDocumentStatus> {
  return [
    {
      documentId: "doc-iapp",
      documentType: "IAPP_CERTIFICATE",
      title: "IAPP Certificate",
      status: "VALID",
      requiredForArrival: true,
      expiresAt: addDays(CAPTAIN_MOCK_NOW, 240),
    },
    {
      documentId: "doc-monitoring-plan",
      documentType: "MONITORING_PLAN",
      title: "Monitoring Plan",
      status: "VALID",
      requiredForArrival: true,
      expiresAt: null,
    },
    {
      documentId: "doc-iscc",
      documentType: "ISCC_CERTIFICATE",
      title: "ISCC Certificate",
      status: "VALID",
      requiredForArrival: false,
      expiresAt: addDays(CAPTAIN_MOCK_NOW, 180),
    },
  ];
}

function buildMissingIsccDocuments(): ReadonlyArray<VesselDocumentStatus> {
  return [
    {
      documentId: "doc-iapp",
      documentType: "IAPP_CERTIFICATE",
      title: "IAPP Certificate",
      status: "VALID",
      requiredForArrival: true,
      expiresAt: addDays(CAPTAIN_MOCK_NOW, 240),
    },
    {
      documentId: "doc-monitoring-plan",
      documentType: "MONITORING_PLAN",
      title: "Monitoring Plan",
      status: "VALID",
      requiredForArrival: true,
      expiresAt: null,
    },
  ];
}

function buildMissingIappDocuments(): ReadonlyArray<VesselDocumentStatus> {
  return [
    {
      documentId: "doc-monitoring-plan",
      documentType: "MONITORING_PLAN",
      title: "Monitoring Plan",
      status: "VALID",
      requiredForArrival: true,
      expiresAt: null,
    },
    {
      documentId: "doc-iscc",
      documentType: "ISCC_CERTIFICATE",
      title: "ISCC Certificate",
      status: "VALID",
      requiredForArrival: false,
      expiresAt: addDays(CAPTAIN_MOCK_NOW, 180),
    },
  ];
}

function buildCompleteIngest(): ReadonlyArray<IngestEvent> {
  return [
    {
      id: "ingest-bdn-001",
      vesselId: AURELIA.vesselId,
      documentType: "BDN",
      fileName: "bdn-palma-2026-001.pdf",
      receivedAt: addDays(CAPTAIN_MOCK_NOW, -2),
      status: "completed",
      detail: "BDN processed, validated and ready for verification file.",
    },
  ];
}

function buildReceivedIngest(): ReadonlyArray<IngestEvent> {
  return [
    {
      id: "ingest-bdn-002",
      vesselId: AURELIA.vesselId,
      documentType: "BDN",
      fileName: "bdn-antibes-2026-001.pdf",
      receivedAt: addHours(CAPTAIN_MOCK_NOW, -5),
      status: "received",
      detail: "Email received by imo9074729@docs.poseidonledger.com. Awaiting processing.",
    },
  ];
}

function buildProcessingIngest(): ReadonlyArray<IngestEvent> {
  return [
    {
      id: "ingest-bdn-002",
      vesselId: AURELIA.vesselId,
      documentType: "BDN",
      fileName: "bdn-antibes-2026-001.pdf",
      receivedAt: addHours(CAPTAIN_MOCK_NOW, -5),
      status: "processing",
      detail: "Document in OCR / AI extraction queue.",
    },
  ];
}

function buildReviewIngest(): ReadonlyArray<IngestEvent> {
  return [
    {
      id: "ingest-bdn-002",
      vesselId: AURELIA.vesselId,
      documentType: "BDN",
      fileName: "bdn-antibes-2026-001.pdf",
      receivedAt: addHours(CAPTAIN_MOCK_NOW, -12),
      status: "needs_review",
      detail: "Extraction complete but some fields need review.",
    },
  ];
}

export function createMockCaptainState(scenario: CaptainScenarioKey): CaptainMockState {
  const base = {
    vessel: AURELIA,
    requirements: ANTIBES_REQUIREMENTS,
  };

  switch (scenario) {
    case "green":
      return {
        ...base,
        portCalls: buildAntibesPortCalls(),
        documents: buildFullDocuments(),
        iscc: {
          present: true,
          documentId: "doc-iscc",
          expiresAt: addDays(CAPTAIN_MOCK_NOW, 180),
          status: "VALID",
        },
        ingest: buildCompleteIngest(),
        notifications: [
          {
            type: "bdn_auto_accepted",
            title: "BDN received",
            message: "bdn-palma-2026-001.pdf received and processed.",
            severity: "INFO",
            timestamp: addDays(CAPTAIN_MOCK_NOW, -2),
          },
        ],
      };

    case "red":
      return {
        ...base,
        portCalls: buildAntibesPortCalls(),
        documents: buildMissingIappDocuments(),
        iscc: {
          present: true,
          documentId: "doc-iscc",
          expiresAt: addDays(CAPTAIN_MOCK_NOW, 180),
          status: "VALID",
        },
        ingest: buildCompleteIngest(),
        notifications: [
          {
            type: "green_zone_port_alert",
            title: "Port readiness warning",
            message: "IAPP certificate missing before Antibes arrival.",
            severity: "CRITICAL",
            timestamp: addDays(CAPTAIN_MOCK_NOW, -1),
          },
        ],
      };

    case "bdn-received":
      return {
        ...base,
        portCalls: buildAntibesPortCalls(),
        documents: buildFullDocuments(),
        iscc: { present: true, documentId: "doc-iscc", expiresAt: addDays(CAPTAIN_MOCK_NOW, 180), status: "VALID" },
        ingest: buildReceivedIngest(),
        notifications: [
          {
            type: "bdn_auto_accepted",
            title: "BDN received",
            message: "bdn-antibes-2026-001.pdf received by imo9074729@docs.poseidonledger.com.",
            severity: "INFO",
            timestamp: addHours(CAPTAIN_MOCK_NOW, -5),
          },
        ],
      };

    case "bdn-processing":
      return {
        ...base,
        portCalls: buildAntibesPortCalls(),
        documents: buildFullDocuments(),
        iscc: { present: true, documentId: "doc-iscc", expiresAt: addDays(CAPTAIN_MOCK_NOW, 180), status: "VALID" },
        ingest: buildProcessingIngest(),
        notifications: [
          {
            type: "bdn_auto_accepted",
            title: "BDN processing",
            message: "bdn-antibes-2026-001.pdf is in OCR / AI extraction.",
            severity: "INFO",
            timestamp: addHours(CAPTAIN_MOCK_NOW, -2),
          },
        ],
      };

    case "bdn-review":
      return {
        ...base,
        portCalls: buildAntibesPortCalls(),
        documents: buildFullDocuments(),
        iscc: { present: true, documentId: "doc-iscc", expiresAt: addDays(CAPTAIN_MOCK_NOW, 180), status: "VALID" },
        ingest: buildReviewIngest(),
        notifications: [
          {
            type: "bdn_review_required",
            title: "BDN needs review",
            message: "Some fields in bdn-antibes-2026-001.pdf need review.",
            severity: "MEDIUM",
            timestamp: addHours(CAPTAIN_MOCK_NOW, -7),
          },
        ],
      };

    case "bdn-complete":
      return {
        ...base,
        portCalls: buildAntibesPortCalls(),
        documents: buildFullDocuments(),
        iscc: { present: true, documentId: "doc-iscc", expiresAt: addDays(CAPTAIN_MOCK_NOW, 180), status: "VALID" },
        ingest: buildCompleteIngest(),
        notifications: [
          {
            type: "bdn_auto_accepted",
            title: "BDN complete",
            message: "bdn-palma-2026-001.pdf validated and ready.",
            severity: "INFO",
            timestamp: addDays(CAPTAIN_MOCK_NOW, -2),
          },
        ],
      };

    case "upcoming-port":
      return {
        ...base,
        portCalls: buildAntibesPortCalls(),
        documents: buildFullDocuments(),
        iscc: { present: true, documentId: "doc-iscc", expiresAt: addDays(CAPTAIN_MOCK_NOW, 180), status: "VALID" },
        ingest: buildCompleteIngest(),
        notifications: [
          {
            type: "green_zone_port_alert",
            title: "Upcoming port call",
            message: "Antibes (Port Vauban) — arrival in 5 days.",
            severity: "INFO",
            timestamp: addDays(CAPTAIN_MOCK_NOW, -1),
          },
        ],
      };

    case "no-port":
      return {
        ...base,
        portCalls: [],
        documents: buildFullDocuments(),
        iscc: { present: true, documentId: "doc-iscc", expiresAt: addDays(CAPTAIN_MOCK_NOW, 180), status: "VALID" },
        ingest: buildCompleteIngest(),
        notifications: [],
      };

    case "unknown":
      return {
        ...base,
        portCalls: buildPalmaPortCalls(),
        documents: buildFullDocuments(),
        iscc: { present: true, documentId: "doc-iscc", expiresAt: addDays(CAPTAIN_MOCK_NOW, 180), status: "VALID" },
        ingest: buildCompleteIngest(),
        notifications: [],
      };

    case "amber":
    default:
      return {
        ...base,
        portCalls: buildAntibesPortCalls(),
        documents: buildMissingIsccDocuments(),
        iscc: { present: false, documentId: null, expiresAt: null, status: "MISSING" },
        ingest: buildCompleteIngest(),
        notifications: [
          {
            type: "iscc_certificate_missing",
            title: "ISCC certificate missing",
            message: "No ISCC certificate on file before Antibes arrival.",
            severity: "MEDIUM",
            timestamp: addDays(CAPTAIN_MOCK_NOW, -1),
          },
        ],
      };
  }
}
