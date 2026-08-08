"use client";

import { useState, useEffect } from "react";
import {
  Ship,
  Wrench,
  FileBadge,
  CalendarDays,
  ShieldCheck,
  Building2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
  ArrowRight,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantPageContainer } from "@/components/shared/assistant-page-container";

type SurveyStatus = "CURRENT" | "UPCOMING" | "DUE_SOON" | "OVERDUE" | "BLOCKING" | "UNKNOWN";

interface SurveyItem {
  readonly surveyType: string;
  readonly dueDate: string;
  readonly status: SurveyStatus;
  readonly source: string;
  readonly lastCompleted: string | null;
}

interface CertItem {
  readonly certificateType: string;
  readonly title: string;
  readonly expiresAt: string | null;
  readonly status: string;
  readonly source: string;
}

interface DeadlineItem {
  readonly label: string;
  readonly dueDate: string;
  readonly daysRemaining: number;
  readonly status: SurveyStatus;
  readonly blocking: boolean;
  readonly impact: string;
}

interface CharterEntry {
  readonly period: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly charterType: string;
  readonly counterParty: string;
  readonly portCalls: ReadonlyArray<string>;
  readonly maintenanceWindow: boolean;
}

interface ImpactStatement {
  readonly claim: string;
  readonly impact: string;
  readonly basis: string;
}

interface MaintenanceAnswerJson {
  readonly text: string;
  readonly schedule?: ReadonlyArray<SurveyItem>;
  readonly certificates?: ReadonlyArray<CertItem>;
  readonly deadlines?: ReadonlyArray<DeadlineItem>;
  readonly classSociety?: { readonly known: boolean; readonly status: string; readonly classSociety: string; readonly classificationStatus: string };
  readonly charterCalendar?: ReadonlyArray<CharterEntry>;
  readonly planStatus?: { readonly planVersion: string; readonly nextReviewDue: string | null; readonly reviewStatus: SurveyStatus };
  readonly impacts?: ReadonlyArray<ImpactStatement>;
  readonly handoff?: { readonly target: string; readonly confidence: number; readonly reason: string };
}

const OPERATOR_ID = "ops-001";
const ORG_ID = "org-001";

const SCENARIOS: ReadonlyArray<{ readonly key: string; readonly label: string }> = [
  { key: "all-current", label: "All current" },
  { key: "due-soon", label: "Due soon" },
  { key: "overdue-annual", label: "Overdue annual" },
  { key: "expired-iscc", label: "Expired ISCC" },
  { key: "mp-review-due", label: "MP review due" },
  { key: "multiple-deadlines", label: "Multiple deadlines" },
  { key: "no-schedule", label: "No schedule" },
  { key: "unknown-class", label: "Unknown class" },
];

const QUICK_ACTIONS: ReadonlyArray<{ readonly label: string; readonly query: string }> = [
  { label: "Survey schedule", query: "What is our survey schedule?" },
  { label: "Any deadlines?", query: "What deadlines are coming up?" },
  { label: "Certificates", query: "Are any certificates expired?" },
  { label: "Blocking items", query: "Is anything blocking maintenance?" },
  { label: "Maintenance window", query: "When is the next maintenance window?" },
  { label: "Monitoring plan", query: "When is the monitoring plan review due?" },
];

const STATUS_STYLES: Record<SurveyStatus, string> = {
  CURRENT: "border-primary/50 bg-primary/15 text-primary",
  UPCOMING: "border-[hsl(var(--success-soft))]/50 bg-[hsl(var(--success-soft))]/15 text-[hsl(var(--success-soft))]",
  DUE_SOON: "border-warning/50 bg-warning/15 text-warning",
  OVERDUE: "border-destructive/50 bg-destructive/15 text-destructive",
  BLOCKING: "border-destructive/70 bg-destructive/25 text-[hsl(var(--destructive-soft))]",
  UNKNOWN: "border-border bg-card text-foreground/40",
};

function SectionLabel({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-warning">
      {children}
    </p>
  );
}

function StatusPill({ status }: { readonly status: SurveyStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function ImpactTag({ impact }: { readonly impact: string }) {
  const style =
    impact === "DETERMINISTIC_IMPACT"
      ? "border-warning/40 bg-warning/10 text-warning"
      : impact === "ADVISORY_RECOMMENDATION"
        ? "border-primary/40 bg-primary/10 text-primary"
        : "border-border bg-card text-foreground/50";
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${style}`}>
      {impact.replace(/_/g, " ")}
    </span>
  );
}

export default function MaintenancePage() {
  const [query, setQuery] = useState("What is our survey schedule?");
  const [answer, setAnswer] = useState<MaintenanceAnswerJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState("all-current");

  async function ask(q: string, scenarioKey: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          scenario: scenarioKey,
          operator_id: OPERATOR_ID,
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
      setAnswer(json.data as MaintenanceAnswerJson);
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

  return (
    <AssistantPageContainer>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10">
          <Wrench className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl font-semibold leading-none text-foreground">
            Aurelia
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/50">
            IMO 9074729 · Maintenance Console
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-warning">
          <ShieldAlert className="h-3 w-3" />
          Mock Mode
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {SCENARIOS.map((s) => (
          <button
            key={s.key}
            onClick={() => setScenario(s.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
              scenario === s.key
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-card text-foreground/50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Desktop operational grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
        {/* Main column: status data */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2 xl:col-span-1">
          {/* Survey schedule */}
          {answer?.schedule && answer.schedule.length > 0 && (
            <>
              <SectionLabel>Survey schedule</SectionLabel>
              <div className="flex flex-col gap-2">
                {answer.schedule.map((s) => (
                  <div
                    key={s.surveyType}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {s.surveyType} survey
                        </p>
                        <StatusPill status={s.status} />
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-foreground/60">
                        due {s.dueDate.slice(0, 10)}
                        {s.lastCompleted ? ` · last completed ${s.lastCompleted.slice(0, 10)}` : ""}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-foreground/40">{s.source}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Certificates */}
          {answer?.certificates && answer.certificates.length > 0 && (
            <>
              <SectionLabel>Certificates</SectionLabel>
              <div className="flex flex-col gap-2">
                {answer.certificates.map((c) => (
                  <div
                    key={c.certificateType}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <FileBadge className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{c.title}</p>
                      <p className="mt-0.5 font-mono text-[11px] uppercase text-foreground/60">
                        {c.status}
                        {c.expiresAt ? ` · expires ${c.expiresAt.slice(0, 10)}` : " · no expiry on file"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Deterministic impacts */}
          {answer?.impacts && answer.impacts.length > 0 && (
            <>
              <SectionLabel>Deterministic impacts</SectionLabel>
              <div className="flex flex-col gap-2">
                {answer.impacts.map((i, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <ImpactTag impact={i.impact} />
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-foreground/85">{i.claim}</p>
                      <p className="mt-1 font-mono text-[10px] text-foreground/40">{i.basis}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Deadlines */}
          {answer?.deadlines && answer.deadlines.length > 0 && (
            <>
              <SectionLabel>Deadlines</SectionLabel>
              <div className="flex flex-col gap-2">
                {answer.deadlines.map((d) => (
                  <div
                    key={d.label}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <Clock className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{d.label}</p>
                      <p className="font-mono text-[11px] text-foreground/60">
                        {d.dueDate.slice(0, 10)}
                        {d.daysRemaining >= 0
                          ? ` · ${d.daysRemaining}d`
                          : ` · ${Math.abs(d.daysRemaining)}d overdue`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.blocking && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[hsl(var(--destructive-soft))]">
                          blocking
                        </span>
                      )}
                      <StatusPill status={d.status} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Charter calendar */}
          {answer?.charterCalendar && answer.charterCalendar.length > 0 && (
            <>
              <SectionLabel>Charter calendar</SectionLabel>
              <div className="flex flex-col gap-2">
                {answer.charterCalendar.map((e) => (
                  <div
                    key={e.period}
                    className={`flex items-start gap-3 rounded-xl border p-4 ${
                      e.maintenanceWindow
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <Ship className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {e.period}
                        {e.maintenanceWindow && (
                          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-primary">
                            maintenance window
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-foreground/60">
                        {e.startDate.slice(0, 10)} → {e.endDate.slice(0, 10)} · {e.counterParty} ·{" "}
                        {e.portCalls.join(", ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Class society / plan status */}
          {answer?.classSociety && (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {answer.classSociety.known
                    ? `${answer.classSociety.classSociety} · ${answer.classSociety.classificationStatus}`
                    : "Class society unknown"}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-foreground/60">
                  {answer.classSociety.known ? "In class" : "No class record on file"}
                </p>
              </div>
            </div>
          )}

          {answer?.planStatus && (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Monitoring plan v{answer.planStatus.planVersion}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-foreground/60">
                  {answer.planStatus.nextReviewDue
                    ? `next review due ${answer.planStatus.nextReviewDue.slice(0, 10)}`
                    : "no review date on file"}
                </p>
              </div>
              {answer.planStatus.nextReviewDue && (
                <StatusPill status={answer.planStatus.reviewStatus} />
              )}
            </div>
          )}

          {/* Handoff banner */}
          {answer?.handoff && (
            <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-warning">
                  Routed to{" "}
                  {answer.handoff.target === "captain"
                    ? "Captain Assistant"
                    : answer.handoff.target === "compliance"
                      ? "Compliance Assistant"
                      : "Search Assistant"}
                </p>
                <p className="mt-0.5 text-xs text-foreground/70">{answer.handoff.reason}</p>
              </div>
            </div>
          )}

          {/* Answer text */}
          {answer?.text &&
            !answer.schedule &&
            !answer.certificates &&
            !answer.deadlines &&
            !answer.charterCalendar &&
            !answer.classSociety &&
            !answer.planStatus && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-foreground/85">
                  {answer.text}
                </p>
              </div>
            )}
        </div>

        {/* Right rail: actions */}
        <div className="flex min-w-0 flex-col gap-4">
          <SectionLabel>Quick actions</SectionLabel>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.query}
                variant="outline"
                className="h-14 justify-start gap-2 rounded-xl border-border bg-card px-4 text-left text-sm font-medium text-foreground/90 hover:bg-secondary"
                onClick={() => {
                  setQuery(action.query);
                  void ask(action.query, scenario);
                }}
                disabled={loading}
              >
                <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
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
              placeholder="Ask your maintenance console…"
              className="min-h-[64px] flex-1 resize-none rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-foreground/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
            <Button
              className="h-[64px] w-16 shrink-0 rounded-xl bg-primary text-background hover:bg-[hsl(var(--primary-dim))]"
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
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-foreground/40" />
        <p className="font-mono text-[10px] text-foreground/40">
          Survey posture only · deterministic statuses · not a CMMS
        </p>
      </div>
    </AssistantPageContainer>
  );
}
