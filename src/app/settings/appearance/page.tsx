"use client";

import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import {
  ChoiceField,
  SaveBar,
  SettingsCard,
} from "@/components/settings/settings-ui";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppearanceSettings } from "@/lib/settings";

const THEMES: readonly { value: AppearanceSettings["theme"]; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const ACCENTS: readonly { value: AppearanceSettings["accent"]; label: string }[] = [
  { value: "blue", label: "Blue" },
  { value: "teal", label: "Teal" },
  { value: "slate", label: "Slate" },
];

const SIDEBAR: readonly { value: AppearanceSettings["sidebarDensity"]; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
];

const TABLE: readonly { value: AppearanceSettings["tableDensity"]; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "roomy", label: "Roomy" },
];

const GRID: readonly { value: AppearanceSettings["gridView"]; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
];

export default function AppearanceSettingsPage() {
  const { bundle, isLoading, updateAppearance } = useSettings();
  const [draft, setDraft] = useState<AppearanceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (isLoading || !bundle) {
    return <Skeleton className="h-72 w-full" />;
  }

  const current = draft ?? bundle.appearance;
  const base = bundle.appearance;
  const dirty = draft !== null && Object.keys(draft).some(
    (k) => draft[k as keyof AppearanceSettings] !== base[k as keyof AppearanceSettings],
  );

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    setSaved(false);
    await updateAppearance(draft);
    setSaving(false);
    setSaved(true);
    setDraft(null);
    setTimeout(() => setSaved(false), 2000);
  }

  function patch<K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) {
    setDraft((prev) => ({ ...(prev ?? base), [key]: value }));
  }

  return (
    <div className="max-w-2xl">
      <SettingsCard
        title="Appearance"
        description="Look and feel for this workspace"
        footer={
          <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={onSave} />
        }
      >
        <div className="space-y-3">
          <ChoiceField
            label="Theme"
            value={current.theme}
            onChange={(v) => patch("theme", v)}
            options={THEMES}
          />
          <ChoiceField
            label="Accent color"
            value={current.accent}
            onChange={(v) => patch("accent", v)}
            options={ACCENTS}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ChoiceField
              label="Sidebar density"
              value={current.sidebarDensity}
              onChange={(v) => patch("sidebarDensity", v)}
              options={SIDEBAR}
            />
            <ChoiceField
              label="Table density"
              value={current.tableDensity}
              onChange={(v) => patch("tableDensity", v)}
              options={TABLE}
            />
          </div>
          <ChoiceField
            label="Default view"
            value={current.gridView}
            onChange={(v) => patch("gridView", v)}
            options={GRID}
          />
        </div>
      </SettingsCard>
    </div>
  );
}
