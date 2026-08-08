"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBannerProps {
  readonly message: string;
  readonly code?: string;
  readonly onRetry?: () => void;
  readonly onDismiss?: () => void;
}

export function ErrorBanner({
  message,
  code,
  onRetry,
  onDismiss,
}: ErrorBannerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-destructive/70">
          System Alert
          {mounted && (
            <span className="ml-2 normal-case tracking-normal opacity-60">
              {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </p>
        <p className="text-xs text-destructive font-medium">
          {code && (
            <span className="font-mono-technical text-[10px] opacity-70 mr-1.5">
              [{code}]
            </span>
          )}
          {message}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
          >
            <RotateCw className="h-3 w-3" />
            Retry
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
