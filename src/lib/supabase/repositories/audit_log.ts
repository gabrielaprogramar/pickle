import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type { AuditLogRow, AuditLogInsert } from "../types";

export interface AuditLogRepository {
  insert(input: AuditLogInsert): Promise<AuditLogRow>;
  listByOrganization(organizationId: string, opts?: { limit?: number }): Promise<AuditLogRow[]>;
  listByEntity(entityType: string, entityId: string): Promise<AuditLogRow[]>;
}

export interface CreateAuditLogRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createAuditLogRepository(
  opts: CreateAuditLogRepositoryOptions = {},
): AuditLogRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: AuditLogInsert): Promise<AuditLogRow> {
      try {
        const client = getClient();
        const payload = {
          organization_id: input.organization_id,
          actor_id: input.actor_id ?? null,
          actor_email: input.actor_email ?? null,
          action: input.action,
          entity_type: input.entity_type,
          entity_id: input.entity_id ?? null,
          before_data: input.before_data ?? {},
          after_data: input.after_data ?? {},
          source: input.source ?? "app",
          correlation_id: input.correlation_id ?? null,
        };

        const { data, error } = await client
          .from("audit_log")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        return data as AuditLogRow;
      } catch (e) {
        throw mapError("insert audit log", e);
      }
    },

    async listByOrganization(
      organizationId: string,
      opts: { limit?: number } = {},
    ): Promise<AuditLogRow[]> {
      try {
        const client = getClient();
        let query = client
          .from("audit_log")
          .select()
          .eq("organization_id", organizationId)
          .order("recorded_at", { ascending: false });

        if (opts.limit !== undefined) {
          query = query.limit(opts.limit);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data as AuditLogRow[]) ?? [];
      } catch (e) {
        throw mapError("list audit log by organization", e);
      }
    },

    async listByEntity(entityType: string, entityId: string): Promise<AuditLogRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("audit_log")
          .select()
          .eq("entity_type", entityType)
          .eq("entity_id", entityId)
          .order("recorded_at", { ascending: true });

        if (error) throw error;
        return (data as AuditLogRow[]) ?? [];
      } catch (e) {
        throw mapError("list audit log by entity", e);
      }
    },
  };
}
