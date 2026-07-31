import type {
  ComplianceImpactStatement,
  MaintenanceAnswer,
  MaintenanceContext,
  MaintenanceRequest,
  SurveyScheduleItem,
} from "./types";
import type {
  MaintenanceToolRegistry,
  MaintenanceToolResult,
} from "./maintenance-tools";
import { MaintenanceVesselScopeError } from "./maintenance-tools";
import type { MaintenanceMockState } from "./mock-data";
import { MAINTENANCE_MOCK_NOW } from "./mock-data";
import type { StatusEngine } from "./status-engine";
import type { MaintenanceHandoffDetector } from "./handoff";
import type { MaintenanceSafetyGuard } from "./safety";
import type { MaintenanceNotificationService } from "./maintenance-notifications";
import type { MaintenanceMemory } from "./memory";

export interface MaintenanceServiceOptions {
  readonly state: MaintenanceMockState;
  readonly registry: MaintenanceToolRegistry;
  readonly statusEngine: StatusEngine;
  readonly handoffDetector: MaintenanceHandoffDetector;
  readonly safetyGuard: MaintenanceSafetyGuard;
  readonly notifications: MaintenanceNotificationService;
  readonly memory: MaintenanceMemory;
  readonly context: MaintenanceContext;
  readonly promptVersion?: string;
}

export interface MaintenanceService {
  answer(req: MaintenanceRequest): MaintenanceAnswer;
  schedule(req: MaintenanceRequest): MaintenanceAnswer;
  certificates(req: MaintenanceRequest): MaintenanceAnswer;
  deadlines(req: MaintenanceRequest): MaintenanceAnswer;
  charterCalendar(req: MaintenanceRequest): MaintenanceAnswer;
  classSociety(req: MaintenanceRequest): MaintenanceAnswer;
  planStatus(req: MaintenanceRequest): MaintenanceAnswer;
  alerts(req: MaintenanceRequest): MaintenanceAnswer;
  explain(req: MaintenanceRequest): MaintenanceAnswer;
  recall(req: MaintenanceRequest): MaintenanceAnswer;
}

function formatSchedule(items: ReadonlyArray<SurveyScheduleItem>): string {
  if (items.length === 0) {
    return "No survey schedule data is on file for this vessel.";
  }
  return items
    .map((s) => {
      const lines = [
        `[${s.status}] ${s.surveyType} survey · due ${s.dueDate.slice(0, 10)}`,
        `     Source: ${s.source}`,
      ];
      if (s.lastCompleted) lines.push(`     Last completed: ${s.lastCompleted.slice(0, 10)}`);
      if (s.notes) lines.push(`     Notes: ${s.notes}`);
      return lines.join("\n");
    })
    .join("\n");
}

export function createMaintenanceService(opts: MaintenanceServiceOptions): MaintenanceService {
  const state = opts.state;
  const now = opts.context.now ?? MAINTENANCE_MOCK_NOW;

  function rememberSummary(req: MaintenanceRequest, text: string): void {
    opts.memory.remember(req.context.vessel.vesselId, "last-answer", text);
  }

  function schedule(req: MaintenanceRequest): MaintenanceAnswer {
    const tool = opts.registry.getSurveySchedule({ context: req.context, state });
    const text = `SURVEY SCHEDULE — ${state.vessel.name} (IMO ${state.vessel.imo})\n\n${formatSchedule(tool.data)}`;
    if (tool.data.length > 0) {
      rememberSummary(req, `survey status: ${tool.data.map((s) => `${s.surveyType}=${s.status}`).join(", ")}`);
    }
    return { text, schedule: tool.data };
  }

  function certificates(req: MaintenanceRequest): MaintenanceAnswer {
    const tool = opts.registry.getCertificates({ context: req.context, state });
    if (tool.data.length === 0) {
      return { text: "No certificate records are on file for this vessel.", certificates: [] };
    }
    const impacts = opts.statusEngine.impactsForCertificates(tool.data);
    const lines = tool.data.map((c) => {
      const expiry = c.expiresAt ? ` · expires ${c.expiresAt.slice(0, 10)}` : "";
      return `- ${c.title} · ${c.status.toLowerCase()}${expiry} · source: ${c.source}`;
    });
    const impactLines = impacts.map((i) => `- [${i.impact}] ${i.claim}`);
    const text = [
      `CERTIFICATES — ${state.vessel.name} (IMO ${state.vessel.imo})`,
      lines.join("\n"),
      impacts.length > 0 ? `Deterministic impacts:\n${impactLines.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    return { text, certificates: tool.data, impacts };
  }

  function deadlines(req: MaintenanceRequest): MaintenanceAnswer {
    const tool = opts.registry.getDeadlines({ context: req.context, state });
    const blockingOnly = /blocking/i.test(req.query);
    const data = blockingOnly ? tool.data.filter((d) => d.blocking) : tool.data;
    if (data.length === 0) {
      return { text: "No deadlines are on file for this vessel.", deadlines: [] };
    }
    const lines = data.map(
      (d) =>
        `- ${d.label} · ${d.dueDate.slice(0, 10)} · ${d.daysRemaining >= 0 ? `${d.daysRemaining}d` : `${Math.abs(d.daysRemaining)}d overdue`} · [${d.status}]${d.blocking ? " · BLOCKING" : ""}`,
    );
    const text = [
      `DEADLINES — ${state.vessel.name} (IMO ${state.vessel.imo})`,
      lines.join("\n"),
      `(computed against reference date ${now.slice(0, 10)})`,
    ].join("\n");
    rememberSummary(req, `deadline summary computed at ${now.slice(0, 10)}`);
    return { text, deadlines: data };
  }

  function charterCalendar(req: MaintenanceRequest): MaintenanceAnswer {
    const tool = opts.registry.getCharterCalendar({ context: req.context, state });
    if (tool.data.length === 0) {
      return { text: "No charter calendar entries are on file for this vessel.", charterCalendar: [] };
    }
    const lines = tool.data.map((e) => {
      const windowTag = e.maintenanceWindow ? " · MAINTENANCE WINDOW" : "";
      return `- ${e.period} (${e.charterType}) · ${e.startDate.slice(0, 10)} to ${e.endDate.slice(0, 10)} · ${e.counterParty} · ports: ${e.portCalls.join(", ")}${windowTag}`;
    });
    const text = `CHARTER CALENDAR — ${state.vessel.name} (IMO ${state.vessel.imo})\n\n${lines.join("\n")}`;
    return { text, charterCalendar: tool.data };
  }

  function classSociety(req: MaintenanceRequest): MaintenanceAnswer {
    const tool = opts.registry.getClassSociety({ context: req.context, state });
    if (!tool.data) {
      return { text: "No class society record is on file for this vessel.", classSociety: null };
    }
    const rec = tool.data;
    const text = rec.known
      ? `CLASS SOCIETY — ${rec.classSociety} · ${rec.classificationStatus}${rec.memberNumber ? ` · member ${rec.memberNumber}` : ""} · source: ${rec.source}`
      : `No class society is on file for this vessel. I cannot assert a classification status and will not assume one.`;
    return { text, classSociety: rec };
  }

  function planStatus(req: MaintenanceRequest): MaintenanceAnswer {
    const tool = opts.registry.getPlanStatus({ context: req.context, state });
    if (!tool.data) {
      return { text: "No monitoring plan review data is on file for this vessel.", planStatus: null };
    }
    const plan = tool.data;
    const text =
      plan.nextReviewDue === null
        ? `Monitoring plan v${plan.planVersion} is on file with no review date. I cannot derive a review status.`
        : `Monitoring plan v${plan.planVersion} · next review due ${plan.nextReviewDue.slice(0, 10)} · [${plan.reviewStatus}] · source: ${plan.source}`;
    return { text, planStatus: plan };
  }

  function alerts(req: MaintenanceRequest): MaintenanceAnswer {
    const notifications = opts.notifications.listForVessel(state.notifications);
    return { text: opts.notifications.text(notifications) };
  }

  function explain(req: MaintenanceRequest): MaintenanceAnswer {
    const lower = req.query.toLowerCase();
    const certificatesTool = opts.registry.getCertificates({ context: req.context, state });
    const iscc = certificatesTool.data.find((c) => c.certificateType === "ISCC_CERTIFICATE");
    if (iscc && /iscc|biofuel/.test(lower)) {
      const stmt = opts.statusEngine.explain(iscc, now);
      const impacts = opts.statusEngine.impactsForCertificates([iscc]);
      const impactLines = impacts.map((i) => `- [${i.impact}] ${i.claim}`);
      return {
        text: [
          stmt.claim,
          `Status: ${iscc.status}`,
          `Basis: ${stmt.basis}`,
          impacts.length > 0 ? `Deterministic impacts:\n${impactLines.join("\n")}` : "",
          "For the impact on your next port call, ask the Captain Assistant.",
        ]
          .filter(Boolean)
          .join("\n\n"),
        certificates: [iscc],
        impacts,
      };
    }

    const scheduleTool = opts.registry.getSurveySchedule({ context: req.context, state });
    const overdue = scheduleTool.data.find((s) => s.status === "BLOCKING" || s.status === "OVERDUE");
    if (overdue) {
      const stmt = opts.statusEngine.explain(overdue, now);
      const blockingNote =
        overdue.status === "BLOCKING"
          ? `This is a BLOCKING item: an overdue ${overdue.surveyType} requirement keeps the vessel from maintaining its survey posture.`
          : "This item is past due but is not classed as blocking on its own.";
      return {
        text: [stmt.claim, `Status: ${overdue.status}`, blockingNote, `Basis: ${stmt.basis}`, `Source: ${overdue.source}`].join("\n\n"),
        schedule: [overdue],
      };
    }

    return { text: "There is nothing overdue or blocking on file for this vessel right now." };
  }

  function recall(req: MaintenanceRequest): MaintenanceAnswer {
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

  function handleQuery(req: MaintenanceRequest): MaintenanceAnswer {
    const lower = req.query.toLowerCase();

    if (/memory|remember|what did you (t|not)ell|what do you know about me|recall/i.test(lower)) {
      return recall(req);
    }

    if (/why|explain|blocking|expired|certificate.*(why|explain)|iscc/i.test(lower)) {
      if (/iscc|biofuel|why/.test(lower) && /certificate|iscc|expired/.test(lower)) {
        return explain(req);
      }
    }

    if (/alert|notification|flag/i.test(lower)) {
      return alerts(req);
    }

    if (/class society|classification|class status/i.test(lower)) {
      return classSociety(req);
    }

    if (/monitoring plan|plan review|plan status|mp review/i.test(lower)) {
      return planStatus(req);
    }

    if (/charter|maintenance window|window|drydock|off-hire|calendar/i.test(lower)) {
      return charterCalendar(req);
    }

    if (/deadline|due date|when.*due|what.*due|due next|upcoming deadline/i.test(lower)) {
      return deadlines(req);
    }

    if (/certificate|cert|valid|expir/i.test(lower)) {
      return certificates(req);
    }

    if (/survey|schedule|annual|intermediate|special|renewal|ism|isps|class.*survey|due soon|overdue/i.test(lower)) {
      return schedule(req);
    }

    return {
      text: `I can help with class surveys, certificates, monitoring plan reviews, charter maintenance windows and derived deadlines for ${state.vessel.name}. Try "When is the annual survey due?" or "Are any certificates expired?"`,
    };
  }

  function answer(req: MaintenanceRequest): MaintenanceAnswer {
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
      if (err instanceof MaintenanceVesselScopeError) {
        return {
          text: "I can only answer for your assigned vessel. I cannot access another vessel's survey or certificate data.",
        };
      }
      throw err;
    }
  }

  return {
    answer,
    schedule,
    certificates,
    deadlines,
    charterCalendar,
    classSociety,
    planStatus,
    alerts,
    explain,
    recall,
  };
}
