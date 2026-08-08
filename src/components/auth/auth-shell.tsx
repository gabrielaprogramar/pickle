"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand/logo";

interface AuthShellProps {
  readonly title: string;
  readonly subtitle: string;
  readonly label?: string;
  readonly children: React.ReactNode;
}

export function AuthShell({ title, subtitle, label, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <BrandLogo width={140} height={24} priority />
        </div>
        <Card>
          <CardHeader>
            {label ? (
              <p className="mb-1 flex items-center gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
                <span className="block h-px w-7 bg-primary" aria-hidden="true" />
                {label}
              </p>
            ) : (
              <span className="mb-1 block h-px w-7 bg-primary" aria-hidden="true" />
            )}
            <h1 className="font-serif text-lg font-light tracking-tight">{title}</h1>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
