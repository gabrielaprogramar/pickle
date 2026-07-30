import { mapError } from "../errors";
import type { TypedSupabaseClient } from "../client";
import { getSupabaseClient } from "../client";
import type { NotificationRow, NotificationInsert } from "../types";

export interface NotificationRepository {
  findById(id: string): Promise<NotificationRow | null>;
  insert(notification: NotificationInsert): Promise<NotificationRow>;
  markRead(id: string, readAt?: string): Promise<NotificationRow>;
  markAllRead(recipientId: string): Promise<number>;
  listByRecipient(recipientId: string, limit?: number, offset?: number): Promise<ReadonlyArray<NotificationRow>>;
  unreadCount(recipientId: string): Promise<number>;
  listByType(recipientId: string, type: string, limit?: number, offset?: number): Promise<ReadonlyArray<NotificationRow>>;
  listUnread(recipientId: string, limit?: number, offset?: number): Promise<ReadonlyArray<NotificationRow>>;
  delete(id: string): Promise<void>;
}

export interface CreateNotificationRepositoryOptions {
  readonly client?: TypedSupabaseClient;
}

export function createNotificationRepository(
  opts: CreateNotificationRepositoryOptions = {},
): NotificationRepository {
  const getClient = (): TypedSupabaseClient =>
    opts.client ?? getSupabaseClient();

  return {
    async findById(id: string): Promise<NotificationRow | null> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("notifications")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data as NotificationRow | null;
      } catch (e) {
        throw mapError("find notification by id", e);
      }
    },

    async insert(notification: NotificationInsert): Promise<NotificationRow> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("notifications")
          .insert(notification as any)
          .select()
          .single();
        if (error) throw error;
        return data as NotificationRow;
      } catch (e) {
        throw mapError("insert notification", e);
      }
    },

    async markRead(id: string, readAt?: string): Promise<NotificationRow> {
      try {
        const client = getClient();
        const now = readAt ?? new Date().toISOString();
        const { data, error } = await client
          .from("notifications")
          .update({ is_read: true, read_at: now } as any)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as NotificationRow;
      } catch (e) {
        throw mapError("mark notification read", e);
      }
    },

    async markAllRead(recipientId: string): Promise<number> {
      try {
        const client = getClient();
        const now = new Date().toISOString();
        const { error, count } = await client
          .from("notifications")
          .update({ is_read: true, read_at: now } as any)
          .eq("recipient_id", recipientId)
          .eq("is_read", false);
        if (error) throw error;
        return count ?? 0;
      } catch (e) {
        throw mapError("mark all notifications read", e);
      }
    },

    async listByRecipient(recipientId: string, limit = 50, offset = 0): Promise<ReadonlyArray<NotificationRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("notifications")
          .select("*")
          .eq("recipient_id", recipientId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return (data ?? []) as NotificationRow[];
      } catch (e) {
        throw mapError("list notifications by recipient", e);
      }
    },

    async unreadCount(recipientId: string): Promise<number> {
      try {
        const client = getClient();
        const { count, error } = await client
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("recipient_id", recipientId)
          .eq("is_read", false);
        if (error) throw error;
        return count ?? 0;
      } catch (e) {
        throw mapError("count unread notifications", e);
      }
    },

    async listByType(recipientId: string, type: string, limit = 50, offset = 0): Promise<ReadonlyArray<NotificationRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("notifications")
          .select("*")
          .eq("recipient_id", recipientId)
          .eq("notification_type", type)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return (data ?? []) as NotificationRow[];
      } catch (e) {
        throw mapError("list notifications by type", e);
      }
    },

    async listUnread(recipientId: string, limit = 50, offset = 0): Promise<ReadonlyArray<NotificationRow>> {
      try {
        const client = getClient();
        const { data, error } = await client
          .from("notifications")
          .select("*")
          .eq("recipient_id", recipientId)
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) throw error;
        return (data ?? []) as NotificationRow[];
      } catch (e) {
        throw mapError("list unread notifications", e);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const client = getClient();
        const { error } = await client
          .from("notifications")
          .delete()
          .eq("id", id);
        if (error) throw error;
      } catch (e) {
        throw mapError("delete notification", e);
      }
    },
  };
}
