"use client";

import { useState, useEffect, useRef } from "react";
import {
  Ship,
  Compass,
  Route,
  Waves,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
  ArrowRight,
  ShieldAlert,
  Clock,
  Gauge,
  FileCheck2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantPageContainer } from "@/components/shared/assistant-page-container";

type AisGapTier = "NONE" | "INTERPOLATION_OK" | "FLAGGED" | "MANUAL_REQUIRED" | "CRITICAL_ESCALATION";

interface PortRefJson {
  readonly name: string;
  readonly locode: string;
}

interface VoyageRecordJson {
  readonly voyageNumber: string;
  readonly departurePort: PortRefJson;
  readonly arrivalPort: PortRefJson;
  readonly departureTs: string;
  readonly arrivalTs: string;
  readonly classification: string;
  readonly etsCoverageRate: number | null;
  readonly distanceNm: number | null;
  readonly dataQuality: string;
  readonly source: string;
}

interface GapJson {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly durationMinutes: number;
  readonly tier: AisGapTier;
  readonly actionRequired: string;
  readonly escalation: boolean;
  readonly notes: string | null;
}

interface GapSummaryJson {
  readonly totalGaps: number;
  readonly worstTier: AisGapTier;
  readonly coveragePct: number;
  readonly flaggedGaps: number;
  readonly manualGaps: number;
  readonly criticalGaps: number;
  readonly referenceFrom: string;
  readonly referenceTo: string;
}

interface PortCallJson {
  readonly portName: string;
  readonly locode: string;
  readonly country: string;
  readonly greenZone: boolean;
  readonly arrTs: string | null;
  readonly depTs: string | null;
}

interface ViolationJson {
  readonly id: string;
  readonly code: string;
  readonly severity: string;
  readonly title: string;
  readonly description: string;
  readonly ruleReference: string;
  readonly recommendation: string;
}

interface GreenZoneJson {
  readonly zoneName: string;
  readonly zoneCategory: string;
  readonly enteredAt: string;
  readonly durationMinutes: number | null;
  readonly actionRequired: string;
}

interface ComplianceContextJson {
  readonly voyage: VoyageRecordJson;
  readonly etsCoverageRate: number | null;
  readonly classification: string;
  readonly actionableItems: ReadonlyArray<{ readonly id: string; readonly label: string; readonly severity: string }>;
}

interface ManualDraftJson {
  readonly status: "DRAFT" | "CONFIRMED";
  readonly voyageId: string;
  readonly departurePort: PortRefJson;
  readonly arrivalPort: PortRefJson;
  readonly departureTs: string;
  readonly arrivalTs: string;
  readonly distanceNm: number | null;
  readonly reason: string;
  readonly supportingEvidence: string;
  readonly verifierDefensibility: string;
}

interface AisSyncJson {
  readonly status: "DRAFT" | "CONFIRMED";
  readonly from: string;
  readonly to: string;
  readonly reason: string;
}

interface VoyageAnswerJson {
  readonly text: string;
  readonly voyage?: VoyageRecordJson | null;
  readonly gaps?: ReadonlyArray<GapJson>;
  readonly gapSummary?: GapSummaryJson | null;
  readonly ports?: ReadonlyArray<PortCallJson>;
  readonly violations?: ReadonlyArray<ViolationJson>;
  readonly greenZoneEncounters?: ReadonlyArray<GreenZoneJson>;
  readonly complianceContext?: ComplianceContextJson | null;
  readonly manualDraft?: ManualDraftJson | null;
  readonly aisSync?: AisSyncJson | null;
  readonly handoff?: { readonly target: string; readonly confidence: number; readonly reason: string };
}

const OPERATOR_ID = "ops-001";
const ORG_ID = "org-001";

const SCENARIOS: ReadonlyArray<{ readonly key: string; readonly label: string }> = [
  { key: "clean-voyage", label: "Clean voyage" },
  { key: "gap-under-30m", label: "Gap < 30m" },
  { key: "gap-30m-to-6h", label: "Gap 30m–6h" },
  { key: "gap-6h-to-48h", label: "Gap 6h–48h" },
  { key: "gap-over-48h", label: "Gap > 48h" },
  { key: "intra-eu", label: "Intra-EU" },
  { key: "eu-to-third-country", label: "EU → 3rd country" },
  { key: "third-country-to-eu", label: "3rd country → EU" },
  { key: "consistency-violation", label: "Consistency issue" },
  { key: "green-zone-encounter", label: "Green Zone" },
];

const QUICK_ACTIONS: ReadonlyArray<{ readonly label: string; readonly query: string }> = [
  { label: "Voyage ledger", query: "What does the voyage ledger look like?" },
  { label: "AIS gaps", query: "Are there any AIS gaps?" },
  { label: "Gap tier", query: "What tier is the AIS gap?" },
  { label: "ETS coverage", query: "What is my ETS coverage for the last voyage?" },
  { label: "Ports visited", query: "Which ports did we visit?" },
  { label: "Violations", query: "Are there any consistency violations?" },
];

const TIER_STYLES: Record<AisGapTier, string> = {
  NONE: "border-border bg-card text-foreground/40",
  INTERPOLATION_OK: "border-primary/50 bg-primary/15 text-primary",
  FLAGGED: "border-warning/50 bg-warning/15 text-warning",
  MANUAL_REQUIRED: "border-warning/50 bg-warning/15 text-[hsl(var(--warning-soft))]",
  CRITICAL_ESCALATION: "border-destructive/70 bg-destructive/25 text-[hsl(var(--destructive-soft))]",
};

const SEVERITY_STYLES: Record<string, string> = {
  LOW: "border-[hsl(var(--success-soft))]/50 bg-[hsl(var(--success-soft))]/15 text-[hsl(var(--success-soft))]",
  MEDIUM: "border-warning/50 bg-warning/15 text-warning",
  HIGH: "border-destructive/70 bg-destructive/25 text-[hsl(var(--destructive-soft))]",
};

function SectionLabel({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-warning">
      {children}
    </p>
  );
}

function TierPill({ tier }: { readonly tier: AisGapTier }) {
  const label = tier.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${TIER_STYLES[tier]}`}
    >
      {label}
    </span>
  );
}

function SeverityTag({ severity }: { readonly severity: string }) {
  const style = SEVERITY_STYLES[severity] ?? "border-border bg-card text-foreground/50";
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${style}`}>
      {severity}
    </span>
  );
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

function fmtTs(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

export default function VoyagePage() {
  const [query, setQuery] = useState("What does the voyage ledger look like?");
  const [answer, setAnswer] = useState<VoyageAnswerJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState("clean-voyage");
  const lastDraftQuery = useRef<string | null>(null);
  const lastSyncQuery = useRef<string | null>(null);

  async function ask(q: string, scenarioKey: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voyage", {
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
      const data = json.data as VoyageAnswerJson;
      if (data.manualDraft && data.manualDraft.status === "DRAFT") {
        lastDraftQuery.current = trimmed;
      }
      if (data.aisSync && data.aisSync.status === "DRAFT") {
        lastSyncQuery.current = trimmed;
      }
      setAnswer(data);
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

  const hasStructured = Boolean(
    answer?.voyage ||
      answer?.gaps ||
      answer?.ports ||
      answer?.violations ||
      answer?.greenZoneEncounters ||
      answer?.complianceContext ||
      answer?.manualDraft ||
      answer?.aisSync,
  );

  return (
    <AssistantPageContainer>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10">
          <Compass className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl font-light leading-none text-foreground">
            Aurelia
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/50">
            IMO 9074729 · Voyage Console
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
        {/* Main column: voyage data */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2 xl:col-span-1">
          {/* Voyage ledger */}
          {answer?.voyage && (
            <>
              <SectionLabel>Voyage ledger</SectionLabel>
              <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <Route className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {answer.voyage.voyageNumber}
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-primary">
                      {answer.voyage.classification}
                    </span>
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-foreground/70">
                    {answer.voyage.departurePort.name} ({answer.voyage.departurePort.locode}) →{" "}
                    {answer.voyage.arrivalPort.name} ({answer.voyage.arrivalPort.locode})
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-foreground/60">
                    {fmtDate(answer.voyage.departureTs)} → {fmtDate(answer.voyage.arrivalTs)}
                    {answer.voyage.distanceNm !== null
                      ? ` · ${answer.voyage.distanceNm} nm`
                      : " · distance not on file"}
                    {answer.voyage.etsCoverageRate !== null
                      ? ` · ${answer.voyage.etsCoverageRate}% ETS coverage`
                      : " · ETS coverage not on file"}
                    {" · "}
                    {answer.voyage.dataQuality}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-foreground/40">{answer.voyage.source}</p>
                </div>
              </div>
            </>
          )}

          {/* AIS data gaps */}
          {answer?.gaps && answer.gaps.length > 0 && (
            <>
              <SectionLabel>AIS data gaps</SectionLabel>
              {answer.gapSummary && (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                  <Gauge className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {answer.gapSummary.totalGaps} gap(s) · {answer.gapSummary.coveragePct}% coverage
                    </p>
                    <p className="font-mono text-[10px] text-foreground/50">
                      {answer.gapSummary.flaggedGaps} flagged · {answer.gapSummary.manualGaps} manual ·{" "}
                      {answer.gapSummary.criticalGaps} critical
                    </p>
                  </div>
                  <TierPill tier={answer.gapSummary.worstTier} />
                </div>
              )}
              <div className="flex flex-col gap-2">
                {answer.gaps.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <Waves className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {g.durationMinutes} min gap
                        </p>
                        <TierPill tier={g.tier} />
                        {g.escalation && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[hsl(var(--destructive-soft))]">
                            escalation
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-foreground/60">
                        {fmtTs(g.from)} → {fmtTs(g.to)}
                      </p>
                      <p className="mt-1 text-xs text-foreground/75">{g.actionRequired}</p>
                      {g.notes && (
                        <p className="mt-1 font-mono text-[10px] text-foreground/40">{g.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Port timeline */}
          {answer?.ports && answer.ports.length > 0 && (
            <>
              <SectionLabel>Port calls</SectionLabel>
              <div className="flex flex-col gap-2">
                {answer.ports.map((p, idx) => (
                  <div
                    key={`${p.locode}-${idx}`}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {p.portName}
                        {p.greenZone && (
                          <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-primary">
                            green zone port
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-foreground/60">
                        {p.locode} · {p.country} ·{" "}
                        {p.arrTs ? `arrived ${fmtDate(p.arrTs)}` : `departed ${p.depTs ? fmtDate(p.depTs) : "n/a"}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Green zone encounters */}
          {answer?.greenZoneEncounters && answer.greenZoneEncounters.length > 0 && (
            <>
              <SectionLabel>Green zone encounters</SectionLabel>
              <div className="flex flex-col gap-2">
                {answer.greenZoneEncounters.map((g) => (
                  <div
                    key={g.zoneName}
                    className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4"
                  >
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {g.zoneName}
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-primary">
                          {g.zoneCategory}
                        </span>
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-foreground/60">
                        entered {fmtDate(g.enteredAt)}
                        {g.durationMinutes !== null ? ` · ${g.durationMinutes} min in zone` : ""}
                      </p>
                      <p className="mt-1 text-xs text-foreground/75">{g.actionRequired}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Violations */}
          {answer?.violations && answer.violations.length > 0 && (
            <>
              <SectionLabel>Consistency & coverage violations</SectionLabel>
              <div className="flex flex-col gap-2">
                {answer.violations.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-[11px] font-semibold text-foreground">{v.code}</p>
                        <SeverityTag severity={v.severity} />
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground">{v.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground/85">{v.description}</p>
                      <p className="mt-1 font-mono text-[10px] text-foreground/45">Rule: {v.ruleReference}</p>
                      <p className="mt-1 text-xs text-warning">→ {v.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Compliance context */}
          {answer?.complianceContext && (
            <>
              <SectionLabel>Voyage compliance context</SectionLabel>
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                  <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      ETS coverage{" "}
                      {answer.complianceContext.etsCoverageRate !== null
                        ? `${answer.complianceContext.etsCoverageRate}%`
                        : "not on file"}
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-foreground/50">
                        {answer.complianceContext.classification}
                      </span>
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-foreground/60">
                      {answer.complianceContext.voyage.voyageNumber} ·{" "}
                      {answer.complianceContext.voyage.departurePort.name} →{" "}
                      {answer.complianceContext.voyage.arrivalPort.name}
                    </p>
                  </div>
                </div>
                {answer.complianceContext.actionableItems.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {answer.complianceContext.actionableItems.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                      >
                        <SeverityTag severity={a.severity} />
                        <span className="text-xs text-foreground/85">{a.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
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

          {/* Raw answer text fallback */}
          {answer?.text && !hasStructured && (
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

          {/* Manual voyage draft */}
          {answer?.manualDraft && (
            <div
              className={`flex flex-col gap-2 rounded-xl border p-4 ${
                answer.manualDraft.status === "CONFIRMED"
                  ? "border-primary/50 bg-primary/10"
                  : "border-warning/40 bg-warning/10"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-warning">
                  Manual voyage draft
                </p>
                {answer.manualDraft.status === "CONFIRMED" ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-primary">
                    <CheckCircle2 className="h-3 w-3" />
                    confirmed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-warning/50 bg-warning/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[hsl(var(--warning-soft))]">
                    <Clock className="h-3 w-3" />
                    draft
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-foreground">
                {answer.manualDraft.departurePort.name} → {answer.manualDraft.arrivalPort.name}
              </p>
              <p className="font-mono text-[11px] text-foreground/60">
                {fmtDate(answer.manualDraft.departureTs)} → {fmtDate(answer.manualDraft.arrivalTs)}
                {answer.manualDraft.distanceNm !== null
                  ? ` · ${answer.manualDraft.distanceNm} nm (stored)`
                  : ""}
              </p>
              <p className="text-xs leading-relaxed text-foreground/80">{answer.manualDraft.reason}</p>
              {answer.manualDraft.status === "DRAFT" && lastDraftQuery.current && (
                <Button
                  className="mt-1 h-9 w-full gap-2 rounded-lg bg-warning text-background hover:bg-[hsl(var(--warning-hover))]"
                  onClick={() => void ask(`${lastDraftQuery.current} confirm`, scenario)}
                  disabled={loading}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm draft
                </Button>
              )}
              {answer.manualDraft.status === "CONFIRMED" && (
                <p className="font-mono text-[10px] text-primary">
                  The draft is on the ledger and substantiates the covered segment.
                </p>
              )}
            </div>
          )}

          {/* AIS backfill request */}
          {answer?.aisSync && (
            <div
              className={`flex flex-col gap-2 rounded-xl border p-4 ${
                answer.aisSync.status === "CONFIRMED"
                  ? "border-primary/50 bg-primary/10"
                  : "border-warning/40 bg-warning/10"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-warning">
                  AIS backfill request
                </p>
                {answer.aisSync.status === "CONFIRMED" ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-primary">
                    <CheckCircle2 className="h-3 w-3" />
                    confirmed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border border-warning/50 bg-warning/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-warning">
                    <RefreshCw className="h-3 w-3" />
                    draft
                  </span>
                )}
              </div>
              <p className="font-mono text-[11px] text-foreground/70">
                {fmtTs(answer.aisSync.from)} → {fmtTs(answer.aisSync.to)}
              </p>
              <p className="text-xs leading-relaxed text-foreground/80">{answer.aisSync.reason}</p>
              {answer.aisSync.status === "DRAFT" && lastSyncQuery.current && (
                <Button
                  className="mt-1 h-9 w-full gap-2 rounded-lg bg-primary text-background hover:bg-[hsl(var(--primary-dim))]"
                  onClick={() => void ask(`${lastSyncQuery.current} confirm`, scenario)}
                  disabled={loading}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm backfill
                </Button>
              )}
              {answer.aisSync.status === "CONFIRMED" && (
                <p className="font-mono text-[10px] text-primary">
                  Backfill queued from source providers. Positions are never fabricated.
                </p>
              )}
            </div>
          )}

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
              placeholder="Ask your voyage console…"
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
        {answer?.gapSummary && answer.gapSummary.totalGaps === 0 ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
        ) : (
          <XCircle className="h-3.5 w-3.5 shrink-0 text-foreground/40" />
        )}
        <p className="font-mono text-[10px] text-foreground/40">
          Stored voyage facts only · no fabricated positions · gap ladder deterministic
        </p>
      </div>
    </AssistantPageContainer>
  );
}
