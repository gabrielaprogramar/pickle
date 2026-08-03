"use client";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function SettingsCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <Card className={cn("mb-4", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-border p-3 pt-3">
          {footer}
        </div>
      )}
    </Card>
  );
}

export function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  type = "text",
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly type?: string;
}) {
  return (
    <Field label={label}>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function ChoiceField<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  readonly label: string;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly options: readonly { value: T; label: string }[];
  readonly disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <Select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function SaveBar({
  dirty,
  saving,
  saved,
  onSave,
}: {
  readonly dirty: boolean;
  readonly saving: boolean;
  readonly saved: boolean;
  readonly onSave: () => void;
}) {
  return (
    <>
      <span
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.1em]",
          saved ? "text-success" : "text-muted-foreground",
        )}
      >
        {saving ? "Saving…" : saved ? "Saved" : dirty ? "Unsaved changes" : "Up to date"}
      </span>
      <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
        Save changes
      </Button>
    </>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  readonly label: string;
  readonly description?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5",
        disabled && "opacity-50",
      )}
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        {description && (
          <span className="block text-[11px] text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          checked ? "bg-primary border-primary" : "bg-muted border-border",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
            checked ? "translate-x-[18px] bg-primary-foreground" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}
