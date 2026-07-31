import type {
  CertificateRecord,
  CharterCalendarEntry,
  ClassSociety,
  ClassSocietyRecord,
  MaintenanceVessel,
  MonitoringPlanReview,
  SurveyScheduleItem,
  SurveyType,
} from "./types";
import { createStatusEngine } from "./status-engine";

export type MaintenanceScenarioKey =
  | "all-current"
  | "due-soon"
  | "overdue-annual"
  | "expired-iscc"
  | "mp-review-due"
  | "multiple-deadlines"
  | "no-schedule"
  | "unknown-class";

export const MAINTENANCE_MOCK_NOW = "2026-08-01T12:00:00.000Z";

export const MAINTENANCE_MOCK_VESSELS: ReadonlyArray<MaintenanceVessel> = [
  { vesselId: "vsl-aurelia", name: "Aurelia", imo: "9074729" },
  { vesselId: "vsl-serenity", name: "Serenity", imo: "9384711" },
  { vesselId: "vsl-marguerite", name: "Marguerite", imo: "9612358" },
];

export const AURELIA: MaintenanceVessel = MAINTENANCE_MOCK_VESSELS[0]!;

export interface MaintenanceNotificationSeed {
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly severity: "INFO" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly timestamp: string;
}

export interface MaintenanceMockState {
  readonly vessel: MaintenanceVessel;
  readonly schedule: ReadonlyArray<SurveyScheduleItem>;
  readonly certificates: ReadonlyArray<CertificateRecord>;
  readonly classSociety: ClassSocietyRecord | null;
  readonly plan: MonitoringPlanReview | null;
  readonly charterCalendar: ReadonlyArray<CharterCalendarEntry>;
  readonly notifications: ReadonlyArray<MaintenanceNotificationSeed>;
}

interface SurveySeed {
  readonly id: string;
  readonly surveyType: SurveyType;
  readonly classSociety: ClassSociety | null;
  readonly dueInDays: number | null;
  readonly lastCompletedDaysAgo: number | null;
  readonly notes: string | null;
  readonly source: string;
}

interface CertSeed {
  readonly id: string;
  readonly certificateType: string;
  readonly title: string;
  readonly issuedDaysAgo: number | null;
  readonly expiresInDays: number | null;
  readonly classSociety: ClassSociety | null;
  readonly source: string;
}

const engine = createStatusEngine();

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function buildSchedule(seeds: ReadonlyArray<SurveySeed>): ReadonlyArray<SurveyScheduleItem> {
  const raw: ReadonlyArray<SurveyScheduleItem> = seeds.map((s) => ({
    id: s.id,
    vesselId: AURELIA.vesselId,
    surveyType: s.surveyType,
    classSociety: s.classSociety,
    dueDate: addDays(MAINTENANCE_MOCK_NOW, s.dueInDays as number),
    lastCompleted: s.lastCompletedDaysAgo === null ? null : addDays(MAINTENANCE_MOCK_NOW, -s.lastCompletedDaysAgo),
    status: "UNKNOWN",
    source: s.source,
    notes: s.notes,
    effectiveDate: addDays(MAINTENANCE_MOCK_NOW, -30),
    createdAt: addDays(MAINTENANCE_MOCK_NOW, -120),
    updatedAt: addDays(MAINTENANCE_MOCK_NOW, -7),
  }));
  return engine.evaluateSchedule(raw, MAINTENANCE_MOCK_NOW);
}

function buildCertificates(seeds: ReadonlyArray<CertSeed>): ReadonlyArray<CertificateRecord> {
  const raw: ReadonlyArray<CertificateRecord> = seeds.map((c) => ({
    id: c.id,
    vesselId: AURELIA.vesselId,
    certificateType: c.certificateType,
    title: c.title,
    issuedAt: c.issuedDaysAgo === null ? null : addDays(MAINTENANCE_MOCK_NOW, -c.issuedDaysAgo),
    expiresAt: c.expiresInDays === null ? null : addDays(MAINTENANCE_MOCK_NOW, c.expiresInDays),
    status: "VALID",
    classSociety: c.classSociety,
    source: c.source,
  }));
  return engine.evaluateCertificates(raw, MAINTENANCE_MOCK_NOW);
}

function buildPlan(nextReviewInDays: number | null): MonitoringPlanReview {
  return {
    vesselId: AURELIA.vesselId,
    planVersion: "1.3",
    approvedAt: addDays(MAINTENANCE_MOCK_NOW, -412),
    nextReviewDue: nextReviewInDays === null ? null : addDays(MAINTENANCE_MOCK_NOW, nextReviewInDays),
    reviewStatus: nextReviewInDays === null ? "UNKNOWN" : engine.surveyStatus(addDays(MAINTENANCE_MOCK_NOW, nextReviewInDays), true, MAINTENANCE_MOCK_NOW),
    source: "Regulation (EU) 2018/2066, Art. 12",
  };
}

function buildCharterCalendar(includeWindow: boolean): ReadonlyArray<CharterCalendarEntry> {
  return [
    {
      id: "charter-q3-2026",
      vesselId: AURELIA.vesselId,
      period: "Q3 2026",
      startDate: addDays(MAINTENANCE_MOCK_NOW, -31),
      endDate: addDays(MAINTENANCE_MOCK_NOW, 60),
      charterType: "time charter",
      counterParty: "MedAxis Shipping",
      portCalls: ["Genoa", "Antibes", "Palma"],
      maintenanceWindow: false,
    },
    ...(includeWindow
      ? [
          {
            id: "charter-q4-2026-window",
            vesselId: AURELIA.vesselId,
            period: "Q4 2026",
            startDate: addDays(MAINTENANCE_MOCK_NOW, 92),
            endDate: addDays(MAINTENANCE_MOCK_NOW, 122),
            charterType: "time charter",
            counterParty: "MedAxis Shipping",
            portCalls: ["Valencia"],
            maintenanceWindow: true,
          },
        ]
      : []),
  ];
}

const DEFAULT_SURVEY_SEEDS: ReadonlyArray<SurveySeed> = [
  {
    id: "survey-annual",
    surveyType: "ANNUAL",
    classSociety: "RINA",
    dueInDays: 200,
    lastCompletedDaysAgo: 165,
    notes: "Held in Genoa last cycle.",
    source: "RINA class survey program",
  },
  {
    id: "survey-intermediate",
    surveyType: "INTERMEDIATE",
    classSociety: "RINA",
    dueInDays: 120,
    lastCompletedDaysAgo: 245,
    notes: null,
    source: "RINA class survey program",
  },
  {
    id: "survey-special",
    surveyType: "SPECIAL",
    classSociety: "RINA",
    dueInDays: 400,
    lastCompletedDaysAgo: 5,
    notes: "Completed during Q4 2025 drydock.",
    source: "RINA class survey program",
  },
  {
    id: "survey-renewal",
    surveyType: "RENEWAL",
    classSociety: "RINA",
    dueInDays: 365,
    lastCompletedDaysAgo: 730,
    notes: null,
    source: "RINA class survey program",
  },
  {
    id: "survey-ism",
    surveyType: "ISM",
    classSociety: null,
    dueInDays: 150,
    lastCompletedDaysAgo: 210,
    notes: null,
    source: "ISM interim audit plan",
  },
  {
    id: "survey-isps",
    surveyType: "ISPS",
    classSociety: null,
    dueInDays: 150,
    lastCompletedDaysAgo: 210,
    notes: null,
    source: "ISPS verification schedule",
  },
];

const DEFAULT_CERT_SEEDS: ReadonlyArray<CertSeed> = [
  {
    id: "cert-class",
    certificateType: "CLASS_CERTIFICATE",
    title: "Class Certificate",
    issuedDaysAgo: 250,
    expiresInDays: 250,
    classSociety: "RINA",
    source: "RINA classification",
  },
  {
    id: "cert-iscc",
    certificateType: "ISCC_CERTIFICATE",
    title: "ISCC Certificate",
    issuedDaysAgo: 180,
    expiresInDays: 180,
    classSociety: null,
    source: "ISCC EU certification",
  },
  {
    id: "cert-iapp",
    certificateType: "IAPP_CERTIFICATE",
    title: "IAPP Certificate",
    issuedDaysAgo: 120,
    expiresInDays: 240,
    classSociety: null,
    source: "MARPOL Annex VI, Reg. 8",
  },
];

function buildState(
  schedule: ReadonlyArray<SurveySeed>,
  certificates: ReadonlyArray<CertSeed>,
  classSociety: ClassSocietyRecord | null,
  plan: MonitoringPlanReview,
  charter: ReadonlyArray<CharterCalendarEntry>,
  notifications: ReadonlyArray<MaintenanceNotificationSeed>,
): MaintenanceMockState {
  return {
    vessel: AURELIA,
    schedule: buildSchedule(schedule),
    certificates: buildCertificates(certificates),
    classSociety,
    plan,
    charterCalendar: charter,
    notifications,
  };
}

export function createMockMaintenanceState(scenario: MaintenanceScenarioKey): MaintenanceMockState {
  const classRecord: ClassSocietyRecord = {
    vesselId: AURELIA.vesselId,
    classSociety: "RINA",
    classificationStatus: "In class",
    memberNumber: "RINA-33021",
    known: true,
    status: "IN_CLASS",
    source: "RINA classification record",
  };

  const unknownClassRecord: ClassSocietyRecord = {
    vesselId: AURELIA.vesselId,
    classSociety: "OTHER",
    classificationStatus: "Unknown",
    memberNumber: null,
    known: false,
    status: "UNKNOWN",
    source: "No class record on file",
  };

  switch (scenario) {
    case "due-soon":
      return buildState(
        [
          { ...DEFAULT_SURVEY_SEEDS[0]!, dueInDays: 21 },
          { ...DEFAULT_SURVEY_SEEDS[1]!, dueInDays: 45 },
          { ...DEFAULT_SURVEY_SEEDS[2]!, dueInDays: 400 },
          { ...DEFAULT_SURVEY_SEEDS[3]!, dueInDays: 365 },
          { ...DEFAULT_SURVEY_SEEDS[4]!, dueInDays: 10 },
          { ...DEFAULT_SURVEY_SEEDS[5]!, dueInDays: 150 },
        ],
        [
          { ...DEFAULT_CERT_SEEDS[0]! },
          { ...DEFAULT_CERT_SEEDS[1]!, expiresInDays: 25 },
          { ...DEFAULT_CERT_SEEDS[2]! },
        ],
        classRecord,
        buildPlan(300),
        buildCharterCalendar(true),
        [
          {
            type: "survey_due",
            title: "ISM audit due",
            message: "ISM audit due in 10 days.",
            severity: "MEDIUM",
            timestamp: addDays(MAINTENANCE_MOCK_NOW, -1),
          },
          {
            type: "certificate_expiring",
            title: "ISCC certificate expiring",
            message: "ISCC certificate expires in 25 days.",
            severity: "MEDIUM",
            timestamp: addDays(MAINTENANCE_MOCK_NOW, -2),
          },
        ],
      );

    case "overdue-annual":
      return buildState(
        [
          { ...DEFAULT_SURVEY_SEEDS[0]!, dueInDays: -18 },
          { ...DEFAULT_SURVEY_SEEDS[1]!, dueInDays: 120 },
          { ...DEFAULT_SURVEY_SEEDS[2]!, dueInDays: 400 },
          { ...DEFAULT_SURVEY_SEEDS[3]!, dueInDays: 365 },
          { ...DEFAULT_SURVEY_SEEDS[4]!, dueInDays: 150 },
          { ...DEFAULT_SURVEY_SEEDS[5]!, dueInDays: 150 },
        ],
        [
          { ...DEFAULT_CERT_SEEDS[0]! },
          { ...DEFAULT_CERT_SEEDS[1]! },
          { ...DEFAULT_CERT_SEEDS[2]!, expiresInDays: 5 },
        ],
        classRecord,
        buildPlan(300),
        buildCharterCalendar(true),
        [
          {
            type: "survey_overdue",
            title: "Annual survey overdue",
            message: "Annual survey passed its due date 18 days ago.",
            severity: "HIGH",
            timestamp: addDays(MAINTENANCE_MOCK_NOW, -3),
          },
        ],
      );

    case "expired-iscc":
      return buildState(
        DEFAULT_SURVEY_SEEDS,
        [
          { ...DEFAULT_CERT_SEEDS[0]! },
          { ...DEFAULT_CERT_SEEDS[1]!, expiresInDays: -12 },
          { ...DEFAULT_CERT_SEEDS[2]! },
        ],
        classRecord,
        buildPlan(300),
        buildCharterCalendar(true),
        [
          {
            type: "iscc_certificate_expiring",
            title: "ISCC certificate expired",
            message: "ISCC certificate expired 12 days ago.",
            severity: "HIGH",
            timestamp: addDays(MAINTENANCE_MOCK_NOW, -4),
          },
        ],
      );

    case "mp-review-due":
      return buildState(
        DEFAULT_SURVEY_SEEDS,
        DEFAULT_CERT_SEEDS,
        classRecord,
        buildPlan(25),
        buildCharterCalendar(true),
        [
          {
            type: "monitoring_plan_review_due",
            title: "Monitoring plan review due",
            message: "Monitoring plan review due in 25 days.",
            severity: "MEDIUM",
            timestamp: addDays(MAINTENANCE_MOCK_NOW, -1),
          },
        ],
      );

    case "multiple-deadlines":
      return buildState(
        [
          { ...DEFAULT_SURVEY_SEEDS[0]!, dueInDays: 15 },
          { ...DEFAULT_SURVEY_SEEDS[1]!, dueInDays: 120 },
          { ...DEFAULT_SURVEY_SEEDS[2]!, dueInDays: 400 },
          { ...DEFAULT_SURVEY_SEEDS[3]!, dueInDays: -5 },
          { ...DEFAULT_SURVEY_SEEDS[4]!, dueInDays: 12 },
          { ...DEFAULT_SURVEY_SEEDS[5]!, dueInDays: 150 },
        ],
        [
          { ...DEFAULT_CERT_SEEDS[0]!, expiresInDays: -10 },
          { ...DEFAULT_CERT_SEEDS[1]!, expiresInDays: 20 },
          { ...DEFAULT_CERT_SEEDS[2]! },
        ],
        classRecord,
        buildPlan(45),
        buildCharterCalendar(true),
        [
          {
            type: "blocking_maintenance_detected",
            title: "Renewal survey overdue",
            message: "Renewal survey passed its due date 5 days ago.",
            severity: "CRITICAL",
            timestamp: addDays(MAINTENANCE_MOCK_NOW, -1),
          },
          {
            type: "blocking_maintenance_detected",
            title: "Class certificate expired",
            message: "Class certificate expired 10 days ago.",
            severity: "CRITICAL",
            timestamp: addDays(MAINTENANCE_MOCK_NOW, -2),
          },
        ],
      );

    case "no-schedule":
      return buildState([], [], classRecord, buildPlan(null), buildCharterCalendar(true), []);

    case "unknown-class":
      return buildState(
        [
          { ...DEFAULT_SURVEY_SEEDS[0]! },
          { ...DEFAULT_SURVEY_SEEDS[3]!, dueInDays: 20 },
        ],
        [
          { ...DEFAULT_CERT_SEEDS[0]!, classSociety: "OTHER" },
          { ...DEFAULT_CERT_SEEDS[1]! },
        ],
        unknownClassRecord,
        buildPlan(300),
        buildCharterCalendar(true),
        [
          {
            type: "survey_due",
            title: "Renewal survey due",
            message: "Renewal survey due in 20 days; class society not on file.",
            severity: "MEDIUM",
            timestamp: addDays(MAINTENANCE_MOCK_NOW, -1),
          },
        ],
      );

    case "all-current":
    default:
      return buildState(
        DEFAULT_SURVEY_SEEDS,
        DEFAULT_CERT_SEEDS,
        classRecord,
        buildPlan(300),
        buildCharterCalendar(true),
        [
          {
            type: "survey_due",
            title: "All surveys current",
            message: "No survey is due within the next 90 days.",
            severity: "INFO",
            timestamp: addDays(MAINTENANCE_MOCK_NOW, -1),
          },
        ],
      );
  }
}
