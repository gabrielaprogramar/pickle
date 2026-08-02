export type {
  NotificationEventType,
  NotificationEvent,
  EmailNotification,
  DeadlineInfo,
} from "./types";

export { NOTIFICATION_SYSTEM_VERSION } from "./types";

export { createNotificationDispatcher } from "./dispatcher";
export type { NotificationDispatcher, NotificationDispatcherOptions } from "./dispatcher";

export { createNotificationEmailProvider } from "./email-provider";
export type {
  NotificationEmailProvider,
  MockNotificationEmailProvider,
} from "./email-provider";
export { createMockNotificationEmailProvider } from "./email-provider";

export { createPreferenceService } from "./preferences";
export type { PreferenceService, PreferenceServiceOptions } from "./preferences";

export { formatDeadlineTemplate, formatComplianceTemplate, formatReportTemplate, formatBdnTemplate, formatVerifierPackageTemplate, formatSoxTemplate, formatCertificateTemplate, formatNoonTemplate } from "./templates";

export { createDeadlineAlertService } from "./deadlines";
export type { DeadlineAlertService, DeadlineAlertServiceOptions } from "./deadlines";

export { createComplianceAlertService } from "./compliance-alerts";
export type { ComplianceAlertService, ComplianceAlertServiceOptions } from "./compliance-alerts";
