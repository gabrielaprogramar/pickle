import type {
  CaptainContext,
  CaptainVessel,
  IngestEvent,
  IsccStatus,
  PortCall,
  PortRequirement,
  VesselDocumentStatus,
} from "./types";
import type { CaptainMockState } from "./mock-data";

export class CaptainVesselScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptainVesselScopeError";
  }
}

export interface CaptainToolContext {
  readonly context: CaptainContext;
  readonly state: CaptainMockState;
}

export interface CaptainToolResult<T> {
  readonly tool: string;
  readonly data: T;
  readonly vessel: CaptainVessel;
}

export interface CaptainToolRegistry {
  getPortRequirements(
    context: CaptainToolContext,
    port?: string,
  ): CaptainToolResult<ReadonlyArray<PortRequirement>>;
  getVesselDocStatus(context: CaptainToolContext): CaptainToolResult<ReadonlyArray<VesselDocumentStatus>>;
  getUpcomingPortCalls(context: CaptainToolContext): CaptainToolResult<ReadonlyArray<PortCall>>;
  getIsccStatus(context: CaptainToolContext): CaptainToolResult<IsccStatus>;
  getIngestConfirmations(context: CaptainToolContext): CaptainToolResult<ReadonlyArray<IngestEvent>>;
}

function assertVesselScope(context: CaptainToolContext): void {
  const ctxVessel = context.context.assignedVessel;
  const stateVessel = context.state.vessel;
  if (ctxVessel.vesselId !== stateVessel.vesselId || ctxVessel.imo !== stateVessel.imo) {
    throw new CaptainVesselScopeError(
      `Vessel scope mismatch: context is scoped to ${ctxVessel.name} (${ctxVessel.imo}) but data source is ${stateVessel.name} (${stateVessel.imo}). Refusing to return another vessel's data.`,
    );
  }
}

export function createCaptainToolRegistry(): CaptainToolRegistry {
  return {
    getPortRequirements(context, port) {
      assertVesselScope(context);
      const requirements = context.state.requirements.filter((r) =>
        port ? r.port.toLowerCase() === port.toLowerCase() : true,
      );
      return { tool: "get_port_requirements", data: requirements, vessel: context.state.vessel };
    },

    getVesselDocStatus(context) {
      assertVesselScope(context);
      return {
        tool: "get_vessel_doc_status",
        data: context.state.documents,
        vessel: context.state.vessel,
      };
    },

    getUpcomingPortCalls(context) {
      assertVesselScope(context);
      return {
        tool: "get_upcoming_port_calls",
        data: context.state.portCalls,
        vessel: context.state.vessel,
      };
    },

    getIsccStatus(context) {
      assertVesselScope(context);
      return { tool: "get_iscc_status", data: context.state.iscc, vessel: context.state.vessel };
    },

    getIngestConfirmations(context) {
      assertVesselScope(context);
      return {
        tool: "get_ingest_confirmations",
        data: context.state.ingest,
        vessel: context.state.vessel,
      };
    },
  };
}
