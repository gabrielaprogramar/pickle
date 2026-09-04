import type { AuditLogRepository } from "@/lib/supabase";
import type { AuditLogInsert } from "@/lib/supabase/types";
import type { ReconciliationFindingInput, ResolutionStatus } from "./types";

export const RECONCILIATION_ENTITY_TYPE = "reconciliation_finding";

export interface ResolveFindingInput {
  readonly finding_key: string;
  readonly vessel_id: string;
  readonly resolution_status: ResolutionStatus;
  readonly resolution_reason: string;
  readonly selected_evidence: string[];
  readonly note: string | null;
  readonly actor_id: string | null;
  readonly actor_email: string | null;
  readonly organization_id: string;
  readonly correlation_id?: string | null;
}

export interface ReopenFindingInput {
  readonly finding_key: string;
  readonly vessel_id: string;
  readonly resolution_reason: string;
  readonly actor_id: string | null;
  readonly actor_email: string | null;
  readonly organization_id: string;
  readonly correlation_id?: string | null;
}

export interface ResolutionResult {
  readonly action: "RESOLVED" | "REOPENED";
  readonly finding_key: string;
  readonly previous_status: ResolutionStatus;
  readonly new_status: ResolutionStatus;
  readonly audit_event_id: string | null;
}

export interface ReconciliationResolutionDeps {
  readonly auditLog: AuditLogRepository;
}

export function createReconciliationResolution(
  deps: ReconciliationResolutionDeps,
) {
  async function resolveFinding(
    currentStatus: ResolutionStatus,
    input: ResolveFindingInput,
  ): Promise<ResolutionResult> {
    const beforeStatus = currentStatus;
    const afterStatus: ResolutionStatus = input.resolution_status;

    const auditPayload: AuditLogInsert = {
      organization_id: input.organization_id,
      actor_id: input.actor_id,
      actor_email: input.actor_email,
      action: "reconciliation.finding.resolved",
      entity_type: RECONCILIATION_ENTITY_TYPE,
      entity_id: input.finding_key,
      before_data: {
        resolution_status: beforeStatus,
        vessel_id: input.vessel_id,
      },
      after_data: {
        resolution_status: afterStatus,
        resolution_reason: input.resolution_reason,
        selected_evidence: input.selected_evidence,
        note: input.note,
        vessel_id: input.vessel_id,
      },
      source: "reconciliation-engine",
      correlation_id: input.correlation_id ?? null,
    };

    let auditEventId: string | null = null;
    try {
      const inserted = await deps.auditLog.insert(auditPayload);
      auditEventId = inserted.id;
    } catch {
      auditEventId = null;
    }

    return {
      action: "RESOLVED",
      finding_key: input.finding_key,
      previous_status: beforeStatus,
      new_status: afterStatus,
      audit_event_id: auditEventId,
    };
  }

  async function reopenFinding(
    currentStatus: ResolutionStatus,
    input: ReopenFindingInput,
  ): Promise<ResolutionResult> {
    const beforeStatus = currentStatus;
    const afterStatus: ResolutionStatus = "UNRESOLVED";

    const auditPayload: AuditLogInsert = {
      organization_id: input.organization_id,
      actor_id: input.actor_id,
      actor_email: input.actor_email,
      action: "reconciliation.finding.reopened",
      entity_type: RECONCILIATION_ENTITY_TYPE,
      entity_id: input.finding_key,
      before_data: {
        resolution_status: beforeStatus,
        vessel_id: input.vessel_id,
      },
      after_data: {
        resolution_status: afterStatus,
        resolution_reason: input.resolution_reason,
        vessel_id: input.vessel_id,
      },
      source: "reconciliation-engine",
      correlation_id: input.correlation_id ?? null,
    };

    let auditEventId: string | null = null;
    try {
      const inserted = await deps.auditLog.insert(auditPayload);
      auditEventId = inserted.id;
    } catch {
      auditEventId = null;
    }

    return {
      action: "REOPENED",
      finding_key: input.finding_key,
      previous_status: beforeStatus,
      new_status: afterStatus,
      audit_event_id: auditEventId,
    };
  }

  return { resolveFinding, reopenFinding };
}
