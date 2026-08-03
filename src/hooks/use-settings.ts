"use client";

import { useState, useEffect, useCallback } from "react";
import { getSettingsBundle } from "@/services/auth.service";
import {
  updateOrganization as apiUpdateOrganization,
  updateGeneral as apiUpdateGeneral,
  updateAppearance as apiUpdateAppearance,
  updateNotificationPreferences as apiUpdateNotificationPreferences,
  configureIntegration as apiConfigureIntegration,
  disconnectIntegration as apiDisconnectIntegration,
  createInvite as apiCreateInvite,
  cancelInvite as apiCancelInvite,
  resendInvite as apiResendInvite,
  updateUser as apiUpdateUser,
} from "@/services/settings.service";
import { ApiError } from "@/services/api-client";
import type {
  AppearanceSettings,
  GeneralSettings,
  NotificationPreferences,
  OrganizationProfile,
  SettingsBundle,
  SettingsInvite,
  SettingsUser,
} from "@/lib/settings";

interface UseSettingsResult {
  readonly bundle: SettingsBundle | null;
  readonly isLoading: boolean;
  readonly error: ApiError | null;
  readonly refetch: () => void;
  readonly updateOrganization: (patch: Partial<Omit<OrganizationProfile, "id">>) => Promise<boolean>;
  readonly updateGeneral: (patch: Partial<GeneralSettings>) => Promise<boolean>;
  readonly updateAppearance: (appearance: AppearanceSettings) => Promise<boolean>;
  readonly updateNotifications: (prefs: NotificationPreferences) => Promise<boolean>;
  readonly configureIntegration: (provider: string, config: Record<string, unknown>) => Promise<boolean>;
  readonly disconnectIntegration: (provider: string) => Promise<boolean>;
  readonly inviteUser: (input: { email: string; fullName?: string | null; role: string }) => Promise<SettingsInvite | null>;
  readonly cancelInvite: (id: string) => Promise<SettingsInvite | null>;
  readonly resendInvite: (id: string) => Promise<SettingsInvite | null>;
  readonly changeUser: (id: string, patch: { role?: string; status?: "active" | "inactive" }) => Promise<SettingsUser | null>;
}

export function useSettings(): UseSettingsResult {
  const [bundle, setBundle] = useState<SettingsBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchBundle = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSettingsBundle();
      setBundle(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("UNKNOWN", String(err), 0));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBundle();
  }, [fetchBundle]);

  const guard = useCallback(<T,>(fn: () => Promise<T>): Promise<T | null> => {
    return fn().catch((err: unknown) => {
      setError(err instanceof ApiError ? err : new ApiError("UNKNOWN", String(err), 0));
      return null;
    });
  }, []);

  return {
    bundle,
    isLoading,
    error,
    refetch: fetchBundle,

    updateOrganization: async (patch) => {
      const result = await guard(() => apiUpdateOrganization(patch));
      if (result) await fetchBundle();
      return result !== null;
    },

    updateGeneral: async (patch) => {
      const result = await guard(() => apiUpdateGeneral(patch));
      if (result) await fetchBundle();
      return result !== null;
    },

    updateAppearance: async (appearance) => {
      const result = await guard(() => apiUpdateAppearance(appearance));
      if (result) await fetchBundle();
      return result !== null;
    },

    updateNotifications: async (prefs) => {
      const result = await guard(() => apiUpdateNotificationPreferences(prefs));
      if (result) await fetchBundle();
      return result !== null;
    },

    configureIntegration: async (provider, config) => {
      const result = await guard(() => apiConfigureIntegration(provider, config));
      if (result) await fetchBundle();
      return result !== null;
    },

    disconnectIntegration: async (provider) => {
      const result = await guard(() => apiDisconnectIntegration(provider));
      if (result) await fetchBundle();
      return result !== null;
    },

    inviteUser: async (input) => {
      const invite = await guard(() => apiCreateInvite(input));
      if (invite) await fetchBundle();
      return invite;
    },

    cancelInvite: async (id) => {
      const invite = await guard(() => apiCancelInvite(id));
      if (invite) await fetchBundle();
      return invite;
    },

    resendInvite: async (id) => {
      const invite = await guard(() => apiResendInvite(id));
      if (invite) await fetchBundle();
      return invite;
    },

    changeUser: async (id, patch) => {
      const user = await guard(() => apiUpdateUser(id, patch));
      if (user) await fetchBundle();
      return user;
    },
  };
}
