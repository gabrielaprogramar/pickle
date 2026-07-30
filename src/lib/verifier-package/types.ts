export const PACKAGE_VERSION = "1.0.0";

export interface PackageManifestEntry {
  readonly filename: string;
  readonly content_type: string;
  readonly size: number;
  readonly sha256: string;
  readonly storage_path: string;
}

export interface PackageManifest {
  readonly package_version: string;
  readonly generated_at: string;
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly files: ReadonlyArray<PackageManifestEntry>;
  readonly total_size: number;
  readonly file_count: number;
}

export interface PackageValidationIssue {
  readonly severity: "error" | "warning";
  readonly category: string;
  readonly message: string;
  readonly detail: string | null;
}

export interface PackageValidationResult {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<PackageValidationIssue>;
  readonly missing_required: ReadonlyArray<string>;
  readonly missing_recommended: ReadonlyArray<string>;
}

export interface PackageBuildInput {
  readonly vessel_id: string;
  readonly reporting_year: number;
  readonly report_ids: ReadonlyArray<string>;
  readonly include_ais_data: boolean;
  readonly include_bdn_documents: boolean;
  readonly include_validation_reports: boolean;
  readonly include_discrepancy_notes: boolean;
}
