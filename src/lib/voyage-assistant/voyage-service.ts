import type {
  AisGap,
  VoyageAnswer,
  VoyageContext,
  VoyageRecord,
  VoyageRequest,
} from "./types";
import { summarizeGaps } from "./gap-ladder";
import type { VoyageToolRegistry } from "./voyage-tools";
import { VoyageVesselScopeError } from "./voyage-tools";
import type { VoyageMockState } from "./mock-data";
import { VOYAGE_MOCK_NOW } from "./mock-data";
import type { VoyageHandoffDetector } from "./handoff";
import type { VoyageSafetyGuard } from "./safety";
import type { VoyageMemory } from "./memory";

export interface VoyageServiceOptions {
  readonly state: VoyageMockState;
  readonly registry: VoyageToolRegistry;
  readonly handoffDetector: VoyageHandoffDetector;
  readonly safetyGuard: VoyageSafetyGuard;
  readonly memory: VoyageMemory;
  readonly context: VoyageContext;
  readonly promptVersion?: string;
}

export interface VoyageService {
  answer(req: VoyageRequest): VoyageAnswer;
  voyageLog(req: VoyageRequest): VoyageAnswer;
  aisPositions(req: VoyageRequest): VoyageAnswer;
  dataGaps(req: VoyageRequest): VoyageAnswer;
  portInfo(req: VoyageRequest): VoyageAnswer;
  violations(req: VoyageRequest): VoyageAnswer;
  greenZones(req: VoyageRequest): VoyageAnswer;
  complianceContext(req: VoyageRequest): VoyageAnswer;
  explain(req: VoyageRequest): VoyageAnswer;
  draftManualVoyage(req: VoyageRequest): VoyageAnswer;
  queueAisSync(req: VoyageRequest): VoyageAnswer;
  recall(req: VoyageRequest): VoyageAnswer;
}

function formatVoyageRecord(v: VoyageRecord): string {
  const distance = v.distanceNm === null ? "distance not on file" : `${v.distanceNm} nm (stored)`;
  const coverage = v.etsCoverageRate === null ? "ETS coverage not on file" : `${v.etsCoverageRate}% ETS coverage (stored)`;
  return [
    `- ${v.voyageNumber} · ${v.departurePort.name} (${v.departurePort.locode}) → ${v.arrivalPort.name} (${v.arrivalPort.locode})`,
    `     ${v.departureTs.slice(0, 10)} → ${v.arrivalTs.slice(0, 10)} · ${v.classification} · ${distance} · ${coverage} · quality ${v.dataQuality}`,
    `     Source: ${v.source}`,
  ].join("\n");
}

export function createVoyageService(opts: VoyageServiceOptions): VoyageService {
  const state = opts.state;
  const now = opts.context.now ?? VOYAGE_MOCK_NOW;

  function rememberSummary(req: VoyageRequest, text: string): void {
    opts.memory.remember(req.context.vessel.vesselId, "last-answer", text);
  }

  function primaryVoyage(req: VoyageRequest): VoyageRecord | null {
    const voyageIdMatch = req.query.match(/voy-[a-z0-9-]+/);
    const tool = opts.registry.getVoyageLog({ context: req.context, state });
    const data =
      voyageIdMatch && tool.data.some((v) => v.id === voyageIdMatch[0])
        ? tool.data.filter((v) => v.id === voyageIdMatch[0])
        : tool.data;
    return data[0] ?? tool.data[0] ?? null;
  }

  function voyageLog(req: VoyageRequest): VoyageAnswer {
    const tool = opts.registry.getVoyageLog({ context: req.context, state });
    if (tool.data.length === 0) {
      return { text: "No voyage records are on file for this vessel.", voyage: null };
    }
    const lines = tool.data.map(formatVoyageRecord);
    const text = `VOYAGE LEDGER — ${state.vessel.name} (IMO ${state.vessel.imo})\n\n${lines.join("\n")}`;
    rememberSummary(req, `voyage ledger: ${tool.data.map((v) => v.voyageNumber).join(", ")}`);
    return { text, voyage: tool.data[0] };
  }

  function aisPositions(req: VoyageRequest): VoyageAnswer {
    const tool = opts.registry.getAisPositions({ context: req.context, state });
    if (tool.data.length === 0) {
      return { text: "No AIS positions are on file for this vessel.", positions: [] };
    }
    const lines = tool.data.map(
      (p) => `- ${p.ts} · ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)} · ${p.speedKnots ?? "n/a"} kn · ${p.source}`,
    );
    const text = `AIS POSITIONS — ${state.vessel.name} (IMO ${state.vessel.imo}) · ${tool.data.length} stored positions (confidence: stored source, no synthesis)\n\n${lines.join("\n")}`;
    return { text, positions: tool.data };
  }

  function dataGaps(req: VoyageRequest): VoyageAnswer {
    const tool = opts.registry.getDataGaps({ context: req.context, state });
    const primary = primaryVoyage(req);
    const gaps = tool.data.length > 0 ? tool.data : state.gaps.filter((g) => g.voyageId === primary?.id);
    const referenceFrom = primary?.departureTs ?? now;
    const referenceTo = primary?.arrivalTs ?? now;
    const summary = summarizeGaps(gaps, referenceFrom, referenceTo);
    if (summary.totalGaps === 0) {
      return {
        text: `AIS DATA GAPS — ${state.vessel.name} (IMO ${state.vessel.imo})\n\nNo AIS data gaps are on file for ${primary?.voyageNumber ?? "the primary voyage"}. Coverage is 100% of the stored period.`,
        gaps: [],
        gapSummary: summary,
      };
    }
    const lines = gaps.map(
      (g) =>
        `- [${g.tier}] ${g.durationMinutes} minutes · ${g.from.slice(0, 16)} → ${g.to.slice(0, 16)}${g.escalation ? " · ESCALATION" : ""}`,
    );
    const text = [
      `AIS DATA GAPS — ${state.vessel.name} (IMO ${state.vessel.imo})`,
      `${summary.totalGaps} gap(s) · worst tier ${summary.worstTier} · ${summary.coveragePct}% coverage of the stored period`,
      lines.join("\n"),
      `Ladder: ${summarizeLadderHints(summary.worstTier)}`,
    ].join("\n\n");
    rememberSummary(req, `gap posture: ${summary.worstTier} at ${summary.coveragePct}% coverage`);
    return { text, gaps, gapSummary: summary };
  }

  function portInfo(req: VoyageRequest): VoyageAnswer {
    const tool = opts.registry.getPortInfo({ context: req.context, state });
    if (tool.data.length === 0) {
      return { text: "No port calls are on file for this vessel.", ports: [] };
    }
    const lines = tool.data.map((p) => {
      const greenTag = p.greenZone ? " · GREEN ZONE PORT" : "";
      const window = p.arrTs ? `arr ${p.arrTs.slice(0, 10)}` : `dep ${p.depTs?.slice(0, 10)}`;
      return `- ${p.portName} (${p.locode}) · ${p.country} · ${window}${greenTag}`;
    });
    const text = `PORT CALLS — ${state.vessel.name} (IMO ${state.vessel.imo})\n\n${lines.join("\n")}`;
    return { text, ports: tool.data };
  }

  function violations(req: VoyageRequest): VoyageAnswer {
    const tool = opts.registry.explainViolation({ context: req.context, state });
    if (tool.data.length === 0) {
      return { text: "No consistency or coverage violations are on file for this vessel.", violations: [] };
    }
    const lines = tool.data.map(
      (v) =>
        `- [${v.code} · ${v.severity}] ${v.title}\n     ${v.description}\n     Rule: ${v.ruleReference}\n     Recommendation: ${v.recommendation}`,
    );
    const text = `VIOLATIONS — ${state.vessel.name} (IMO ${state.vessel.imo})\n\n${lines.join("\n")}`;
    return { text, violations: tool.data };
  }

  function greenZones(req: VoyageRequest): VoyageAnswer {
    const encounters = state.greenZoneEncounters;
    if (encounters.length === 0) {
      return { text: "No protected marine area or Green Zone encounters are on file for this vessel.", greenZoneEncounters: [] };
    }
    const lines = encounters.map(
      (g) =>
        `- ${g.zoneName} (${g.zoneCategory}) · ${g.enteredAt.slice(0, 10)} · ${g.durationMinutes ?? "n/a"} min · ${g.actionRequired}`,
    );
    const text = `GREEN ZONE ENCOUNTERS — ${state.vessel.name} (IMO ${state.vessel.imo})\n\n${lines.join("\n")}`;
    return { text, greenZoneEncounters: encounters };
  }

  function complianceContext(req: VoyageRequest): VoyageAnswer {
    const tool = opts.registry.getComplianceContext({ context: req.context, state });
    if (!tool.data) {
      return { text: "No voyage compliance context is on file for this vessel.", complianceContext: null };
    }
    const ctx = tool.data;
    const coverage =
      ctx.etsCoverageRate === null
        ? "ETS coverage is not on file."
        : `ETS coverage of ${ctx.etsCoverageRate}% is stored on voyage record ${ctx.voyage.voyageNumber}.`;
    const classification = `The stored classification is ${ctx.classification}.`;
    const items =
      ctx.actionableItems.length === 0
        ? "No actionable items are stored for this voyage."
        : ctx.actionableItems.map((a) => `- [${a.severity}] ${a.label}`).join("\n");
    const text = [
      `VOYAGE COMPLIANCE CONTEXT — ${state.vessel.name} (IMO ${state.vessel.imo})`,
      `Voyage ${ctx.voyage.voyageNumber}: ${ctx.voyage.departurePort.name} → ${ctx.voyage.arrivalPort.name} (${ctx.voyage.departureTs.slice(0, 10)} → ${ctx.voyage.arrivalTs.slice(0, 10)})`,
      coverage,
      classification,
      `Actionable items:\n${items}`,
      "I report stored values only. For what this means for your compliance position, ask the Compliance Assistant.",
    ].join("\n\n");
    return { text, complianceContext: ctx };
  }

  function explain(req: VoyageRequest): VoyageAnswer {
    const lower = req.query.toLowerCase();
    const primary = primaryVoyage(req);

    if (/gap|interrupt|ladder/i.test(lower)) {
      const tool = opts.registry.getDataGaps({ context: req.context, state });
      const target = primary
        ? tool.data.find((g) => g.voyageId === primary.id) ?? tool.data[0] ?? null
        : tool.data[0] ?? null;
      if (!target) {
        return { text: `No AIS data gap is on file for ${primary?.voyageNumber ?? "the primary voyage"}, so there is nothing to explain.` };
      }
      const voyageLabel = primary ? `on ${primary.voyageNumber}` : "on the voyage record";
      return {
        text: [
          `The AIS data gap ${voyageLabel} is ${target.durationMinutes} minutes (${target.from.slice(0, 16)} → ${target.to.slice(0, 16)}).`,
          `Tier (stored): ${target.tier}.`,
          `Action required: ${target.actionRequired}`,
          `Source: ${target.notes ?? "gap ladder classification of the stored gap window"}`,
        ].join("\n\n"),
        gaps: [target],
      };
    }

    if (/ets|coverage/i.test(lower)) {
      const ctx = opts.registry.getComplianceContext({ context: req.context, state });
      if (!ctx.data) {
        return { text: "No voyage compliance context is on file for this vessel." };
      }
      const value = ctx.data.etsCoverageRate;
      const coverageLine =
        value === null
          ? "ETS coverage is not on file for this voyage."
          : `ETS coverage of ${value}% is stored on voyage record ${ctx.data.voyage.voyageNumber}; I read this value, I do not compute it from ports.`;
      return {
        text: [
          coverageLine,
          `Stored classification: ${ctx.data.classification}.`,
          "For what this coverage means for your ETS position, ask the Compliance Assistant.",
        ].join("\n\n"),
        complianceContext: ctx.data,
      };
    }

    if (/classific/i.test(lower)) {
      if (!primary) {
        return { text: "No voyage record is on file for this vessel." };
      }
      return {
        text: `The stored classification for ${primary.voyageNumber} (${primary.departurePort.name} → ${primary.arrivalPort.name}) is ${primary.classification}.`,
        voyage: primary,
      };
    }

    if (/distance|nm/i.test(lower)) {
      if (!primary) {
        return { text: "No voyage record is on file for this vessel." };
      }
      const distance = primary.distanceNm;
      const line =
        distance === null
          ? `No distance is on file for ${primary.voyageNumber}.`
          : `${primary.voyageNumber} has a stored distance of ${distance} nm; I read this from the voyage record and do not recompute it from AIS coordinates.`;
      return { text: line, voyage: primary };
    }

    if (/violation|vcr|inconsisten|discrepanc/i.test(lower)) {
      const tool = opts.registry.explainViolation({ context: req.context, state });
      if (tool.data.length === 0) {
        return { text: "No violations are on file for this voyage to explain." };
      }
      const v = tool.data[0]!;
      return {
        text: [
          `[${v.code}] ${v.title}`,
          v.description,
          `Rule reference: ${v.ruleReference}`,
          `Recommendation: ${v.recommendation}`,
        ].join("\n\n"),
        violations: tool.data,
      };
    }

    return {
      text: `I can explain stored voyage facts for ${state.vessel.name}: the gap tier, the stored ETS coverage rate, the stored classification, the stored distance, and stored violations. Try "Why is ETS coverage 50%?" or "What tier is the AIS gap?"`,
    };
  }

  function draftManualVoyage(req: VoyageRequest): VoyageAnswer {
    const primary = primaryVoyage(req);
    if (!primary) {
      return { text: "No voyage record is on file for this vessel, so no manual draft can be created.", manualDraft: null };
    }
    const confirmed = /confirm|go ahead|yes.*proceed|approve|submit/i.test(req.query);
    const reasonMatch = req.query.match(/because (.+)|reason[: ](.+)/i);
    const reason = reasonMatch ? (reasonMatch[1] ?? reasonMatch[2] ?? "").trim() : undefined;
    const tool = opts.registry.draftManualVoyage(
      { context: req.context, state },
      { voyageId: primary.id, confirm: confirmed, reason },
    );
    if (!tool.data) {
      return {
        text: `A manual voyage draft is not required for ${primary.voyageNumber}: the stored gap posture does not sit on the MANUAL_REQUIRED or CRITICAL_ESCALATION tier. The AIS gap ladder only requires a draft from 6h upward.`,
        manualDraft: null,
      };
    }
    const draft = tool.data;
    const statusLine =
      draft.status === "CONFIRMED"
        ? "The manual voyage draft is CONFIRMED on the ledger."
        : "The manual voyage draft is in DRAFT. Confirm it before it can substantiate the covered segment.";
    return {
      text: [
        `MANUAL VOYAGE DRAFT — ${state.vessel.name} (IMO ${state.vessel.imo})`,
        `Voyage ${draft.voyageId} · ${draft.departurePort.name} → ${draft.arrivalPort.name} · ${draft.departureTs.slice(0, 10)} → ${draft.arrivalTs.slice(0, 10)}`,
        draft.distanceNm === null ? "Distance: not on file" : `Distance: ${draft.distanceNm} nm (stored)`,
        `Reason: ${draft.reason}`,
        `Supporting evidence: ${draft.supportingEvidence}`,
        `Verifier defensibility: ${draft.verifierDefensibility}`,
        `Status: ${draft.status}`,
        statusLine,
      ].join("\n\n"),
      manualDraft: draft,
    };
  }

  function queueAisSync(req: VoyageRequest): VoyageAnswer {
    const primary = primaryVoyage(req);
    if (!primary) {
      return { text: "No voyage record is on file for this vessel, so no AIS backfill can be queued.", aisSync: null };
    }
    const confirmed = /confirm|go ahead|yes.*proceed|approve|submit/i.test(req.query);
    const tool = opts.registry.queueAisSync(
      { context: req.context, state },
      { voyageId: primary.id, confirm: confirmed },
    );
    if (!tool.data) {
      return {
        text: `No AIS backfill is required for ${primary.voyageNumber}: the stored gap posture is below the FLAGGED tier, so no sync is warranted.`,
        aisSync: null,
      };
    }
    const sync = tool.data;
    const statusLine =
      sync.status === "CONFIRMED"
        ? "The AIS backfill request is CONFIRMED."
        : "The AIS backfill request is in DRAFT. Confirm it to queue the sync.";
    return {
      text: [
        `AIS BACKFILL REQUEST — ${state.vessel.name} (IMO ${state.vessel.imo})`,
        `Voyage ${sync.voyageId} · window ${sync.from.slice(0, 16)} → ${sync.to.slice(0, 16)}`,
        `Reason: ${sync.reason}`,
        `Status: ${sync.status}`,
        statusLine,
        "A backfill restores stored positions only from source providers; it never fabricates positions.",
      ].join("\n\n"),
      aisSync: sync,
    };
  }

  function recall(req: VoyageRequest): VoyageAnswer {
    const entries = opts.memory.list(req.context.vessel.vesselId);
    if (entries.length === 0) {
      return {
        text: "I have no remembered context for this vessel yet. My memory is context only and never overrides the deterministic data.",
        memory: [],
      };
    }
    const lines = entries.map((e) => `- ${e.key}: ${e.value} (recorded ${e.updatedAt.slice(0, 10)})`);
    return {
      text: `Remembered context for ${state.vessel.name}:\n${lines.join("\n")}\n(This is context, not authority.)`,
      memory: entries,
    };
  }

  function handleQuery(req: VoyageRequest): VoyageAnswer {
    const lower = req.query.toLowerCase();

    if (/memory|remember|recall|what do you know about me/i.test(lower)) {
      return recall(req);
    }

    if (/manual.*(draft|voyage)|draft.*(manual|voyage)|backfill.*(voyage|record)|record.*(voyage|draft)|substantiate/i.test(lower)) {
      return draftManualVoyage(req);
    }

    if (/ais.*(sync|backfill)|backfill.*ais|sync.*(ais|position)/i.test(lower)) {
      return queueAisSync(req);
    }

    if (/gap|ladder|interrupt|signal.*loss|coverage of the stored period/i.test(lower)) {
      return dataGaps(req);
    }

    if (/green zone|greenzone|pssa|seca|protected marine|marine protected/i.test(lower)) {
      return greenZones(req);
    }

    if (/violation|inconsisten|discrepanc|vcr|mismatch/i.test(lower)) {
      return violations(req);
    }

    if (/ets|coverage|classification|complian|obligation|eua|surplus|deficit/i.test(lower)) {
      return complianceContext(req);
    }

    if (/port|locode|stay|berth/i.test(lower)) {
      return portInfo(req);
    }

    if (/position|ais data|track/i.test(lower)) {
      return aisPositions(req);
    }

    if (/voyage|trip|route|sailed|departed|arrived|ledger|voyage number/i.test(lower)) {
      return voyageLog(req);
    }

    if (/why|explain/i.test(lower)) {
      return explain(req);
    }

    return {
      text: `I can help with voyage records, AIS data gaps, port calls, Green Zone encounters, stored ETS coverage facts and consistency violations for ${state.vessel.name}. Try "What does the voyage ledger look like?", "Are there any AIS gaps?", or "Which ports did we visit?"`,
    };
  }

  function answer(req: VoyageRequest): VoyageAnswer {
    const query = (req.query ?? "").trim();
    const context = req.context ?? opts.context;

    const safety = opts.safetyGuard.check(query, context.vessel);
    if (!safety.safe) {
      return { text: safety.reason ?? "Request blocked by safety guard." };
    }

    const handoff = opts.handoffDetector.detect(query);
    if (handoff.handoff) {
      return {
        text: `This looks like a task for the ${handoff.target.charAt(0).toUpperCase() + handoff.target.slice(1)} Assistant. ${handoff.reason}`,
        handoff: { target: handoff.target, confidence: handoff.confidence, reason: handoff.reason },
      };
    }

    try {
      return handleQuery(req);
    } catch (err) {
      if (err instanceof VoyageVesselScopeError) {
        return {
          text: "I can only answer for your assigned vessel. I cannot access another vessel's voyage or AIS data.",
        };
      }
      throw err;
    }
  }

  return {
    answer,
    voyageLog,
    aisPositions,
    dataGaps,
    portInfo,
    violations,
    greenZones,
    complianceContext,
    explain,
    draftManualVoyage,
    queueAisSync,
    recall,
  };
}

function summarizeLadderHints(tier: string): string {
  switch (tier) {
    case "INTERPOLATION_OK":
      return "under 30 minutes — no action";
    case "FLAGGED":
      return "30 minutes to under 6 hours — flagged, no draft required";
    case "MANUAL_REQUIRED":
      return "6 to 48 hours — manual voyage draft required";
    case "CRITICAL_ESCALATION":
      return "over 48 hours — escalation required";
    default:
      return "no gaps on file";
  }
}
