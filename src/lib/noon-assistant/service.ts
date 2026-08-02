/**
 * noon-assistant/service.ts — the Noon Report Assistant service
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Deterministic console over the noon-report snapshot. Every handler reports
 * values produced by the noon engine; none are recomputed here. Routing is
 * keyword-driven, identical in spirit to the Voyage Assistant.
 */

import type { NoonReportAnalysis, NoonReportDomain } from "@/lib/noon-report";
import type {
  NoonAnswer,
  NoonAssistantState,
  NoonContext,
  NoonMemoryEntry,
  NoonReportSnapshot,
  NoonRequest,
  NoonVessel,
} from "./types";
import type { NoonToolRegistry } from "./tools";
import { NoonVesselScopeError } from "./tools";
import { NOON_MOCK_NOW } from "./mock-data";
import type { NoonHandoffDetector } from "./handoff";
import type { NoonSafetyGuard } from "./safety";
import type { NoonMemory } from "./memory";

export interface NoonServiceOptions {
  readonly state: NoonAssistantState;
  readonly registry: NoonToolRegistry;
  readonly handoffDetector: NoonHandoffDetector;
  readonly safetyGuard: NoonSafetyGuard;
  readonly memory: NoonMemory;
  readonly context: NoonContext;
  readonly promptVersion?: string;
}

export interface NoonService {
  answer(req: NoonRequest): NoonAnswer;
  latestReport(req: NoonRequest): NoonAnswer;
  analysis(req: NoonRequest): NoonAnswer;
  findings(req: NoonRequest): NoonAnswer;
  fuel(req: NoonRequest): NoonAnswer;
  voyage(req: NoonRequest): NoonAnswer;
  fueleu(req: NoonRequest): NoonAnswer;
  ets(req: NoonRequest): NoonAnswer;
  operationalState(req: NoonRequest): NoonAnswer;
  deviations(req: NoonRequest): NoonAnswer;
  history(req: NoonRequest): NoonAnswer;
  explain(req: NoonRequest): NoonAnswer;
  recall(req: NoonRequest): NoonAnswer;
}

function formatState(vessel: NoonVessel): string {
  return `${vessel.name} (IMO ${vessel.imo})`;
}

function formatOperationalState(state: string): string {
  switch (state) {
    case "AT_SEA":
      return "AT SEA";
    case "IN_PORT":
      return "IN PORT";
    case "WAITING":
      return "WAITING";
    case "UNKNOWN":
      return "UNKNOWN";
    default:
      return state;
  }
}

function formatLat(lat: number | null): string {
  if (lat === null) return "lat n/a";
  return `lat ${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? "N" : "S"}`;
}

function formatLng(lng: number | null): string {
  if (lng === null) return "lon n/a";
  return `lon ${Math.abs(lng).toFixed(3)}° ${lng >= 0 ? "E" : "W"}`;
}

function formatPct(value: number | null, suffix = "%"): string {
  if (value === null) return "n/a";
  return `${value.toFixed(2)}${suffix}`;
}

export function createNoonService(opts: NoonServiceOptions): NoonService {
  const state = opts.state;
  const now = opts.context.now ?? NOON_MOCK_NOW;

  function rememberSummary(req: NoonRequest, text: string): void {
    opts.memory.remember(req.context.vessel.vesselId, "last-answer", text);
  }

  function latestSnapshot(req: NoonRequest): NoonReportSnapshot | null {
    return opts.registry.getLatest({ context: req.context, state }).data;
  }

  function latestReport(req: NoonRequest): NoonAnswer {
    const snapshot = latestSnapshot(req);
    if (!snapshot) {
      return { text: `No noon report is on file for ${state.vessel.name} yet.`, snapshot: null };
    }
    const r = snapshot.report;
    const a = snapshot.analysis;
    const consumption =
      a.consumption.rateTonnesPerDay === null
        ? "consumption not computed (interval or total missing)"
        : `${a.consumption.rateTonnesPerDay.toFixed(2)} t/24h`;
    const text = [
      `LATEST NOON REPORT — ${formatState(state.vessel)}`,
      `Report date: ${r.reportDate.slice(0, 10)} · operational state ${formatOperationalState(a.operationalState)}`,
      `Position: ${formatLat(r.positionLatitude)} ${formatLng(r.positionLongitude)} · speed ${r.speedKnots ?? "n/a"} kn · rpm ${r.engineRpm ?? "n/a"}`,
      `Consumption: ${consumption} · ROB ${r.fuelRobsTonnes ?? "n/a"} t`,
      `Confidence: ${Math.round(r.confidence * 100)}% · source ${r.source}`,
    ].join("\n");
    rememberSummary(req, `latest noon: ${a.operationalState}, ${consumption}`);
    return { text, snapshot, report: r, analysis: a };
  }

  function analysis(req: NoonRequest): NoonAnswer {
    const tool = opts.registry.getAnalysis({ context: req.context, state });
    const a = tool.data;
    if (!a) {
      return { text: `No noon analysis is on file for ${state.vessel.name}.`, analysis: null };
    }
    const consumption = a.consumption;
    const lines = [
      `NOON ANALYSIS — ${formatState(state.vessel)}`,
      `Operational state: ${formatOperationalState(a.operationalState)}`,
      `Consumption: ${consumption.totalTonnes ?? "n/a"} t reported · ${consumption.rateTonnesPerDay === null ? "rate n/a" : `${consumption.rateTonnesPerDay.toFixed(2)} t/24h`}${consumption.trendPct === null ? "" : ` · trend ${formatPct(consumption.trendPct)}`}`,
      `Engine: rpm ${a.engine.rpm ?? "n/a"} · load ${formatPct(a.engine.loadPct)} of design${a.engine.atDesign === null ? "" : ` · ${a.engine.atDesign ? "at" : "off"} design`}`,
      `Slip: ${a.slip.slipPct === null ? "n/a" : `${a.slip.slipPct.toFixed(2)}%`} (theoretical ${a.slip.theoreticalSpeedKnots === null ? "n/a" : `${a.slip.theoreticalSpeedKnots.toFixed(2)} kn`}, actual ${a.slip.actualSpeedKnots === null ? "n/a" : `${a.slip.actualSpeedKnots.toFixed(2)} kn`})`,
      `Speed: ${a.speed.speedKnots ?? "n/a"} kn${a.speed.slowSteaming === null ? "" : ` · ${a.speed.slowSteaming ? "slow steaming" : "not slow steaming"}`}`,
      `Weather: ${a.weather.seaState ?? "n/a"} · wind ${a.weather.windSpeedKnots ?? "n/a"} kn${a.weather.significant === null ? "" : ` · ${a.weather.significant ? "significant" : "not significant"}`}`,
      `Voyage: made good ${a.voyage.distanceMadeGoodNm === null ? "n/a" : `${a.voyage.distanceMadeGoodNm.toFixed(2)} nm`} at ${a.voyage.speedMadeGoodKnots === null ? "n/a" : `${a.voyage.speedMadeGoodKnots.toFixed(2)} kn`} · progress ${formatPct(a.distance.progressPct)}`,
      `Deviations: ${a.deviations.length} on file`,
      `Engine version: ${a.engineVersion}`,
    ];
    rememberSummary(req, `noon analysis: ${a.operationalState}, slip ${a.slip.slipPct?.toFixed(2) ?? "n/a"}%`);
    return { text: lines.join("\n"), analysis: a };
  }

  function findings(req: NoonRequest): NoonAnswer {
    const tool = opts.registry.getFindings({ context: req.context, state });
    const findingsList = tool.data;
    const snapshot = latestSnapshot(req);
    const validator = snapshot?.validator ?? null;
    if (findingsList.length === 0) {
      return {
        text: `No findings are on file for the latest noon report of ${state.vessel.name}.${validator ? ` Validation ${validator.status} at score ${validator.score}.` : ""}`,
        findings: [],
      };
    }
    const lines = findingsList.map(
      (f) =>
        `- [${f.severity} · ${f.category}] ${f.reason}${f.remediation ? `\n     Remediation: ${f.remediation}` : ""}`,
    );
    const header = validator
      ? `Validation ${validator.status} at score ${validator.score}${validator.blocked ? " (blocked)" : ""}.`
      : "";
    const text = [
      `NOON FINDINGS — ${formatState(state.vessel)}`,
      header,
      lines.join("\n"),
    ].join("\n\n");
    rememberSummary(req, `noon findings: ${findingsList.length} on file`);
    return { text, findings: findingsList };
  }

  function fuel(req: NoonRequest): NoonAnswer {
    const tool = opts.registry.getFuel({ context: req.context, state });
    const f = tool.data;
    if (!f) {
      return { text: `No fuel correlation is on file for ${state.vessel.name}.`, fuel: null };
    }
    const lines = [
      `FUEL CORRELATION — ${formatState(state.vessel)}`,
      `Delivery consistency: ${f.deliveryState}${f.deliveryDiscrepancyPct === null ? "" : ` (${formatPct(f.deliveryDiscrepancyPct)})`}`,
      `ROB consistency: ${f.robState}${f.robDiscrepancyPct === null ? "" : ` (${formatPct(f.robDiscrepancyPct)})`}`,
      `Attribution: ${f.attributionResolved ? `${f.attribution.length} fuel type(s) resolved` : "not resolved"}`,
    ];
    rememberSummary(req, `fuel correlation: ${f.deliveryState}, ${f.robState}`);
    return { text: lines.join("\n"), fuel: f };
  }

  function voyage(req: NoonRequest): NoonAnswer {
    const tool = opts.registry.getVoyage({ context: req.context, state });
    const v = tool.data;
    if (!v) {
      return { text: `No voyage correlation is on file for ${state.vessel.name}.`, voyage: null };
    }
    const schedule =
      v.state === "INSUFFICIENT_DATA"
        ? "the voyage plan is not on file"
        : `${v.state} (${v.lateHours === null ? "no ETA variance" : `${v.lateHours > 0 ? "+" : ""}${v.lateHours.toFixed(1)} h vs plan`})`;
    const lines = [
      `VOYAGE CORRELATION — ${formatState(state.vessel)}`,
      `Schedule posture: ${schedule}`,
      `Progress: ${formatPct(v.progressPct)} of the planned distance (made good ${v.distanceMadeGoodNm === null ? "n/a" : `${v.distanceMadeGoodNm.toFixed(2)} nm`})`,
      `Speed made good: ${v.speedMadeGoodKnots === null ? "n/a" : `${v.speedMadeGoodKnots.toFixed(2)} kn`} vs planned ${v.plannedSpeedKnots ?? "n/a"} kn`,
      `Predicted arrival: ${v.predictedArrival ? `${v.predictedArrival.slice(0, 16)}Z` : "n/a"} (planned ${v.plannedArrival ? `${v.plannedArrival.slice(0, 16)}Z` : "n/a"})`,
    ];
    rememberSummary(req, `voyage correlation: ${v.state}`);
    return { text: lines.join("\n"), voyage: v };
  }

  function fueleu(req: NoonRequest): NoonAnswer {
    const tool = opts.registry.getFuelEu({ context: req.context, state });
    const f = tool.data;
    if (!f) {
      return { text: `No FuelEU operational input is on file for ${state.vessel.name}.`, fueleu: null };
    }
    const rows = f.energyMeters
      .map(
        (m) =>
          `- ${m.fuelType}: ${m.tonnes} t → ${m.energyMj === null ? "energy n/a" : `${m.energyMj.toFixed(1)} MJ`}${m.resolved ? "" : " (unresolved)"}`,
      )
      .join("\n");
    return {
      text: [
        `FUEL-EU OPERATIONAL INPUT — ${formatState(state.vessel)} · year ${f.reportingYear}`,
        `${f.reportCount} report(s) · ${f.daysCovered ?? "n/a"} day(s) covered · ${f.totalTonnes.toFixed(2)} t total`,
        rows,
        `Total energy: ${f.totalEnergyMj === null ? "n/a" : `${f.totalEnergyMj.toFixed(1)} MJ`} · data available: ${f.dataAvailable ? "yes" : "no"}`,
        "These are operational inputs for the FuelEU engine; I do not interpret the compliance position.",
      ].join("\n"),
      fueleu: f,
    };
  }

  function ets(req: NoonRequest): NoonAnswer {
    const tool = opts.registry.getEts({ context: req.context, state });
    const e = tool.data;
    if (!e) {
      return { text: `No EU ETS operational input is on file for ${state.vessel.name}.`, ets: null };
    }
    const rows = e.emissions
      .map(
        (m) =>
          `- ${m.fuelType}: ${m.tonnes} t → ${m.co2Tonnes === null ? "CO2 n/a" : `${m.co2Tonnes.toFixed(2)} t CO2`}${m.resolved ? "" : " (unresolved)"}`,
      )
      .join("\n");
    return {
      text: [
        `EU ETS OPERATIONAL INPUT — ${formatState(state.vessel)} · year ${e.reportingYear}`,
        `${e.reportCount} report(s) · ${e.daysCovered ?? "n/a"} day(s) covered · ${e.totalTonnes.toFixed(2)} t total`,
        rows,
        `Total CO2: ${e.totalCo2Tonnes === null ? "n/a" : `${e.totalCo2Tonnes.toFixed(2)} t`} · data available: ${e.dataAvailable ? "yes" : "no"}`,
        "These are operational inputs for the EU ETS engine; I do not interpret the compliance position.",
      ].join("\n"),
      ets: e,
    };
  }

  function operationalState(req: NoonRequest): NoonAnswer {
    const tool = opts.registry.getOperationalState({ context: req.context, state });
    if (!tool.data) {
      return { text: `No noon report is on file for ${state.vessel.name}.` };
    }
    const snapshot = latestSnapshot(req);
    const a = snapshot?.analysis ?? null;
    const detail = a
      ? a.waiting && a.waiting.stationary
        ? a.port && a.port.inPort
          ? "The report shows the vessel alongside (distance to go 5 nm or less)."
          : "The report shows the vessel stationary at sea."
        : "The report shows the vessel under way."
      : "";
    return {
      text: `The latest noon report for ${state.vessel.name} is ${formatOperationalState(tool.data)}. ${detail}`.trim(),
      analysis: a,
    };
  }

  function deviations(req: NoonRequest): NoonAnswer {
    const tool = opts.registry.getDeviations({ context: req.context, state });
    const list = tool.data;
    if (list.length === 0) {
      return { text: `No voyage deviations are on file for the latest noon report of ${state.vessel.name}.`, analysis: latestSnapshot(req)?.analysis ?? null };
    }
    const lines = list.map(
      (d) => `- [${d.kind} · ${d.severity}] ${d.reason} (actual ${d.actual ?? "n/a"} vs expected ${d.expected ?? "n/a"})`,
    );
    return {
      text: `DEVIATIONS — ${formatState(state.vessel)}\n\n${lines.join("\n")}`,
      analysis: latestSnapshot(req)?.analysis ?? null,
    };
  }

  function history(req: NoonRequest): NoonAnswer {
    const tool = opts.registry.getHistory({ context: req.context, state });
    const reports = tool.data;
    if (reports.length === 0) {
      return { text: `No noon reports are on file for ${state.vessel.name}.`, history: [] };
    }
    const lines = reports.map(
      (r) => `- ${r.reportDate.slice(0, 10)} · ${r.speedKnots ?? "n/a"} kn · ${r.fuelConsumptionTonnes ?? "n/a"} t`,
    );
    return {
      text: `NOON REPORT HISTORY — ${formatState(state.vessel)} · ${reports.length} report(s)\n\n${lines.join("\n")}`,
      history: reports,
    };
  }

  function explain(req: NoonRequest): NoonAnswer {
    const lower = req.query.toLowerCase();
    const snapshot = latestSnapshot(req);
    if (!snapshot) {
      return { text: `No noon report is on file for ${state.vessel.name}, so there is nothing to explain.` };
    }
    const a: NoonReportAnalysis = snapshot.analysis;

    if (/slip/i.test(lower)) {
      const line =
        a.slip.slipPct === null
          ? "Slip is not computed: the theoretical speed (rpm × pitch) or the actual speed is missing from the report."
          : `The apparent slip is ${a.slip.slipPct.toFixed(2)}% (theoretical ${a.slip.theoreticalSpeedKnots?.toFixed(2) ?? "n/a"} kn vs actual ${a.slip.actualSpeedKnots?.toFixed(2) ?? "n/a"} kn). I read this from the deterministic engine; it is a stored engine-performance figure.`;
      return { text: line, analysis: a };
    }

    if (/operational state|at sea|waiting|in port|alongside|anchored/i.test(lower)) {
      return operationalState(req);
    }

    if (/consumption|fuel use|burning|burned/i.test(lower)) {
      const c = a.consumption;
      const trend = c.trendPct === null ? "" : ` Trend vs the previous report: ${formatPct(c.trendPct)}.`;
      const line = [
        `The latest report consumed ${c.totalTonnes ?? "n/a"} t over ${c.intervalDays ?? "n/a"} day(s), a rate of ${c.rateTonnesPerDay === null ? "n/a" : `${c.rateTonnesPerDay.toFixed(2)} t/24h`}.`,
        trend,
        "I read this rate from the stored report interval; I do not project it forward.",
      ].join("\n");
      rememberSummary(req, `consumption rate ${c.rateTonnesPerDay?.toFixed(2) ?? "n/a"} t/24h`);
      return { text: line, analysis: a };
    }

    if (/weather|wind|sea state/i.test(lower)) {
      const line = `Sea state ${a.weather.seaState ?? "n/a"} · wind ${a.weather.windSpeedKnots ?? "n/a"} kn from ${a.weather.windDirection ?? "n/a"}. ${a.weather.significant === null ? "" : a.weather.significant ? "The wind is significant (28 kn or more)." : "The wind is not significant."}`;
      return { text: line, analysis: a };
    }

    if (/confidence|data quality|garbled|reject/i.test(lower)) {
      const r: NoonReportDomain = snapshot.report;
      const lines = [
        `The report carries a data confidence of ${Math.round(r.confidence * 100)}%.`,
        r.warnings.length === 0
          ? "No parser warnings were recorded."
          : `Parser warnings: ${r.warnings.join("; ")}`,
        r.confidence < 0.6
          ? "The report is below the review threshold and must be checked before it can be used."
          : "The report is above the review threshold.",
      ];
      return { text: lines.join("\n"), analysis: a };
    }

    if (/voyage|eta|arrival|schedule|late/i.test(lower)) {
      const v = snapshot.voyage;
      if (!v) return { text: "No voyage correlation is on file." };
      const line =
        v.state === "INSUFFICIENT_DATA"
          ? "The voyage plan is not on file, so no schedule posture is computed."
          : `The voyage is ${v.state}${v.lateHours === null ? "" : ` (${v.lateHours > 0 ? "+" : ""}${v.lateHours.toFixed(1)} h vs plan)`}. Predicted arrival ${v.predictedArrival ? `${v.predictedArrival.slice(0, 16)}Z` : "n/a"}.`;
      return { text: line, analysis: a, voyage: v };
    }

    if (/fuel.*(correlat|attribut)|deliver.*(consist|discrepan)|rob/i.test(lower)) {
      return fuel(req);
    }

    if (/fueleu|eu fuel|lhv|energy/i.test(lower)) {
      return fueleu(req);
    }

    if (/ets|co2|emission factor/i.test(lower)) {
      return ets(req);
    }

    if (/finding|warning|deviation|flagged|remediation/i.test(lower)) {
      return findings(req);
    }

    return {
      text: `I can explain the deterministic values on the latest noon report for ${state.vessel.name}: slip, consumption, weather, operational state, voyage schedule posture, and any findings. Try "Why is the slip 4.89%?" or "Explain the consumption rate."`,
    };
  }

  function recall(req: NoonRequest): NoonAnswer {
    const entries = opts.memory.list(req.context.vessel.vesselId);
    if (entries.length === 0) {
      return {
        text: "I have no remembered context for this vessel yet. My memory is context only and never overrides the deterministic analysis.",
        memory: [],
      };
    }
    const lines = entries.map((e: NoonMemoryEntry) => `- ${e.key}: ${e.value} (recorded ${e.updatedAt.slice(0, 10)})`);
    return {
      text: `Remembered context for ${state.vessel.name}:\n${lines.join("\n")}\n(This is context, not authority.)`,
      memory: entries,
    };
  }

  function handleQuery(req: NoonRequest): NoonAnswer {
    const lower = req.query.toLowerCase();

    if (/memory|remember|recall|what do you know about me/i.test(lower)) {
      return recall(req);
    }

    if (/history|past reports|previous reports|all reports/i.test(lower)) {
      return history(req);
    }

    if (/why|explain/i.test(lower)) {
      return explain(req);
    }

    if (/deviation|variance|off the plan/i.test(lower)) {
      return deviations(req);
    }

    if (/operational state|at sea|waiting|in port|alongside|anchored|where are we/i.test(lower)) {
      return operationalState(req);
    }

    if (/voyage|eta|arrival|schedule|behind|ahead/i.test(lower)) {
      return voyage(req);
    }

    if (/fuel|fueleu|lhv|rob|remaining on board/i.test(lower)) {
      return /fueleu|lhv|energy/i.test(lower) ? fueleu(req) : fuel(req);
    }

    if (/ets|co2|emission/i.test(lower)) {
      return ets(req);
    }

    if (/weather|wind|sea state/i.test(lower)) {
      return analysis(req);
    }

    if (/finding|warning|flagged|blocked|review/i.test(lower)) {
      return findings(req);
    }

    if (/slip|engine|rpm|speed|performance/i.test(lower)) {
      return analysis(req);
    }

    if (/latest|most recent|current report|how are we doing|status of/i.test(lower)) {
      return latestReport(req);
    }

    if (/analysis|performance|latest report|report/i.test(lower)) {
      return analysis(req);
    }

    return {
      text: `I can help with the noon-report intelligence for ${state.vessel.name}: the latest report, deterministic analysis (consumption, slip, speed, weather), findings, fuel/voyage/FuelEU/EU-ETS correlations, and deviations. Try "What is the latest noon report?", "Are there any findings?", or "Why is slip 4.89%?"`,
    };
  }

  function answer(req: NoonRequest): NoonAnswer {
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
      if (err instanceof NoonVesselScopeError) {
        return {
          text: "I can only answer for your assigned vessel. I cannot access another vessel's noon-report data.",
        };
      }
      throw err;
    }
  }

  return {
    answer,
    latestReport,
    analysis,
    findings,
    fuel,
    voyage,
    fueleu,
    ets,
    operationalState,
    deviations,
    history,
    explain,
    recall,
  };
}
