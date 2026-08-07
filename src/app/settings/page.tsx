"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import {
  ChoiceField,
  SaveBar,
  SettingsCard,
  TextField,
} from "@/components/settings/settings-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const TIMEZONES: readonly string[] = [
  "UTC",
  "America/New_York",
  "Europe/London",
  "Europe/Athens",
  "Europe/Oslo",
  "Asia/Singapore",
  "Asia/Dubai",
  "Asia/Shanghai",
  "Australia/Sydney",
];

const LANGUAGES: readonly { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "el", label: "Ελληνικά" },
  { value: "no", label: "Norsk" },
];

function LocalTime({ timezone }: { readonly timezone: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(now);
  } catch {
    formatted = "—";
  }

  return (
    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
      Local time · <span className="text-primary">{formatted}</span>
    </p>
  );
}

export default function SettingsHomePage() {
  const { bundle, isLoading, updateGeneral } = useSettings();

  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (isLoading || !bundle) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const general = bundle.general;
  const name = organizationName ?? general.organizationName;
  const tz = timezone ?? general.defaultTimezone;
  const yr = year ?? String(general.defaultReportingYear);
  const lang = language ?? general.language;

  const dirty =
    name !== general.organizationName ||
    tz !== general.defaultTimezone ||
    yr !== String(general.defaultReportingYear) ||
    lang !== general.language;

  async function onSave() {
    setSaving(true);
    setSaved(false);
    const patch: {
      organizationName?: string;
      defaultTimezone?: string;
      defaultReportingYear?: number;
      language?: string;
    } = {};
    if (name !== general.organizationName) patch.organizationName = name;
    if (tz !== general.defaultTimezone) patch.defaultTimezone = tz;
    if (yr !== String(general.defaultReportingYear)) {
      patch.defaultReportingYear = Number(yr);
    }
    if (lang !== general.language) patch.language = lang;
    await updateGeneral(patch);
    setSaving(false);
    setSaved(true);
    setOrganizationName(null);
    setTimezone(null);
    setYear(null);
    setLanguage(null);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl">
      <SettingsCard
        title="General"
        description="Workspace defaults used across reporting and the interface"
        footer={
          <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={onSave} />
        }
      >
        <div className="space-y-3">
          <TextField
            label="Organization name"
            value={name}
            onChange={setOrganizationName}
            placeholder="Company name"
          />
          <ChoiceField
            label="Default timezone"
            value={tz}
            onChange={setTimezone}
            options={TIMEZONES.map((t) => ({ value: t, label: t }))}
          />
          <LocalTime timezone={tz} />
          <TextField
            label="Default reporting year"
            value={yr}
            onChange={(v) => setYear(v.replace(/[^0-9]/g, "").slice(0, 4))}
            type="number"
          />
          <ChoiceField
            label="Language"
            value={lang}
            onChange={setLanguage}
            options={LANGUAGES}
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Ελληνικά and Norsk are stored with your profile, but this build ships
            English-only interface strings, so the UI remains in English.
          </p>
        </div>
      </SettingsCard>

      <SettingsCard title="About" description="Application and platform versions">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {(
            [
              ["Application", bundle.about.appName],
              ["Version", bundle.about.appVersion],
              ["Build", bundle.about.buildVersion],
              ["Calculation engine", bundle.about.calculationEngineVersion],
              ["Authentication", bundle.about.authMode],
              ["Integrations", bundle.about.integrationsMode],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                {label}
              </dt>
              <dd className="font-mono text-[11px]">{value}</dd>
            </div>
          ))}
        </dl>
        <Separator className="my-3" />
        <p className="text-[11px] text-muted-foreground">
          MarineTraffic, Google Document AI, OpenAI and Resend connections are
          stored as configuration only — no external service is contacted in
          this environment.
        </p>
      </SettingsCard>
    </div>
  );
}
