"use client";

import { useState, useEffect } from "react";
import {
  Ship,
  Anchor,
  Mail,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Send,
  Inbox,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantPageContainer } from "@/components/shared/assistant-page-container";

// --- Types (subset of the CaptainAnswer contract) ---

interface ChecklistItem {
  readonly requirement: string;
  readonly status: "GREEN" | "AMBER" | "RED";
  readonly evidence: string;
  readonly missing: string | null;
  readonly deadline: string | null;
  readonly recommendedAction: string;
  readonly source: string;
}

interface ReadinessResult {
  readonly port: string;
  readonly arrivalDate: string | null;
  readonly level: "GREEN" | "AMBER" | "RED";
  readonly summary: string;
  readonly checklist: ReadonlyArray<ChecklistItem>;
  readonly missingBlocking: ReadonlyArray<string>;
}

interface IngestEvent {
  readonly fileName: string;
  readonly status: string;
  readonly receivedAt: string;
  readonly detail: string;
}

interface PortCall {
  readonly port: string;
  readonly arrivalDate: string;
  readonly departureDate: string;
  readonly status: string;
}

interface CaptainAnswerJson {
  readonly text: string;
  readonly readiness?: ReadinessResult;
  readonly checklist?: ReadonlyArray<ChecklistItem>;
  readonly ingest?: ReadonlyArray<IngestEvent>;
  readonly portCalls?: ReadonlyArray<PortCall>;
  readonly handoff?: { readonly target: string; readonly confidence: number; readonly reason: string };
}

// --- Constants ---

const CAPTAIN_ID = "captain-001";
const ORG_ID = "org-001";

const SCENARIOS: ReadonlyArray<{ readonly key: string; readonly label: string }> = [
  { key: "amber", label: "AMBER — ISCC missing" },
  { key: "green", label: "GREEN — all set" },
  { key: "red", label: "RED — blocking missing" },
  { key: "bdn-received", label: "BDN received" },
  { key: "bdn-processing", label: "BDN processing" },
  { key: "bdn-review", label: "BDN needs review" },
  { key: "bdn-complete", label: "BDN complete" },
  { key: "upcoming-port", label: "Upcoming port" },
  { key: "no-port", label: "No port" },
  { key: "unknown", label: "Unknown evidence" },
];

const QUICK_ACTIONS: ReadonlyArray<{ readonly label: string; readonly query: string }> = [
  { label: "Am I ready for Antibes?", query: "Am I ready for Antibes?" },
  { label: "What am I missing?", query: "What am I missing before arrival?" },
  { label: "Did you receive my BDN?", query: "Did you receive my BDN?" },
  { label: "Where do I send my BDN?", query: "Where do I send my BDN?" },
  { label: "When is my next port?", query: "When is my next port?" },
  { label: "What is blocking my vessel?", query: "What is blocking my vessel?" },
];

const LEVEL_STYLES: Record<
  "GREEN" | "AMBER" | "RED",
  { readonly bar: string; readonly chip: string }
> = {
  GREEN: {
    bar: "border-[#00B89F]/40 bg-[#00B89F]/10 text-[#00B89F]",
    chip: "bg-[#00B89F]/20 text-[#00B89F] border-[#00B89F]/50",
  },
  AMBER: {
    bar: "border-[#C9A84C]/40 bg-[#C9A84C]/10 text-[#C9A84C]",
    chip: "bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/50",
  },
  RED: {
    bar: "border-[#D94F4F]/40 bg-[#D94F4F]/10 text-[#D94F4F]",
    chip: "bg-[#D94F4F]/20 text-[#D94F4F] border-[#D94F4F]/50",
  },
};

const CHECK_STYLES: Record<"GREEN" | "AMBER" | "RED", string> = {
  GREEN: "border-[#00B89F]/30 text-[#00B89F]",
  AMBER: "border-[#C9A84C]/30 text-[#C9A84C]",
  RED: "border-[#D94F4F]/30 text-[#D94F4F]",
};

function LevelIcon({ level }: { readonly level: "GREEN" | "AMBER" | "RED" }) {
  if (level === "GREEN") return <CheckCircle2 className="h-7 w-7" />;
  if (level === "AMBER") return <AlertTriangle className="h-7 w-7" />;
  return <XCircle className="h-7 w-7" />;
}

// --- Sub-components ---

function SectionLabel({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#C9A84C]">
      {children}
    </p>
  );
}

function ChecklistItemRow({ item }: { readonly item: ChecklistItem }) {
  const style = CHECK_STYLES[item.status];
  return (
    <div className={`rounded-xl border ${style} bg-background/40 p-4`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] font-bold ${style}`}
        >
          {item.status === "GREEN" ? "G" : item.status === "AMBER" ? "A" : "R"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#F4F2EC]">{item.requirement}</p>
          <p className="mt-0.5 text-xs text-[#F4F2EC]/70">
            Evidence: {item.evidence}
            {item.missing ? ` · Missing: ${item.missing}` : ""}
          </p>
          {item.deadline && (
            <p className="mt-0.5 font-mono text-[11px] text-[#C9A84C]">Deadline: {item.deadline}</p>
          )}
          <p className="mt-1 text-xs text-[#F4F2EC]/80">→ {item.recommendedAction}</p>
          <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-[#F4F2EC]/40">
            {item.source}
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Page ---

export default function CaptainPage() {
  const [query, setQuery] = useState("Am I ready for Antibes?");
  const [answer, setAnswer] = useState<CaptainAnswerJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState("amber");

  async function ask(q: string, scenarioKey: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/captain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          scenario: scenarioKey,
          captain_id: CAPTAIN_ID,
          organization_id: ORG_ID,
        }),
      });
      const json: Record<string, unknown> = await res.json();
      if (!json.success) {
        const err = json.error;
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Request failed";
        throw new Error(message);
      }
      setAnswer(json.data as CaptainAnswerJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setAnswer(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void ask(query, scenario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  const readiness = answer?.readiness;

  return (
    <AssistantPageContainer>
      {/* Vessel header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#00B89F]/40 bg-[#00B89F]/10">
          <Ship className="h-6 w-6 text-[#00B89F]" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl font-semibold leading-none text-[#F4F2EC]">
            Aurelia
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[#F4F2EC]/50">
            IMO 9074729 · Captain Console
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#C9A84C]">
          <ShieldAlert className="h-3 w-3" />
          Mock Mode
        </span>
      </div>

      {/* Scenario picker (mock only) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {SCENARIOS.map((s) => (
          <button
            key={s.key}
            onClick={() => setScenario(s.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
              scenario === s.key
                ? "border-[#00B89F]/60 bg-[#00B89F]/15 text-[#00B89F]"
                : "border-border bg-card text-[#F4F2EC]/50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Status-first readiness banner */}
      {readiness && (
        <div
          className={`rounded-2xl border ${LEVEL_STYLES[readiness.level].bar} p-5`}
        >
          <div className="flex items-center gap-3">
            <LevelIcon level={readiness.level} />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F4F2EC]/60">
                Port Vauban · {readiness.port}
              </p>
              <p className="font-serif text-3xl font-semibold leading-tight">
                {readiness.level}
              </p>
              {readiness.arrivalDate && (
                <p className="font-mono text-[11px] text-[#F4F2EC]/60">
                  Arrival {readiness.arrivalDate.slice(0, 10)}
                </p>
              )}
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#F4F2EC]/85">
            {readiness.summary}
          </p>
        </div>
      )}

      {/* Desktop operational grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
        {/* Left: checklist / answer */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2 xl:col-span-1">
          {readiness && (
            <>
              <SectionLabel>Checklist</SectionLabel>
              <div className="flex flex-col gap-2.5">
                {readiness.checklist.map((item, i) => (
                  <ChecklistItemRow key={i} item={item} />
                ))}
              </div>
            </>
          )}

          {/* Answer text */}
          {answer?.text && !readiness && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-[#F4F2EC]/85">
                {answer.text}
              </p>
            </div>
          )}
        </div>

        {/* Right rail: actions + inbound */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Quick actions */}
          <SectionLabel>Quick actions</SectionLabel>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.query}
                variant="outline"
                className="h-14 justify-start gap-2 rounded-xl border-border bg-card px-4 text-left text-sm font-medium text-[#F4F2EC]/90 hover:bg-secondary"
                onClick={() => {
                  setQuery(action.query);
                  void ask(action.query, scenario);
                }}
                disabled={loading}
              >
                <ArrowRight className="h-4 w-4 shrink-0 text-[#00B89F]" />
                <span className="leading-tight">{action.label}</span>
              </Button>
            ))}
          </div>

          {/* Ask box */}
          <div className="flex items-end gap-2">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(query, scenario);
                }
              }}
              rows={2}
              placeholder="Ask your captain console…"
              className="min-h-[64px] flex-1 resize-none rounded-xl border border-input bg-card px-4 py-3 text-sm text-[#F4F2EC] placeholder:text-[#F4F2EC]/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00B89F]"
            />
            <Button
              className="h-[64px] w-16 shrink-0 rounded-xl bg-[#00B89F] text-[#060F1E] hover:bg-[#007A6A]"
              onClick={() => void ask(query, scenario)}
              disabled={loading || !query.trim()}
              title="Ask"
            >
              {loading ? (
                <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  <div
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Ingest status */}
          {answer?.ingest && answer.ingest.length > 0 && (
            <>
              <SectionLabel>BDN status</SectionLabel>
              <div className="flex flex-col gap-2">
                {answer.ingest.map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-[#00B89F]" />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] text-[#F4F2EC]/80">{ev.fileName}</p>
                      <p className="mt-0.5 text-xs text-[#F4F2EC]/60">
                        {ev.status.replace(/_/g, " ")} · received {ev.receivedAt.slice(0, 10)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Port calls */}
          {answer?.portCalls && answer.portCalls.length > 0 && (
            <>
              <SectionLabel>Upcoming ports</SectionLabel>
              <div className="flex flex-col gap-2">
                {answer.portCalls.map((pc, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <Anchor className="h-4 w-4 shrink-0 text-[#00B89F]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#F4F2EC]">{pc.port}</p>
                      <p className="font-mono text-[11px] text-[#F4F2EC]/60">
                        {pc.arrivalDate.slice(0, 10)} → {pc.departureDate.slice(0, 10)}
                      </p>
                    </div>
                    <CalendarDays className="h-4 w-4 text-[#F4F2EC]/40" />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Handoff banner */}
          {answer?.handoff && (
            <div className="flex items-start gap-3 rounded-xl border border-[#C9A84C]/40 bg-[#C9A84C]/10 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A84C]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#C9A84C]">
                  Routed to {answer.handoff.target === "compliance" ? "Compliance Assistant" : "Search Assistant"}
                </p>
                <p className="mt-0.5 text-xs text-[#F4F2EC]/70">{answer.handoff.reason}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#D94F4F]/40 bg-[#D94F4F]/10 p-3">
          <p className="text-xs text-[#D94F4F]">{error}</p>
        </div>
      )}

      {/* Footer / advisory */}
      <div className="mt-2 flex items-center gap-2">
        <Mail className="h-3.5 w-3.5 shrink-0 text-[#F4F2EC]/40" />
        <p className="font-mono text-[10px] text-[#F4F2EC]/40">
          BDN inbox: imo9074729@docs.poseidonledger.com · Advisory only
        </p>
      </div>
    </AssistantPageContainer>
  );
}
