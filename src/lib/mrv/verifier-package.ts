import type { MrvVerifierPackage } from "@/lib/mrv/types";

export interface VerifierPackageInput {
  readonly reportId: string;
  readonly reportContent: string;
  readonly sourceBdnCount: number;
  readonly voyageExportCount: number;
  readonly discrepancyNotes: ReadonlyArray<string>;
  readonly validationResultsRef: string;
  readonly auditReferences: ReadonlyArray<string>;
}

/**
 * Build the verifier data package reference.
 *
 * The verifier package is a traceable collection of references to source data
 * that supports the MRV annual report. It does NOT embed the actual files
 * (BDN PDFs, AIS exports, etc.) — it references them.
 */
export function buildVerifierPackage(input: VerifierPackageInput): MrvVerifierPackage {
  return {
    report_id: input.reportId,
    annual_report: input.reportContent,
    source_bdn_count: input.sourceBdnCount,
    voyage_export_count: input.voyageExportCount,
    discrepancy_notes: input.discrepancyNotes,
    validation_results_ref: input.validationResultsRef,
    audit_references: input.auditReferences,
    generated_at: new Date().toISOString(),
  };
}
