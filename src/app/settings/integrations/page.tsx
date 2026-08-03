"use client";

import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { INTEGRATIONS } from "@/lib/integrations/catalog";
import type { IntegrationState } from "@/lib/settings";

function CategoryBadge({ category }: { readonly category: string }) {
  const variant =
    category === "AI"
      ? "default"
      : category === "Email"
        ? "secondary"
        : category === "Fleet"
          ? "warning"
          : "outline";
  return <Badge variant={variant as "default"}>{category}</Badge>;
}

export default function IntegrationsSettingsPage() {
  const { bundle, isLoading, configureIntegration, disconnectIntegration } =
    useSettings();

  if (isLoading || !bundle) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-xs text-muted-foreground">
        Connect external services. Credentials are stored as mock configuration
        only — no external service is contacted in this environment.
      </p>
      {bundle.integrations.map((state) => (
        <IntegrationCard
          key={state.provider}
          state={state}
          onConfigure={(config) => configureIntegration(state.provider, config)}
          onDisconnect={() => disconnectIntegration(state.provider)}
        />
      ))}
    </div>
  );
}

function IntegrationCard({
  state,
  onConfigure,
  onDisconnect,
}: {
  readonly state: IntegrationState;
  readonly onConfigure: (config: Record<string, string>) => void;
  readonly onDisconnect: () => void;
}) {
  const entry = INTEGRATIONS.find((i) => i.provider === state.provider);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!entry) return null;

  const configured = state.status === "CONFIGURED";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onConfigure(values);
      setValues({});
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3 p-3 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium">{entry.name}</h2>
            <CategoryBadge category={entry.category} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.description}
          </p>
        </div>
        <Badge variant={configured ? "success" : "muted"}>
          {configured ? "Configured" : "Not configured"}
        </Badge>
      </div>

      {configured ? (
        <div className="border-t border-border p-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            Connected{state.configuredAt ? ` · ${new Date(state.configuredAt).toLocaleDateString()}` : ""}
          </p>
          {Object.keys(state.displayValues).length > 0 && (
            <dl className="mb-3 space-y-1">
              {Object.entries(state.displayValues).map(([key, value]) => (
                <div key={key} className="flex items-baseline justify-between gap-4">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    {entry.fields.find((f) => f.key === key)?.label ?? key}
                  </dt>
                  <dd className="font-mono text-[11px]">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={async () => {
              setSaving(true);
              await onDisconnect();
              setSaving(false);
            }}
            disabled={saving}
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="border-t border-border p-3">
          <div className="space-y-2.5">
            {entry.fields.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={`${entry.provider}-${field.key}`}>
                  {field.label}
                  {field.secret && (
                    <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                      secret
                    </span>
                  )}
                </Label>
                <Input
                  id={`${entry.provider}-${field.key}`}
                  type={field.secret ? "password" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  required
                  disabled={saving}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save configuration"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
