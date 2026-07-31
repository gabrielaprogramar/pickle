import type {
  CaptainAnswer,
  CaptainContext,
  CaptainRequest,
  ReadinessChecklistItem,
} from "./types";
import { CAPTAIN_ASSISTANT_VERSION } from "./types";
import type { CaptainToolRegistry } from "./captain-tools";
import { CaptainVesselScopeError } from "./captain-tools";
import type { CaptainMockState } from "./mock-data";
import type { ReadinessEngine } from "./readiness";
import type { IngestService } from "./ingest";
import type { CaptainHandoffDetector } from "./handoff";
import type { CaptainSafetyGuard } from "./safety";
import type { CaptainNotificationService } from "./captain-notifications";
import type { BdnForwarding } from "./forwarding";

export interface CaptainServiceOptions {
  readonly state: CaptainMockState;
  readonly registry: CaptainToolRegistry;
  readonly readinessEngine: ReadinessEngine;
  readonly ingestService: IngestService;
  readonly handoffDetector: CaptainHandoffDetector;
  readonly safetyGuard: CaptainSafetyGuard;
  readonly notifications: CaptainNotificationService;
  readonly forwarding: BdnForwarding;
  readonly context: CaptainContext;
  readonly modelId?: string;
  readonly promptVersion?: string;
}

export interface CaptainService {
  answer(req: CaptainRequest): CaptainAnswer;
  readiness(req: CaptainRequest): CaptainAnswer;
  ingestStatus(req: CaptainRequest): CaptainAnswer;
  forwardingInfo(req: CaptainRequest): CaptainAnswer;
  portCalls(req: CaptainRequest): CaptainAnswer;
}

function formatChecklist(checklist: ReadonlyArray<ReadinessChecklistItem>): string {
  return checklist
    .map((item) => {
      const tag = `[${item.status}]`;
      const lines = [`${tag} ${item.requirement}`];
      if (item.evidence) lines.push(`     Evidence: ${item.evidence}`);
      if (item.missing) lines.push(`     Missing: ${item.missing}`);
      if (item.deadline) lines.push(`     Deadline: ${item.deadline}`);
      lines.push(`     Action: ${item.recommendedAction}`);
      lines.push(`     Source: ${item.source}`);
      return lines.join("\n");
    })
    .join("\n");
}

const KNOWN_PORTS: ReadonlyArray<string> = [
  "antibes",
  "port vauban",
  "vauban",
  "palma",
  "genoa",
];

function mentionedPort(query: string): string | null {
  const lower = query.toLowerCase();
  for (const port of KNOWN_PORTS) {
    if (lower.includes(port)) {
      return port.charAt(0).toUpperCase() + port.slice(1);
    }
  }
  return null;
}

export function createCaptainService(opts: CaptainServiceOptions): CaptainService {
  const modelId = opts.modelId ?? "mock";
  const promptVersion = opts.promptVersion ?? CAPTAIN_ASSISTANT_VERSION;

  function readiness(req: CaptainRequest): CaptainAnswer {
    const state = opts.state;
    const tool = opts.registry.getUpcomingPortCalls({ context: req.context, state });
    const result = opts.readinessEngine.evaluate({
      vessel: state.vessel,
      portCalls: tool.data,
      requirements: state.requirements,
      documents: state.documents,
      iscc: state.iscc,
      ingest: state.ingest,
    });

    if (result.portCallId === null) {
      return {
        text: result.summary,
        portCalls: tool.data,
      };
    }

    const header =
      result.port === "None"
        ? `READINESS — ${result.level}`
        : `PORT ${result.port.toUpperCase()} — ${result.level}`;

    return {
      text: [header, result.summary, formatChecklist(result.checklist)].join("\n\n"),
      readiness: result,
      checklist: result.checklist,
      portCalls: tool.data,
    };
  }

  function ingestStatus(req: CaptainRequest): CaptainAnswer {
    const state = opts.state;
    const tool = opts.registry.getIngestConfirmations({ context: req.context, state });
    const out = opts.ingestService.status(tool.data);
    return { text: out.text, ingest: out.events };
  }

  function forwardingInfo(req: CaptainRequest): CaptainAnswer {
    const state = opts.state;
    const info = opts.forwarding.info(state.vessel.imo);
    return { text: info.text };
  }

  function portCalls(req: CaptainRequest): CaptainAnswer {
    const state = opts.state;
    const tool = opts.registry.getUpcomingPortCalls({ context: req.context, state });
    if (tool.data.length === 0) {
      return {
        text: "No upcoming port calls are on file.",
        portCalls: [],
      };
    }
    const lines = tool.data.map(
      (c) =>
        `- ${c.port} · arrival ${c.arrivalDate.slice(0, 10)} · departure ${c.departureDate.slice(0, 10)} (${c.status.toLowerCase()})`,
    );
    return { text: `Upcoming port calls:\n${lines.join("\n")}`, portCalls: tool.data };
  }

  function vesselStatus(req: CaptainRequest): CaptainAnswer {
    const state = opts.state;
    const docTool = opts.registry.getVesselDocStatus({ context: req.context, state });
    const docLines = docTool.data.map((d) => `- ${d.title} · ${d.status.toLowerCase()}`);
    const status = docTool.data.some((d) => d.status === "VALID" || d.status === "EXPIRING")
      ? "OK"
      : "ACTION";
    const text = [
      `Vessel ${state.vessel.name} (IMO ${state.vessel.imo}) — status ${status}.`,
      docLines.length > 0 ? `Documents on file:\n${docLines.join("\n")}` : "No documents on file.",
    ].join("\n\n");
    return { text };
  }

  function hasScheduledCall(port: string, context: CaptainContext): boolean {
    const state = opts.state;
    const tool = opts.registry.getUpcomingPortCalls({ context, state });
    return tool.data.some((c) => c.port.toLowerCase() === port.toLowerCase());
  }

  function handleQuery(req: CaptainRequest): CaptainAnswer {
    const lower = req.query.toLowerCase();

    if (/bdn|received|did.*arrive|processed|needs? review|ingest|confirm|review queue/i.test(lower)) {
      if (/send|where|forward|email|address|submit|how do i/i.test(lower)) {
        return forwardingInfo(req);
      }
      return ingestStatus(req);
    }

    if (/ready|readiness|missing|blocking|checklist|need before|what do i need|before arrival|ready for/i.test(lower)) {
      const mentioned = mentionedPort(req.query);
      if (mentioned && !hasScheduledCall(mentioned, req.context)) {
        return {
          text: `No upcoming port call at ${mentioned} is on file, so I can't produce a readiness checklist for it. I won't invent requirements.`,
        };
      }
      return readiness(req);
    }

    if (/next port|upcoming|when is my next|port call/i.test(lower)) {
      return portCalls(req);
    }

    if (/require|required/i.test(lower)) {
      const mentioned = mentionedPort(req.query);
      if (mentioned) {
        return {
          text: `I only check requirements for scheduled port calls. ${hasScheduledCall(mentioned, req.context) ? `You have a scheduled call at ${mentioned}.` : `There is no scheduled call at ${mentioned}, so I have no requirement data for it and won't invent any.`}`,
        };
      }
      return {
        text: "I only check requirements for your scheduled port calls. Ask 'Am I ready for Antibes?' to see your checklist.",
      };
    }

    if (/status|documents|certificate|iscc/i.test(lower)) {
      return vesselStatus(req);
    }

    if (/alert|notification/i.test(lower)) {
      const state = opts.state;
      const notifications = opts.notifications.listForVessel(state.notifications);
      return { text: opts.notifications.text(notifications) };
    }

    return {
      text: `I can help with port readiness, missing documents, BDN status and your vessel's next operation. Try "Am I ready for Antibes?" or "Did you receive my BDN?"`,
    };
  }

  function answer(req: CaptainRequest): CaptainAnswer {
    const query = (req.query ?? "").trim();
    const context = req.context ?? opts.context;

    const safety = opts.safetyGuard.check(query, context.assignedVessel);
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
      if (err instanceof CaptainVesselScopeError) {
        return {
          text: "I can only answer for your assigned vessel. I cannot access another vessel's data.",
        };
      }
      throw err;
    }
  }

  return {
    answer,
    readiness,
    ingestStatus,
    forwardingInfo,
    portCalls,
  };
}
