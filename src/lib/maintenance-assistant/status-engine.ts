import type {
  CertificateRecord,
  ComplianceImpact,
  ComplianceImpactStatement,
  MaintenanceDeadline,
  MonitoringPlanReview,
  SurveyScheduleItem,
  SurveyStatus,
} from "./types";

export const DUE_SOON_DAYS = 30;
export const UPCOMING_DAYS = 90;
export const BLOCKING_SURVEY_TYPES: ReadonlyArray<string> = [
  "RENEWAL",
  "SPECIAL",
  "ISM",
  "ISPS",
];

export interface StatusEngine {
  surveyStatus(dueDate: string | null, hasData: boolean, now: string): SurveyStatus;
  certificateStatus(expiresAt: string | null, now: string): "VALID" | "EXPIRING" | "EXPIRED";
  evaluateSchedule(items: ReadonlyArray<SurveyScheduleItem>, now: string): ReadonlyArray<SurveyScheduleItem>;
  evaluateCertificates(
    certificates: ReadonlyArray<CertificateRecord>,
    now: string,
  ): ReadonlyArray<CertificateRecord>;
  buildDeadlines(
    schedule: ReadonlyArray<SurveyScheduleItem>,
    certificates: ReadonlyArray<CertificateRecord>,
    plan: MonitoringPlanReview | null,
    now: string,
  ): ReadonlyArray<MaintenanceDeadline>;
  impactsForCertificates(
    certificates: ReadonlyArray<CertificateRecord>,
  ): ReadonlyArray<ComplianceImpactStatement>;
  explain(item: SurveyScheduleItem | CertificateRecord, now: string): ComplianceImpactStatement;
}

function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.ceil(ms / 86_400_000);
}

function isBlockingSurvey(surveyType: string): boolean {
  return (BLOCKING_SURVEY_TYPES as ReadonlyArray<string>).includes(surveyType);
}

export function createStatusEngine(): StatusEngine {
  function surveyStatus(dueDate: string | null, hasData: boolean, now: string): SurveyStatus {
    if (!hasData || dueDate === null) return "UNKNOWN";
    const days = daysBetween(now, dueDate);
    if (days < 0) return "OVERDUE";
    if (days <= DUE_SOON_DAYS) return "DUE_SOON";
    if (days <= UPCOMING_DAYS) return "UPCOMING";
    return "CURRENT";
  }

  function certificateStatus(expiresAt: string | null, now: string): "VALID" | "EXPIRING" | "EXPIRED" {
    if (expiresAt === null) return "VALID";
    const days = daysBetween(now, expiresAt);
    if (days < 0) return "EXPIRED";
    if (days <= DUE_SOON_DAYS) return "EXPIRING";
    return "VALID";
  }

  function evaluateSchedule(
    items: ReadonlyArray<SurveyScheduleItem>,
    now: string,
  ): ReadonlyArray<SurveyScheduleItem> {
    if (items.length === 0) return [];
    return items.map((item) => {
      const days = item.dueDate === null ? null : daysBetween(now, item.dueDate);
      let status: SurveyStatus;
      if (days === null) {
        status = "UNKNOWN";
      } else if (days < 0) {
        status = isBlockingSurvey(item.surveyType) ? "BLOCKING" : "OVERDUE";
      } else if (days <= DUE_SOON_DAYS) {
        status = "DUE_SOON";
      } else if (days <= UPCOMING_DAYS) {
        status = "UPCOMING";
      } else {
        status = "CURRENT";
      }
      return { ...item, status };
    });
  }

  function evaluateCertificates(
    certificates: ReadonlyArray<CertificateRecord>,
    now: string,
  ): ReadonlyArray<CertificateRecord> {
    if (certificates.length === 0) return [];
    return certificates.map((cert) => {
      if (cert.expiresAt === null) return { ...cert, status: "VALID" };
      const days = daysBetween(now, cert.expiresAt);
      const status =
        days < 0 ? "EXPIRED" : days <= DUE_SOON_DAYS ? "EXPIRING" : "VALID";
      return { ...cert, status };
    });
  }

  function buildDeadlines(
    schedule: ReadonlyArray<SurveyScheduleItem>,
    certificates: ReadonlyArray<CertificateRecord>,
    plan: MonitoringPlanReview | null,
    now: string,
  ): ReadonlyArray<MaintenanceDeadline> {
    const deadlines: MaintenanceDeadline[] = [];

    for (const item of schedule) {
      if (item.dueDate === null) continue;
      const days = daysBetween(now, item.dueDate);
      const blocking = isBlockingSurvey(item.surveyType) && days < 0;
      deadlines.push({
        id: `dl-${item.id}`,
        vesselId: item.vesselId,
        itemType: "SURVEY",
        label: `${item.surveyType} survey`,
        dueDate: item.dueDate,
        daysRemaining: days,
        status: blocking ? "BLOCKING" : item.status,
        blocking,
        impact: blocking ? "DETERMINISTIC_IMPACT" : "FACT",
      });
    }

    for (const cert of certificates) {
      if (cert.expiresAt === null) continue;
      const days = daysBetween(now, cert.expiresAt);
      const blocking = cert.certificateType === "CLASS_CERTIFICATE" && days < 0;
      deadlines.push({
        id: `dl-${cert.id}`,
        vesselId: cert.vesselId,
        itemType: "CERTIFICATE",
        label: cert.title,
        dueDate: cert.expiresAt,
        daysRemaining: days,
        status: days < 0 ? (blocking ? "BLOCKING" : "OVERDUE") : days <= DUE_SOON_DAYS ? "DUE_SOON" : "CURRENT",
        blocking,
        impact: cert.certificateType === "ISCC_CERTIFICATE" && days < 0 ? "DETERMINISTIC_IMPACT" : "FACT",
      });
    }

    if (plan && plan.nextReviewDue !== null) {
      const days = daysBetween(now, plan.nextReviewDue);
      deadlines.push({
        id: `dl-plan-${plan.vesselId}`,
        vesselId: plan.vesselId,
        itemType: "MONITORING_PLAN_REVIEW",
        label: "Monitoring plan review",
        dueDate: plan.nextReviewDue,
        daysRemaining: days,
        status: days < 0 ? "OVERDUE" : days <= DUE_SOON_DAYS ? "DUE_SOON" : days <= UPCOMING_DAYS ? "UPCOMING" : "CURRENT",
        blocking: false,
        impact: "FACT",
      });
    }

    return deadlines.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  function impactsForCertificates(
    certificates: ReadonlyArray<CertificateRecord>,
  ): ReadonlyArray<ComplianceImpactStatement> {
    const impacts: ComplianceImpactStatement[] = [];
    const iscc = certificates.find((c) => c.certificateType === "ISCC_CERTIFICATE");
    if (iscc && iscc.status === "EXPIRED") {
      impacts.push({
        claim:
          "The expired ISCC certificate means biofuel blends loaded for this vessel cannot be substantiated for a FuelEU compliance benefit.",
        impact: "DETERMINISTIC_IMPACT",
        basis:
          "Deterministic rule: ISCC certification is required to claim the carbon intensity benefit of biofuel blends under the FuelEU Maritime scheme.",
      });
    } else if (iscc && iscc.status === "EXPIRING") {
      impacts.push({
        claim: "The ISCC certificate expires soon; renew before expiry to keep biofuel blend claims supported.",
        impact: "ADVISORY_RECOMMENDATION",
        basis: "Renewal window derived from the certificate expiry date on file.",
      });
    }

    const classCert = certificates.find((c) => c.certificateType === "CLASS_CERTIFICATE");
    if (classCert && classCert.status === "EXPIRED") {
      impacts.push({
        claim:
          "An expired class certificate prevents the vessel from maintaining its class status, which can block a scheduled survey window.",
        impact: "DETERMINISTIC_IMPACT",
        basis:
          "Deterministic rule: a CLASS_CERTIFICATE that has passed its expiry date is blocking for class-related surveys.",
      });
    }
    return impacts;
  }

  function explain(
    item: SurveyScheduleItem | CertificateRecord,
    now: string,
  ): ComplianceImpactStatement {
    const due = "dueDate" in item ? item.dueDate : item.expiresAt;
    if (due === null) {
      return {
        claim: "No due date is on file for this item, so no status can be derived.",
        impact: "FACT",
        basis: "No date present in the deterministic source data.",
      };
    }
    const days = daysBetween(now, due);
    const label = "dueDate" in item ? `${item.surveyType} survey` : item.title;
    if (days < 0) {
      return {
        claim: `${label} passed its due date ${Math.abs(days)} days ago.`,
        impact: "FACT",
        basis: `Due date ${due.slice(0, 10)} is before the reference date ${now.slice(0, 10)}.`,
      };
    }
    return {
      claim: `${label} is due in ${days} days (${due.slice(0, 10)}).`,
      impact: "FACT",
      basis: `Due date ${due.slice(0, 10)} relative to reference date ${now.slice(0, 10)}.`,
    };
  }

  return {
    surveyStatus,
    certificateStatus,
    evaluateSchedule,
    evaluateCertificates,
    buildDeadlines,
    impactsForCertificates,
    explain,
  };
}
