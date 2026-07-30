import type { RegulatoryCitation, ToolCallRecord } from "@/lib/assistant/types";

export interface ComplianceAnswer {
  readonly answer: string;
  readonly evidence: string;
  readonly why: string;
  readonly recommendedAction: string;
  readonly sources: ReadonlyArray<RegulatoryCitation>;
}

export interface ComplianceResponseBuilder {
  buildComplianceAnswer(params: ComplianceAnswer): string;
  formatComplianceFigure(value: number, unit: string, sourceRecordId: string, calcVersion?: string, paramVersion?: string): string;
  formatToolResultSummary(toolCalls: ReadonlyArray<ToolCallRecord>): string;
  formatInsufficientEvidence(): string;
  formatLegalRefusal(): string;
}

const INSUFFICIENT_EVIDENCE_MESSAGE =
  "I don't have sufficient information to answer that question.";

const LEGAL_REFUSAL_MESSAGE =
  "I cannot provide legal advice. Please consult a qualified maritime legal professional for legal interpretation or representation.";

export function createComplianceResponseBuilder(): ComplianceResponseBuilder {
  function buildComplianceAnswer(params: ComplianceAnswer): string {
    const sources = params.sources
      .map((s) => {
        const section = s.article_section ? `, ${s.article_section}` : "";
        return `- ${s.source} — ${s.regulation}${section} (${s.version})`;
      })
      .join("\n");

    return [
      `**Answer** — ${params.answer}`,
      `**Evidence** — ${params.evidence}`,
      `**Why** — ${params.why}`,
      `**Recommended action** — ${params.recommendedAction}`,
      `**Sources**`,
      sources,
    ].join("\n\n");
  }

  function formatComplianceFigure(
    value: number,
    unit: string,
    sourceRecordId: string,
    calcVersion?: string,
    paramVersion?: string,
  ): string {
    const formatted = Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
    const calc = calcVersion ? `, calculation v${calcVersion}` : "";
    const param = paramVersion ? `, parameter v${paramVersion}` : "";
    return `The figure is ${formatted} ${unit} (source: ${sourceRecordId}${calc}${param})`;
  }

  function formatToolResultSummary(toolCalls: ReadonlyArray<ToolCallRecord>): string {
    if (toolCalls.length === 0) return "No tools were called.";

    const lines = toolCalls.map((tc) => {
      const status = tc.success ? "succeeded" : "failed";
      return `- ${tc.toolName} (${tc.id}): ${status} in ${tc.latencyMs}ms`;
    });

    return `Tools used:\n${lines.join("\n")}`;
  }

  function formatInsufficientEvidence(): string {
    return INSUFFICIENT_EVIDENCE_MESSAGE;
  }

  function formatLegalRefusal(): string {
    return LEGAL_REFUSAL_MESSAGE;
  }

  return {
    buildComplianceAnswer,
    formatComplianceFigure,
    formatToolResultSummary,
    formatInsufficientEvidence,
    formatLegalRefusal,
  };
}
