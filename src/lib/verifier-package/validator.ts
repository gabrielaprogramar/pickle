import type { PackageBuildInput, PackageValidationResult, PackageValidationIssue } from "./types";

export interface PackageValidatorOptions {
  readonly getReportCount: (vesselId: string, year: number) => Promise<number>;
  readonly getDocumentCount: (vesselId: string, types: ReadonlyArray<string>) => Promise<number>;
}

export interface PackageValidator {
  validate(input: PackageBuildInput): Promise<PackageValidationResult>;
}

export function createPackageValidator(opts: PackageValidatorOptions): PackageValidator {
  return {
    async validate(input: PackageBuildInput): Promise<PackageValidationResult> {
      const issues: PackageValidationIssue[] = [];
      const missingRequired: string[] = [];
      const missingRecommended: string[] = [];

      const reportCount = await opts.getReportCount(input.vessel_id, input.reporting_year);
      if (reportCount === 0) {
        issues.push({
          severity: "error",
          category: "missing_report",
          message: "No compliance reports found for this vessel and year",
          detail: "At least one compliance report must be generated before building a verifier package",
        });
        missingRequired.push("compliance_report");
      }

      if (input.include_bdn_documents) {
        const bdnCount = await opts.getDocumentCount(input.vessel_id, ["bdn"]);
        if (bdnCount === 0) {
          issues.push({
            severity: "error",
            category: "missing_bdns",
            message: "No BDN documents found for this vessel",
            detail: "BDN documents are required for the verifier package",
          });
          missingRequired.push("bdn_documents");
        } else {
          issues.push({
            severity: "warning",
            category: "bdn_coverage",
            message: `${bdnCount} BDN document(s) found — verify they cover the full reporting year`,
            detail: null,
          });
        }
      }

      if (input.include_validation_reports) {
        issues.push({
          severity: "warning",
          category: "validation_data",
          message: "Validation reports will be included if available",
          detail: null,
        });
        missingRecommended.push("validation_reports");
      }

      if (!input.include_ais_data) {
        issues.push({
          severity: "warning",
          category: "ais_missing",
          message: "AIS/voyage data will NOT be included in the package",
          detail: "AIS data is recommended for verifier review",
        });
        missingRecommended.push("ais_voyage_data");
      }

      return {
        valid: missingRequired.length === 0,
        issues,
        missing_required: missingRequired,
        missing_recommended: missingRecommended,
      };
    },
  };
}
