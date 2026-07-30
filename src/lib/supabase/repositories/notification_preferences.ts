import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type { NotificationPreferenceRow, NotificationPreferenceInsert } from "../types";

export interface NotificationPreferenceRepository {
  findByRecipient(recipientId: string): Promise<ReadonlyArray<NotificationPreferenceRow>>;
  findByRecipientAndType(recipientId: string, type: string | null): Promise<NotificationPreferenceRow | null>;
  upsert(pref: NotificationPreferenceInsert): Promise<NotificationPreferenceRow>;
  delete(id: string): Promise<void>;
}

export interface CreateNotificationPreferenceRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createNotificationPreferenceRepository(
  opts: CreateNotificationPreferenceRepositoryOptions = {},
): NotificationPreferenceRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findByRecipient(recipientId: string): Promise<ReadonlyArray<NotificationPreferenceRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("notification_preferences")
          .select("*")
          .eq("recipient_id", recipientId);
        if (error) throw error;
        return (data ?? []) as NotificationPreferenceRow[];
      } catch (e) {
        throw mapError("find notification preferences by recipient", e);
      }
    },

    async findByRecipientAndType(recipientId: string, type: string | null): Promise<NotificationPreferenceRow | null> {
      try {
        const client = getClient();
        const query = client
          .from("notification_preferences")
          .select("*")
          .eq("recipient_id", recipientId);
        if (type === null) {
          query.is("notification_type", null);
        } else {
          query.eq("notification_type", type);
        }
        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        return data as NotificationPreferenceRow | null;
      } catch (e) {
        throw mapError("find notification preference by recipient and type", e);
      }
    },

    async upsert(pref: NotificationPreferenceInsert): Promise<NotificationPreferenceRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("notification_preferences")
          .upsert(pref as any, {
            onConflict: "recipient_id, notification_type",
            ignoreDuplicates: false,
          })
          .select()
          .single();
        if (error) throw error;
        return data as NotificationPreferenceRow;
      } catch (e) {
        throw mapError("upsert notification preference", e);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const client = getClient();
        const { error } = await client
          .from("notification_preferences")
          .delete()
          .eq("id", id);
        if (error) throw error;
      } catch (e) {
        throw mapError("delete notification preference", e);
      }
    },
  };
}
