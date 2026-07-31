import type {
  CaptainVessel,
  ChecklistStatus,
  IngestEvent,
  IsccStatus,
  PortCall,
  PortRequirement,
  PortReadinessResult,
  ReadinessChecklistItem,
  ReadinessLevel,
  VesselDocumentStatus,
} from "./types";
import { CAPTAIN_MOCK_NOW } from "./mock-data";

const DAY_MS = 86_400_000;

const EVIDENCE_DOC_TYPES: Record<string, string> = {
  "req-antibes-iapp": "IAPP_CERTIFICATE",
  "req-antibes-monitoring-plan": "MONITORING_PLAN",
  "req-antibes-iscc": "ISCC_CERTIFICATE",
};

export interface ReadinessInputs {
  readonly vessel: CaptainVessel;
  readonly portCalls: ReadonlyArray<PortCall>;
  readonly requirements: ReadonlyArray<PortRequirement>;
  readonly documents: ReadonlyArray<VesselDocumentStatus>;
  readonly iscc: IsccStatus;
  readonly ingest: ReadonlyArray<IngestEvent>;
  readonly now?: string;
}

function daysUntil(iso: string, nowMs: number): number {
  const diff = new Date(iso).getTime() - nowMs;
  return Math.max(0, Math.ceil(diff / DAY_MS));
}

function bdnEvidenceStatus(
  ingest: ReadonlyArray<IngestEvent>,
  nowMs: number,
  arrivalMs: number,
): { status: ChecklistStatus; evidence: string; missing: string | null; deadline: string | null } {
  const bdnEvents = ingest.filter((e) => e.documentType === "BDN");
  if (bdnEvents.length === 0) {
    return {
      status: "RED",
      evidence: "No BDN on file",
      missing: "BDN for this delivery",
      deadline: new Date(arrivalMs).toISOString(),
    };
  }
  const latest = [...bdnEvents].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0]!;
  switch (latest.status) {
    case "completed":
      return {
        status: "GREEN",
        evidence: `BDN ${latest.fileName} — completed`,
        missing: null,
        deadline: null,
      };
    case "needs_review":
      return {
        status: "AMBER",
        evidence: `BDN ${latest.fileName} — needs review`,
        missing: "Review sign-off",
        deadline: new Date(arrivalMs).toISOString(),
      };
    case "processing":
    case "extracted":
      return {
        status: "AMBER",
        evidence: `BDN ${latest.fileName} — ${latest.status}`,
        missing: "Processing to complete",
        deadline: new Date(arrivalMs).toISOString(),
      };
    case "received":
      return {
        status: "AMBER",
        evidence: `BDN ${latest.fileName} — received, awaiting processing`,
        missing: "Processing to start",
        deadline: new Date(arrivalMs).toISOString(),
      };
    case "failed":
      return {
        status: "RED",
        evidence: `BDN ${latest.fileName} — failed`,
        missing: "Re-submit BDN",
        deadline: new Date(arrivalMs).toISOString(),
      };
    default:
      return {
        status: "AMBER",
        evidence: `BDN ${latest.fileName} — ${latest.status}`,
        missing: "Evidence incomplete",
        deadline: new Date(arrivalMs).toISOString(),
      };
  }
}

function certificateEvidence(
  requirement: PortRequirement,
  documents: ReadonlyArray<VesselDocumentStatus>,
  iscc: IsccStatus,
  nowMs: number,
): { status: ChecklistStatus; evidence: string; missing: string | null; deadline: string | null } {
  const expectedType = EVIDENCE_DOC_TYPES[requirement.id];
  const doc = expectedType
    ? documents.find((d) => d.documentType === expectedType)
    : documents.find((d) => requirement.requirement.toLowerCase().includes(d.documentType.toLowerCase()));

  if (!doc) {
    return {
      status: requirement.blocking ? "RED" : "AMBER",
      evidence: "Not on file",
      missing: requirement.requirement,
      deadline: null,
    };
  }

  switch (doc.status) {
    case "VALID":
      return {
        status: "GREEN",
        evidence: `${doc.title} — valid${doc.expiresAt ? `, expires ${doc.expiresAt.slice(0, 10)}` : ""}`,
        missing: null,
        deadline: null,
      };
    case "EXPIRING":
      return {
        status: "AMBER",
        evidence: `${doc.title} — expiring ${doc.expiresAt ? doc.expiresAt.slice(0, 10) : ""}`,
        missing: "Renewal / re-submission",
        deadline: doc.expiresAt,
      };
    case "PENDING_REVIEW":
      return {
        status: "AMBER",
        evidence: `${doc.title} — pending review`,
        missing: "Review completion",
        deadline: null,
      };
    default:
      return {
        status: requirement.blocking ? "RED" : "AMBER",
        evidence: `${doc.title} — ${doc.status}`,
        missing: requirement.requirement,
        deadline: null,
      };
  }
}

export interface ReadinessEngine {
  evaluate(inputs: ReadinessInputs): PortReadinessResult;
}

export function createReadinessEngine(): ReadinessEngine {
  function evaluate(inputs: ReadinessInputs): PortReadinessResult {
    const nowMs = new Date(inputs.now ?? CAPTAIN_MOCK_NOW).getTime();
    const upcoming = [...inputs.portCalls].sort((a, b) =>
      a.arrivalDate.localeCompare(b.arrivalDate),
    );
    const call = upcoming[0] ?? null;

    const vessel = inputs.vessel;
    if (!call) {
      return {
        port: "None",
        portCallId: null,
        arrivalDate: null,
        vessel,
        level: "AMBER",
        summary: "No upcoming port call is scheduled.",
        checklist: [],
        missingBlocking: [],
      };
    }

    const arrivalMs = new Date(call.arrivalDate).getTime();
    const requirements = inputs.requirements.filter(
      (r) => r.port.toLowerCase() === call.port.toLowerCase(),
    );

    if (requirements.length === 0) {
      return {
        port: call.port,
        portCallId: call.id,
        arrivalDate: call.arrivalDate,
        vessel,
        level: "RED",
        summary: `Cannot confirm readiness for ${call.port} — no requirement data is on file for this port.`,
        checklist: [
          {
            requirement: "Port requirement data",
            status: "RED",
            evidence: "Not on file",
            missing: "Requirement data",
            deadline: call.arrivalDate,
            recommendedAction: "Contact your operator for the port requirements.",
            source: "Poseidon Green Zone registry",
            blocking: true,
          },
        ],
        missingBlocking: ["Port requirement data"],
      };
    }

    const checklist: ReadonlyArray<ReadinessChecklistItem> = requirements.map((requirement) => {
      let status: ChecklistStatus;
      let evidence: string;
      let missing: string | null;
      let deadline: string | null;

      if (requirement.category === "BDN") {
        const bdn = bdnEvidenceStatus(inputs.ingest, nowMs, arrivalMs);
        status = bdn.status;
        evidence = bdn.evidence;
        missing = bdn.missing;
        deadline = bdn.deadline;
      } else {
        const cert = certificateEvidence(requirement, inputs.documents, inputs.iscc, nowMs);
        status = cert.status;
        evidence = cert.evidence;
        missing = cert.missing;
        deadline = cert.deadline;
      }

      const arrivalIn = daysUntil(call.arrivalDate, nowMs);
      const deadlineText =
        deadline === null
          ? null
          : `${deadline.slice(0, 10)} (${daysUntil(deadline, nowMs)}d before ${call.port} arrival ${arrivalIn}d)`;

      let recommendedAction: string;
      if (status === "GREEN") {
        recommendedAction = "No action required.";
      } else if (requirement.blocking && status === "RED") {
        recommendedAction = "Required before arrival — submit or renew now.";
      } else {
        recommendedAction = `Resolve before arrival (${arrivalIn}d). Submit or renew as soon as possible.`;
      }

      return {
        requirement: requirement.requirement,
        status,
        evidence,
        missing,
        deadline: deadlineText,
        recommendedAction,
        source: requirement.reference,
        blocking: requirement.blocking,
      };
    });

    const missingBlocking = checklist
      .filter((item) => item.status === "RED" && item.blocking)
      .map((item) => item.requirement);

    const anyRed = checklist.some((item) => item.status === "RED");
    const anyAmber = checklist.some((item) => item.status === "AMBER");
    const level: ReadinessLevel = anyRed ? "RED" : anyAmber ? "AMBER" : "GREEN";

    const arrivalIn = daysUntil(call.arrivalDate, nowMs);
    const summary =
      missingBlocking.length > 0
        ? `${level} — ${call.port} arrival in ${arrivalIn}d. Blocking: ${missingBlocking.join(", ")}.`
        : level === "GREEN"
          ? `${level} — ${call.port} arrival in ${arrivalIn}d. All required evidence is on file.`
          : `${level} — ${call.port} arrival in ${arrivalIn}d. Gaps can still be resolved before arrival.`;

    return {
      port: call.port,
      portCallId: call.id,
      arrivalDate: call.arrivalDate,
      vessel,
      level,
      summary,
      checklist,
      missingBlocking,
    };
  }

  return { evaluate };
}
