import type { NotificationPreferenceRow, NotificationPreferenceInsert } from "@/lib/supabase";

export interface PreferenceServiceOptions {
  readonly prefRepo: {
    findByRecipient(recipientId: string): Promise<ReadonlyArray<NotificationPreferenceRow>>;
    findByRecipientAndType(recipientId: string, type: string | null): Promise<NotificationPreferenceRow | null>;
    upsert(pref: NotificationPreferenceInsert): Promise<NotificationPreferenceRow>;
  };
}

export interface PreferenceService {
  getPreferences(recipientId: string): Promise<ReadonlyArray<NotificationPreferenceRow>>;
  getEffectivePreference(recipientId: string, type: string): Promise<{ enabled: boolean; emailEnabled: boolean; inAppEnabled: boolean }>;
  setPreference(recipientId: string, type: string | null, prefs: { enabled?: boolean; emailEnabled?: boolean; inAppEnabled?: boolean }): Promise<NotificationPreferenceRow>;
  isNotificationEnabled(recipientId: string, type: string): Promise<boolean>;
  isEmailEnabled(recipientId: string, type: string): Promise<boolean>;
}

export function createPreferenceService(opts: PreferenceServiceOptions): PreferenceService {
  const DEFAULTS = { enabled: true, emailEnabled: true, inAppEnabled: true };

  async function getEffective(recipientId: string, type: string): Promise<{ enabled: boolean; emailEnabled: boolean; inAppEnabled: boolean }> {
    const typePref = await opts.prefRepo.findByRecipientAndType(recipientId, type);
    if (typePref) {
      return { enabled: typePref.enabled, emailEnabled: typePref.email_enabled, inAppEnabled: typePref.in_app_enabled };
    }
    const globalPref = await opts.prefRepo.findByRecipientAndType(recipientId, null);
    if (globalPref) {
      return { enabled: globalPref.enabled, emailEnabled: globalPref.email_enabled, inAppEnabled: globalPref.in_app_enabled };
    }
    return DEFAULTS;
  }

  return {
    async getPreferences(recipientId: string): Promise<ReadonlyArray<NotificationPreferenceRow>> {
      return opts.prefRepo.findByRecipient(recipientId);
    },

    async getEffectivePreference(recipientId: string, type: string): Promise<{ enabled: boolean; emailEnabled: boolean; inAppEnabled: boolean }> {
      return getEffective(recipientId, type);
    },

    async setPreference(recipientId: string, type: string | null, prefs: { enabled?: boolean; emailEnabled?: boolean; inAppEnabled?: boolean }): Promise<NotificationPreferenceRow> {
      const insert: NotificationPreferenceInsert = {
        recipient_id: recipientId,
        notification_type: type,
        ...(prefs.enabled !== undefined ? { enabled: prefs.enabled } : {}),
        ...(prefs.emailEnabled !== undefined ? { email_enabled: prefs.emailEnabled } : {}),
        ...(prefs.inAppEnabled !== undefined ? { in_app_enabled: prefs.inAppEnabled } : {}),
      };
      return opts.prefRepo.upsert(insert);
    },

    async isNotificationEnabled(recipientId: string, type: string): Promise<boolean> {
      const pref = await getEffective(recipientId, type);
      return pref.enabled;
    },

    async isEmailEnabled(recipientId: string, type: string): Promise<boolean> {
      const pref = await getEffective(recipientId, type);
      return pref.emailEnabled;
    },
  };
}
