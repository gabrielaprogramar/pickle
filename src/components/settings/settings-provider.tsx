"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getSettingsBundle } from "@/services/auth.service";
import { subscribeSettingsChanged } from "@/lib/settings/events";
import { subscribeAuthChanged } from "@/hooks/use-auth";
import type {
  AppearanceSettings,
  GeneralSettings,
  OrganizationProfile,
} from "@/lib/settings";

interface SettingsAppearanceContextValue {
  readonly organization: OrganizationProfile | null;
  readonly appearance: AppearanceSettings | null;
  readonly general: GeneralSettings | null;
}

const SettingsAppearanceContext = createContext<SettingsAppearanceContextValue>({
  organization: null,
  appearance: null,
  general: null,
});

function applyAppearance(appearance: AppearanceSettings): void {
  const root = document.documentElement;
  const dark = appearance.theme !== "light";
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  root.dataset.accent = appearance.accent;
  root.dataset.sidebarDensity = appearance.sidebarDensity;
  root.dataset.tableDensity = appearance.tableDensity;
  root.dataset.gridView = appearance.gridView;
  root.style.colorScheme = dark ? "dark" : "light";
}

export function SettingsProvider({ children }: { readonly children: React.ReactNode }) {
  const [organization, setOrganization] = useState<OrganizationProfile | null>(null);
  const [appearance, setAppearance] = useState<AppearanceSettings | null>(null);
  const [general, setGeneral] = useState<GeneralSettings | null>(null);

  const fetchBundle = useCallback(async () => {
    try {
      const bundle = await getSettingsBundle();
      setOrganization(bundle.organization);
      setAppearance(bundle.appearance);
      setGeneral(bundle.general);
      applyAppearance(bundle.appearance);
    } catch {
      // Not authenticated (e.g. the login page) or a transient failure —
      // keep the current shell appearance untouched.
    }
  }, []);

  useEffect(() => {
    fetchBundle();
    const unsubscribeSettings = subscribeSettingsChanged(fetchBundle);
    const unsubscribeAuth = subscribeAuthChanged(fetchBundle);
    return () => {
      unsubscribeSettings();
      unsubscribeAuth();
    };
  }, [fetchBundle]);

  return (
    <SettingsAppearanceContext.Provider value={{ organization, appearance, general }}>
      {children}
    </SettingsAppearanceContext.Provider>
  );
}

export function useSettingsAppearance(): SettingsAppearanceContextValue {
  return useContext(SettingsAppearanceContext);
}
