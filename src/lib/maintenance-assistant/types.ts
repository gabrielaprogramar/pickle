export const MAINTENANCE_ASSISTANT_VERSION = "1.0.0";

export const MAINTENANCE_SYSTEM_PROMPT_VERSION = "1.0.0";

export type SurveyStatus = "CURRENT" | "UPCOMING" | "DUE_SOON" | "OVERDUE" | "BLOCKING" | "UNKNOWN";

export type SurveyType = "ANNUAL" | "INTERMEDIATE" | "SPECIAL" | "RENEWAL" | "ISM" | "ISPS" | "OTHER";

export type ClassSociety = "DNV" | "LR" | "RINA" | "Bureau Veritas" | "ABS" | "ClassNK" | "OTHER";

export type ComplianceImpact = "FACT" | "DETERMINISTIC_IMPACT" | "ADVISORY_RECOMMENDATION";

export type CertificateStatus = "VALID" | "EXPIRING" | "EXPIRED" | "MISSING" | "PENDING_REVIEW";

export interface MaintenanceVessel {
  readonly vesselId: string;
  readonly name: string;
  readonly imo: string;
}

export interface MaintenanceContext {
  readonly operatorId: string;
  readonly organizationId: string;
  readonly vessel: MaintenanceVessel;
  readonly now?: string;
}

export interface SurveyScheduleItem {
  readonly id: string;
  readonly vesselId: string;
  readonly surveyType: SurveyType;
  readonly classSociety: ClassSociety | null;
  readonly dueDate: string;
  readonly lastCompleted: string | null;
  readonly status: SurveyStatus;
  readonly source: string;
  readonly notes: string | null;
  readonly effectiveDate: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CertificateRecord {
  readonly id: string;
  readonly vesselId: string;
  readonly certificateType: string;
  readonly title: string;
  readonly issuedAt: string | null;
  readonly expiresAt: string | null;
  readonly status: CertificateStatus;
  readonly classSociety: ClassSociety | null;
  readonly source: string;
}

export interface ClassSocietyRecord {
  readonly vesselId: string;
  readonly classSociety: ClassSociety;
  readonly classificationStatus: string;
  readonly memberNumber: string | null;
  readonly known: boolean;
  readonly status: "IN_CLASS" | "NOT_IN_CLASS" | "UNKNOWN";
  readonly source: string;
}

export interface MonitoringPlanReview {
  readonly vesselId: string;
  readonly planVersion: string;
  readonly approvedAt: string | null;
  readonly nextReviewDue: string | null;
  readonly reviewStatus: SurveyStatus;
  readonly source: string;
}

export interface CharterCalendarEntry {
  readonly id: string;
  readonly vesselId: string;
  readonly period: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly charterType: string;
  readonly counterParty: string;
  readonly portCalls: ReadonlyArray<string>;
  readonly maintenanceWindow: boolean;
}

export interface MaintenanceDeadline {
  readonly id: string;
  readonly vesselId: string;
  readonly itemType: string;
  readonly label: string;
  readonly dueDate: string;
  readonly daysRemaining: number;
  readonly status: SurveyStatus;
  readonly blocking: boolean;
  readonly impact: ComplianceImpact;
}

export interface ComplianceImpactStatement {
  readonly claim: string;
  readonly impact: ComplianceImpact;
  readonly basis: string;
}

export interface MaintenanceMemoryEntry {
  readonly key: string;
  readonly value: string;
  readonly updatedAt: string;
}

export interface MaintenanceAnswer {
  readonly text: string;
  readonly schedule?: ReadonlyArray<SurveyScheduleItem>;
  readonly certificates?: ReadonlyArray<CertificateRecord>;
  readonly deadlines?: ReadonlyArray<MaintenanceDeadline>;
  readonly classSociety?: ClassSocietyRecord | null;
  readonly charterCalendar?: ReadonlyArray<CharterCalendarEntry>;
  readonly planStatus?: MonitoringPlanReview | null;
  readonly impacts?: ReadonlyArray<ComplianceImpactStatement>;
  readonly memory?: ReadonlyArray<MaintenanceMemoryEntry>;
  readonly handoff?: {
    readonly target: string;
    readonly confidence: number;
    readonly reason: string;
  };
}

export interface MaintenanceRequest {
  readonly query: string;
  readonly context: MaintenanceContext;
}
