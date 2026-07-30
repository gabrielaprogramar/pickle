import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createPreferenceService } from "../preferences";

function createMockPrefRepo(): any {
  const store = new Map<string, Record<string, unknown>>();
  return {
    findByRecipient: async (recipientId: string) =>
      Array.from(store.values()).filter((p) => p.recipient_id === recipientId),

    findByRecipientAndType: async (recipientId: string, type: string | null) => {
      for (const p of store.values()) {
        if (p.recipient_id === recipientId && p.notification_type === type) {
          return {
            id: p.id as string,
            recipient_id: p.recipient_id as string,
            notification_type: p.notification_type as string | null,
            enabled: p.enabled as boolean,
            email_enabled: p.email_enabled as boolean,
            in_app_enabled: p.in_app_enabled as boolean,
            created_at: "2025-01-01",
            updated_at: "2025-01-01",
          };
        }
      }
      return null;
    },

    upsert: async (pref: Record<string, unknown>) => {
      const key = `${pref.recipient_id}_${pref.notification_type ?? "__global__"}`;
      const row = {
        id: `pref-${key}`,
        recipient_id: pref.recipient_id,
        notification_type: pref.notification_type ?? null,
        enabled: pref.enabled ?? true,
        email_enabled: pref.email_enabled ?? true,
        in_app_enabled: pref.in_app_enabled ?? true,
        created_at: "2025-01-01",
        updated_at: "2025-01-01",
      };
      store.set(key, row);
      return row;
    },
  };
}

describe("PreferenceService", () => {
  describe("getEffectivePreference", () => {
    it("returns defaults when no preferences exist", async () => {
      const repo = createMockPrefRepo();
      const svc = createPreferenceService({ prefRepo: repo });

      const pref = await svc.getEffectivePreference("user-1", "ets_deadline_warning");
      expect(pref.enabled).toBe(true);
      expect(pref.emailEnabled).toBe(true);
      expect(pref.inAppEnabled).toBe(true);
    });

    it("returns type-specific preference when it exists", async () => {
      const repo = createMockPrefRepo();
      await repo.upsert({ recipient_id: "user-1", notification_type: "ets_deadline_warning", enabled: false, email_enabled: true, in_app_enabled: false });
      const svc = createPreferenceService({ prefRepo: repo });

      const pref = await svc.getEffectivePreference("user-1", "ets_deadline_warning");
      expect(pref.enabled).toBe(false);
      expect(pref.emailEnabled).toBe(true);
      expect(pref.inAppEnabled).toBe(false);
    });

    it("falls back to global preference when type-specific is missing", async () => {
      const repo = createMockPrefRepo();
      await repo.upsert({ recipient_id: "user-1", notification_type: null, enabled: false, email_enabled: false, in_app_enabled: true });
      const svc = createPreferenceService({ prefRepo: repo });

      const pref = await svc.getEffectivePreference("user-1", "some_type");
      expect(pref.enabled).toBe(false);
      expect(pref.emailEnabled).toBe(false);
      expect(pref.inAppEnabled).toBe(true);
    });
  });

  describe("setPreference", () => {
    it("creates a new type-specific preference", async () => {
      const repo = createMockPrefRepo();
      const svc = createPreferenceService({ prefRepo: repo });

      const result = await svc.setPreference("user-1", "report_generated", { enabled: false });
      expect(result.recipient_id).toBe("user-1");
      expect(result.notification_type).toBe("report_generated");
      expect(result.enabled).toBe(false);
    });

    it("creates a global default preference", async () => {
      const repo = createMockPrefRepo();
      const svc = createPreferenceService({ prefRepo: repo });

      const result = await svc.setPreference("user-1", null, { emailEnabled: false });
      expect(result.notification_type).toBeNull();
      expect(result.email_enabled).toBe(false);
    });
  });

  describe("isNotificationEnabled / isEmailEnabled", () => {
    it("returns true by default", async () => {
      const repo = createMockPrefRepo();
      const svc = createPreferenceService({ prefRepo: repo });

      expect(await svc.isNotificationEnabled("user-1", "any_type")).toBe(true);
      expect(await svc.isEmailEnabled("user-1", "any_type")).toBe(true);
    });

    it("returns false when globally disabled", async () => {
      const repo = createMockPrefRepo();
      await repo.upsert({ recipient_id: "user-1", notification_type: null, enabled: false, email_enabled: false, in_app_enabled: true });
      const svc = createPreferenceService({ prefRepo: repo });

      expect(await svc.isNotificationEnabled("user-1", "any_type")).toBe(false);
      expect(await svc.isEmailEnabled("user-1", "any_type")).toBe(false);
    });

    it("correctly evaluates type-specific override", async () => {
      const repo = createMockPrefRepo();
      await repo.upsert({ recipient_id: "user-1", notification_type: null, enabled: true, email_enabled: true, in_app_enabled: true });
      await repo.upsert({ recipient_id: "user-1", notification_type: "compliance_violation_error", enabled: true, email_enabled: false, in_app_enabled: true });
      const svc = createPreferenceService({ prefRepo: repo });

      expect(await svc.isNotificationEnabled("user-1", "compliance_violation_error")).toBe(true);
      expect(await svc.isEmailEnabled("user-1", "compliance_violation_error")).toBe(false);
    });
  });
});

run();
