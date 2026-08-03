"use client";

import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface AuthShellProps {
  readonly title: string;
  readonly subtitle: string;
  readonly children: React.ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Image
            src="/logo.png"
            alt="Poseidon Ledger"
            width={140}
            height={24}
            priority
          />
        </div>
        <Card>
          <CardHeader>
            <h1 className="font-serif text-lg font-light tracking-tight">{title}</h1>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
