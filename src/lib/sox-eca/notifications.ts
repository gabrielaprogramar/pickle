/**
 * sox-eca/notifications.ts — SOx ECA notification mapping
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Maps a persisted compliance event to the shared notification system. Only
 * four event types are introduced (types.ts in the notifications module):
 *
 *   sox_eca_warning          — ECA entry without conforming evidence / WARNING watch
 *   sox_eca_non_conforming   — bunker or fuel-in-use sulphur exceeds the ECA limit
 *   sox_eca_no_evidence      — inside ECA with no usable bunker evidence
 *   sox_eca_review_required  — conflicting / ambiguous / unreviewed evidence
 */

import type { NotificationEvent, NotificationEventType } from "@/lib/notifications";
import type {
  SoxComplianceEvent,
  SoxEvaluationResult,
  SoxRuleResult,
  WatchSeverity,
} from "./types";
import { formatSulphurLimit } from "./parameters";

export type NotificationSeverity = "INFO" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Translate the watch severity to the shared notification severity scale. */
export function toNotificationSeverity(severity: WatchSeverity): NotificationSeverity {
  return severity === "WARNING" ? "MEDIUM" : severity;
}

export interface SoxNotificationInput {
  readonly evaluation: SoxEvaluationResult;
  readonly event: SoxComplianceEvent;
}

export function soxNotificationTypeForEvent(
  event: Pick<SoxComplianceEvent, "watch_status" | "severity" | "rule_id" | "event_type">,
): NotificationEventType | null {
  if (event.event_type === "EXIT") return null;
  if (event.severity === "INFO") return null;

  switch (event.watch_status) {
    case "NON_CONFORMING":
      return "sox_eca_non_conforming";
    case "NO_EVIDENCE":
      return "sox_eca_no_evidence";
    case "UNKNOWN":
      return "sox_eca_review_required";
    case "WARNING":
      return "sox_eca_warning";
    default:
      return null;
  }
}

function primaryRule(event: Pick<SoxComplianceEvent, "rule_result">): SoxRuleResult | null {
  return event.rule_result ?? null;
}

export function buildSoxNotification({ evaluation, event }: SoxNotificationInput): NotificationEvent | null {
  const type = soxNotificationTypeForEvent(event);
  if (!type) return null;

  const rule = primaryRule(event);
  const vesselName = evaluation.vessel.name;
  const limit = event.applicable_limit_pct != null ? formatSulphurLimit(event.applicable_limit_pct) : "the applicable limit";
  const sulphur = event.sulphur_content_pct != null ? `${event.sulphur_content_pct}% m/m` : "no sulphur value";

  let title: string;
  let message: string;

  switch (type) {
    case "sox_eca_non_conforming":
      title = `SOx ECA non-conformance — ${vesselName}`;
      message =
        `Available bunker evidence indicates ${sulphur}, exceeding the ${limit} inside the ` +
        `Mediterranean Sea SOx ECA (${event.event_ts.slice(0, 10)}). Rule ${rule?.rule_id ?? "SOX-ECA-03"}.`;
      break;

    case "sox_eca_no_evidence":
      title = `SOx ECA — no bunker evidence — ${vesselName}`;
      message =
        `Vessel is inside the Mediterranean Sea SOx ECA (since ${event.event_ts.slice(0, 10)}) but no usable ` +
        `bunker sulphur evidence is on file to substantiate compliance with the ${limit}. Rule SOX-ECA-04.`;
      break;

    case "sox_eca_review_required":
      title = `SOx ECA — review required — ${vesselName}`;
      message =
        `Bunker sulphur evidence is conflicting, ambiguous, or under review, so compliance cannot be ` +
        `determined inside the Mediterranean Sea SOx ECA. ${sulphur}. Rule ${rule?.rule_id ?? "SOX-ECA-05"}.`;
      break;

    case "sox_eca_warning":
    default:
      title = `SOx ECA watch — ${vesselName}`;
      message =
        `Watch status is ${event.watch_status} (${event.severity.toLowerCase()}) for the Mediterranean Sea ` +
        `SOx ECA. ${sulphur} vs ${limit}.`;
      break;
  }

  return {
    type,
    recipient_id: "ops-001",
    vessel_id: evaluation.vessel.vesselId,
    organization_id: "org-001",
    title,
    message,
    severity: toNotificationSeverity(event.severity),
    payload: {
      imo: evaluation.vessel.imo,
      watch_status: event.watch_status,
      zone_state: event.zone_state,
      evidence_status: event.evidence_status,
      rule_id: event.rule_id,
      applicable_limit_pct: event.applicable_limit_pct,
      sulphur_content_pct: event.sulphur_content_pct,
      event_type: event.event_type,
    },
    source_event: event.event_type,
    source_id: event.id,
  };
}
