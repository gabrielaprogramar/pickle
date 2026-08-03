"use client";

import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { SaveBar, SettingsCard, Toggle } from "@/components/settings/settings-ui";
import { Skeleton } from "@/components/ui/skeleton";
import type { NotificationPreferences } from "@/lib/settings";

export default function NotificationsSettingsPage() {
  const { bundle, isLoading, updateNotifications } = useSettings();
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (isLoading || !bundle) {
    return <Skeleton className="h-72 w-full" />;
  }

  const current = draft ?? bundle.notificationPreferences;
  const base = bundle.notificationPreferences;
  const dirty = draft !== null;

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    setSaved(false);
    await updateNotifications(draft);
    setSaving(false);
    setSaved(true);
    setDraft(null);
    setTimeout(() => setSaved(false), 2000);
  }

  function patch(key: keyof NotificationPreferences, value: boolean) {
    setDraft((prev) => ({ ...(prev ?? base), [key]: value }));
  }

  const rows: readonly { key: keyof NotificationPreferences; label: string; description: string }[] = [
    { key: "emails", label: "Email notifications", description: "Send email for events you subscribe to" },
    { key: "complianceAlerts", label: "Compliance alerts", description: "Deadline and obligation reminders" },
    { key: "certificateExpiry", label: "Certificate expiry", description: "Warn before a certificate lapses" },
    { key: "fuelAlerts", label: "Fuel alerts", description: "Bunker consumption anomalies" },
    { key: "noonReport", label: "Noon reports", description: "Confirmations and missing-report reminders" },
    { key: "assistantDigests", label: "Assistant digests", description: "Weekly summaries from the assistants" },
    { key: "systemAnnouncements", label: "System announcements", description: "Product updates and maintenance windows" },
  ];

  return (
    <div className="max-w-2xl">
      <SettingsCard
        title="Notifications"
        description="Choose which events reach this workspace"
        footer={
          <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={onSave} />
        }
      >
        <div className="space-y-2">
          {rows.map((row) => (
            <Toggle
              key={row.key}
              label={row.label}
              description={row.description}
              checked={current[row.key]}
              onChange={(v) => patch(row.key, v)}
            />
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}
