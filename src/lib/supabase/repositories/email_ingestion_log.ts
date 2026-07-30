import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import { mapError } from "../errors";
import type { EmailIngestionLogInsert, EmailIngestionLogRow } from "../types";

export interface EmailIngestionLogRepository {
  insert(input: EmailIngestionLogInsert): Promise<EmailIngestionLogRow>;
  listByMessageId(messageId: string): Promise<EmailIngestionLogRow[]>;
  listByVesselId(vesselId: string): Promise<EmailIngestionLogRow[]>;
}

export interface CreateEmailIngestionLogRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createEmailIngestionLogRepository(
  opts: CreateEmailIngestionLogRepositoryOptions = {},
): EmailIngestionLogRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async insert(input: EmailIngestionLogInsert): Promise<EmailIngestionLogRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("email_ingestion_log")
          .insert(input)
          .select()
          .single();

        if (error) throw error;
        return data as EmailIngestionLogRow;
      } catch (e) {
        throw mapError("insert email ingestion log", e);
      }
    },

    async listByMessageId(messageId: string): Promise<EmailIngestionLogRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("email_ingestion_log")
          .select()
          .eq("message_id", messageId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as EmailIngestionLogRow[]) ?? [];
      } catch (e) {
        throw mapError("list email ingestion log by message id", e);
      }
    },

    async listByVesselId(vesselId: string): Promise<EmailIngestionLogRow[]> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("email_ingestion_log")
          .select()
          .eq("vessel_id", vesselId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return (data as EmailIngestionLogRow[]) ?? [];
      } catch (e) {
        throw mapError("list email ingestion log by vessel id", e);
      }
    },
  };
}
