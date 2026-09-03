import type { MrvVerifierPackage } from "@/lib/mrv/types";
import { sha256Hex } from "@/lib/mrv/export";

export interface VerifierPackageInput {
  readonly reportId: string;
  readonly reportContent: string;
  readonly sourceBdnCount: number;
  readonly voyageExportCount: number;
  readonly discrepancyNotes: ReadonlyArray<string>;
  readonly validationResultsRef: string;
  readonly auditReferences: ReadonlyArray<string>;
  /**
   * Order-stable identifiers of the exact source records the verifier package
   * is reconstructed from (consumption row ids, voyage ids, BDN ids). The
   * reproducibility hash is derived from these, so the package is reproducible
   * from stored records alone.
   */
  readonly sourceRecordIds?: ReadonlyArray<string>;
  /** Version of the calculation + parameter set used (for the hash). */
  readonly calculationVersion?: string;
}

/**
 * Build the verifier data package.
 *
 * The verifier package is a traceable collection of REFERENCES to source data
 * that supports the MRV annual report (it does NOT embed the actual files —
 * BDN PDFs, AIS exports, etc.). A deterministic `reproducibility_hash` is
 * computed over the report content plus the ordered source-record identifiers,
 * mirroring `calculation_version`/`parameter_version` so that a verifier (or
 * this system on a re-run) can confirm the package is rebuilt from the same
 * stored records.
 */
export function buildVerifierPackage(input: VerifierPackageInput): MrvVerifierPackage {
  const sourceIds = (input.sourceRecordIds ?? []).slice().sort();
  const hashInput = [
    input.reportContent,
    input.calculationVersion ?? "",
    ...sourceIds,
  ].join("\u0000");
  const reproducibilityHash = sha256Hex(hashInput);

  return {
    report_id: input.reportId,
    annual_report: input.reportContent,
    source_bdn_count: input.sourceBdnCount,
    voyage_export_count: input.voyageExportCount,
    discrepancy_notes: input.discrepancyNotes,
    validation_results_ref: input.validationResultsRef,
    audit_references: input.auditReferences,
    reproducibility_hash: reproducibilityHash,
    generated_at: new Date().toISOString(),
  };
}
