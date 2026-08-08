"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ChatToolCall, ChatToolStatus } from "./types";

const STATUS_DOT: Record<ChatToolStatus, string> = {
  success: "bg-success",
  error: "bg-destructive",
  partial: "bg-warning",
};

function defaultStatus(tc: ChatToolCall): ChatToolStatus {
  return tc.success ? "success" : "error";
}

export function ToolCallTrace({
  calls,
  statusFn = defaultStatus,
}: {
  readonly calls: ReadonlyArray<ChatToolCall>;
  readonly statusFn?: (tc: ChatToolCall) => ChatToolStatus;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        View tool activity ({calls.length})
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          {calls.map((tc, i) => {
            const status = statusFn(tc);
            return (
              <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className={cn("inline-block h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
                <span className="font-mono">{tc.toolName}</span>
                <span className="text-[10px] opacity-60">{tc.latencyMs}ms</span>
                {status === "partial" && (
                  <span className="font-mono text-[9px] text-yellow-600 dark:text-yellow-400 uppercase">
                    partial
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
