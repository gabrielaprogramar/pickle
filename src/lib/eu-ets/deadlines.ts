import type { DeadlineInfo, DeadlineStatus } from "@/lib/eu-ets/types";
import { getDeadlineForYear } from "@/lib/eu-ets/parameters";

/**
 * Compute deadline status based on days remaining.
 */
export function deadlineStatus(daysRemaining: number): DeadlineStatus {
  if (daysRemaining < 0) return "OVERDUE";
  if (daysRemaining <= 7) return "URGENT";
  if (daysRemaining <= 30) return "WARNING";
  return "OK";
}

/**
 * Compute all ETS-related deadlines for a given year.
 */
export function computeDeadlines(
  reportingYear: number,
  referenceDate?: Date,
): { surrender: DeadlineInfo | null; mrvReporting: DeadlineInfo | null } {
  const now = referenceDate ?? new Date();

  const surrenderCfg = getDeadlineForYear("surrender", reportingYear);
  const mrvCfg = getDeadlineForYear("mrv_reporting", reportingYear);

  const surrenderDays = Math.ceil(
    (surrenderCfg.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  const mrvDays = Math.ceil(
    (mrvCfg.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    surrender: {
      type: "surrender",
      label: surrenderCfg.label,
      deadline_date: surrenderCfg.date.toISOString().split("T")[0]!,
      days_remaining: surrenderDays,
      status: deadlineStatus(surrenderDays),
    },
    mrvReporting: {
      type: "mrv_reporting",
      label: mrvCfg.label,
      deadline_date: mrvCfg.date.toISOString().split("T")[0]!,
      days_remaining: mrvDays,
      status: deadlineStatus(mrvDays),
    },
  };
}
