import type { VerifierPackageRow, VerifierPackageInsert, ComplianceReportRepository, DocumentRow } from "@/lib/supabase";
import type { PackageManifest, PackageManifestEntry, PackageBuildInput } from "./types";
import { PACKAGE_VERSION } from "./types";
import type { PackageValidationResult, PackageValidationIssue } from "./types";

export class PackageGenerationError extends Error {
  constructor(
    message: string,
    public readonly vesselId: string,
    public readonly reportingYear: number,
    cause?: unknown,
  ) {
    super(message);
    this.name = "PackageGenerationError";
  }
}

export class PackageNotFoundError extends Error {
  constructor(packageId: string) {
    super(`Verifier package not found: ${packageId}`);
    this.name = "PackageNotFoundError";
  }
}

export class PackageValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: ReadonlyArray<PackageValidationIssue>,
  ) {
    super(message);
    this.name = "PackageValidationError";
  }
}

export interface BuildResult {
  readonly pkg: VerifierPackageRow;
  readonly manifest: PackageManifest;
  readonly storagePath: string;
  readonly checksum: string;
}

export interface VerifierPackageBuilderOptions {
  readonly pkgRepo: {
    findById(id: string): Promise<VerifierPackageRow | null>;
    insert(pkg: VerifierPackageInsert): Promise<VerifierPackageRow>;
    update(id: string, changes: Partial<VerifierPackageInsert>): Promise<VerifierPackageRow>;
    list(limit?: number, offset?: number): Promise<ReadonlyArray<VerifierPackageRow>>;
  };
  readonly reportRepo: ComplianceReportRepository;
  readonly getVessel: (vesselId: string) => Promise<{ name: string; imo: string } | null>;
  readonly getDocumentsByVessel: (vesselId: string, types?: ReadonlyArray<string>) => Promise<ReadonlyArray<DocumentRow>>;
  readonly storeFile: (path: string, content: Buffer, contentType: string) => Promise<string>;
  readonly generateSignedUrl: (storagePath: string) => Promise<string>;
  readonly computeHash: (content: Buffer) => string;
  readonly buildZip: (files: ReadonlyArray<{ filename: string; content: Buffer }>) => Buffer;
}

export interface VerifierPackageBuilder {
  getPackage(packageId: string): Promise<VerifierPackageRow>;
  listPackages(limit?: number, offset?: number): Promise<ReadonlyArray<VerifierPackageRow>>;
  buildPackage(input: PackageBuildInput, generatedBy?: string): Promise<BuildResult>;
  validateBeforeBuild(input: PackageBuildInput): Promise<PackageValidationResult>;
  getDownloadUrl(packageId: string): Promise<string>;
}

export function createVerifierPackageBuilder(opts: VerifierPackageBuilderOptions): VerifierPackageBuilder {
  const REQUIRED_COMPONENTS = [
    "annual_report",
    "source_bdn_documents",
    "ais_voyage_data",
    "validation_reports",
    "compliance_records",
    "discrepancy_notes",
    "audit_events",
  ] as const;

  async function collectFiles(input: PackageBuildInput): Promise<{
    files: Array<{ filename: string; content: Buffer }>;
    manifestEntries: PackageManifestEntry[];
    missingRequired: string[];
    missingRecommended: string[];
  }> {
    const files: Array<{ filename: string; content: Buffer }> = [];
    const entries: PackageManifestEntry[] = [];
    const missingRequired: string[] = [];
    const missingRecommended: string[] = [];
    const now = new Date().toISOString();

    const reports = await opts.reportRepo.findByVesselAndYear(input.vessel_id, input.reporting_year);
    const annualReport = reports.find((r) => r.report_type === "thetis_mrv" && r.status === "GENERATED");

    if (annualReport?.content) {
      const reportContent = Buffer.from(JSON.stringify(annualReport.content, null, 2), "utf-8");
      const sha256 = opts.computeHash(reportContent);
      files.push({ filename: "annual_report.json", content: reportContent });
      entries.push({
        filename: "annual_report.json",
        content_type: "application/json",
        size: reportContent.length,
        sha256,
        storage_path: `annual_report.json`,
      });
    } else {
      missingRequired.push("annual_report.json — No generated THETIS-MRV report found");
    }

    if (input.include_bdn_documents) {
      const docs = await opts.getDocumentsByVessel(input.vessel_id, ["bdn"]);
      if (docs.length > 0) {
        for (const doc of docs) {
          const bdnContent = Buffer.from(JSON.stringify({ document_id: doc.id, title: doc.title, filename: doc.filename, storage_path: doc.storage_path }, null, 2), "utf-8");
          const sha256 = opts.computeHash(bdnContent);
          const safeFilename = `bdns/${doc.id}_${doc.filename}`;
          files.push({ filename: safeFilename, content: bdnContent });
          entries.push({
            filename: safeFilename,
            content_type: "application/json",
            size: bdnContent.length,
            sha256,
            storage_path: doc.storage_path,
          });
        }
      } else {
        missingRequired.push("source_bdn_documents — No BDN documents found for this vessel/year");
      }
    }

    if (input.include_ais_data) {
      const aisContent = Buffer.from(JSON.stringify({ note: "AIS data export placeholder", vessel_id: input.vessel_id, reporting_year: input.reporting_year }, null, 2), "utf-8");
      const sha256 = opts.computeHash(aisContent);
      files.push({ filename: "ais_voyage_data.json", content: aisContent });
      entries.push({
        filename: "ais_voyage_data.json",
        content_type: "application/json",
        size: aisContent.length,
        sha256,
        storage_path: "ais_voyage_data.json",
      });
    }

    if (input.include_validation_reports) {
      const validationContent = Buffer.from(JSON.stringify({ note: "Validation reports placeholder", vessel_id: input.vessel_id }, null, 2), "utf-8");
      const sha256 = opts.computeHash(validationContent);
      files.push({ filename: "validation_reports.json", content: validationContent });
      entries.push({
        filename: "validation_reports.json",
        content_type: "application/json",
        size: validationContent.length,
        sha256,
        storage_path: "validation_reports.json",
      });
    }

    if (input.include_discrepancy_notes) {
      const discContent = Buffer.from(JSON.stringify({ note: "Discrepancy resolution notes placeholder", vessel_id: input.vessel_id }, null, 2), "utf-8");
      const sha256 = opts.computeHash(discContent);
      files.push({ filename: "discrepancy_notes.json", content: discContent });
      entries.push({
        filename: "discrepancy_notes.json",
        content_type: "application/json",
        size: discContent.length,
        sha256,
        storage_path: "discrepancy_notes.json",
      });
    }

    const complianceRecords = [];
    const fueleuReports = reports.filter((r) => r.report_type === "fueleu" && r.status === "GENERATED");
    for (const fr of fueleuReports) {
      complianceRecords.push({ report_id: fr.id, report_type: "fueleu", generated_at: fr.generated_at });
    }
    const complianceContent = Buffer.from(JSON.stringify({ records: complianceRecords, vessel_id: input.vessel_id }, null, 2), "utf-8");
    const complianceSha256 = opts.computeHash(complianceContent);
    files.push({ filename: "compliance_records.json", content: complianceContent });
    entries.push({
      filename: "compliance_records.json",
      content_type: "application/json",
      size: complianceContent.length,
      sha256: complianceSha256,
      storage_path: "compliance_records.json",
    });

    return { files, manifestEntries: entries, missingRequired, missingRecommended };
  }

  return {
    async getPackage(packageId: string): Promise<VerifierPackageRow> {
      const pkg = await opts.pkgRepo.findById(packageId);
      if (!pkg) throw new PackageNotFoundError(packageId);
      return pkg;
    },

    async listPackages(limit = 50, offset = 0): Promise<ReadonlyArray<VerifierPackageRow>> {
      return opts.pkgRepo.list(limit, offset);
    },

    async validateBeforeBuild(input: PackageBuildInput): Promise<PackageValidationResult> {
      const issues: PackageValidationIssue[] = [];
      const missingRequired: string[] = [];
      const missingRecommended: string[] = [];

      const reports = await opts.reportRepo.findByVesselAndYear(input.vessel_id, input.reporting_year);
      const annualReport = reports.find((r) => r.report_type === "thetis_mrv" && r.status === "GENERATED");

      if (!annualReport) {
        issues.push({
          severity: "error",
          category: "missing_report",
          message: "No generated THETIS-MRV report for this vessel/year",
          detail: "Generate a THETIS-MRV report before building the verifier package",
        });
        missingRequired.push("annual_report.json");
      }

      if (input.include_bdn_documents) {
        const docs = await opts.getDocumentsByVessel(input.vessel_id, ["bdn"]);
        if (docs.length === 0) {
          issues.push({
            severity: "error",
            category: "missing_bdns",
            message: "No BDN documents found for this vessel",
            detail: "BDN documents are required for verifier package completeness",
          });
          missingRequired.push("source_bdn_documents");
        } else {
          issues.push({
            severity: "warning",
            category: "bdn_data_source",
            message: "BDN documents referenced — verify completeness of BDNs for the reporting year",
            detail: `${docs.length} BDN document(s) found`,
          });
        }
      }

      if (input.include_validation_reports) {
        issues.push({
          severity: "warning",
          category: "validation_data",
          message: "Validation reports will be included — verify they cover all documents",
          detail: null,
        });
        missingRecommended.push("validation_reports.json");
      }

      return {
        valid: missingRequired.length === 0,
        issues,
        missing_required: missingRequired,
        missing_recommended: missingRecommended,
      };
    },

    async buildPackage(input: PackageBuildInput, generatedBy?: string): Promise<BuildResult> {
      const validation = await this.validateBeforeBuild(input);
      if (!validation.valid) {
        throw new PackageValidationError(
          `Cannot build verifier package: ${validation.missing_required.length} required component(s) missing`,
          validation.issues,
        );
      }

      const vessel = await opts.getVessel(input.vessel_id);
      if (!vessel) throw new PackageGenerationError(`Vessel not found: ${input.vessel_id}`, input.vessel_id, input.reporting_year);

      const draft = await opts.pkgRepo.insert({
        vessel_id: input.vessel_id,
        reporting_year: input.reporting_year,
        status: "GENERATING",
        title: `Verifier Package — ${vessel.name} (${input.reporting_year})`,
        manifest: {},
        package_version: PACKAGE_VERSION,
        validation_result: { input },
        generated_at: new Date().toISOString(),
        generated_by: generatedBy ?? "system",
      });

      try {
        const { files, manifestEntries, missingRequired } = await collectFiles(input);

        if (missingRequired.length > 0) {
          throw new PackageGenerationError(
            `Missing required components: ${missingRequired.join(", ")}`,
            input.vessel_id,
            input.reporting_year,
          );
        }

        const totalSize = files.reduce((sum, f) => sum + f.content.length, 0);
        const manifest: PackageManifest = {
          package_version: PACKAGE_VERSION,
          generated_at: new Date().toISOString(),
          vessel_id: input.vessel_id,
          reporting_year: input.reporting_year,
          files: manifestEntries,
          total_size: totalSize,
          file_count: files.length,
        };

        const manifestContent = Buffer.from(JSON.stringify(manifest, null, 2), "utf-8");
        const manifestSha256 = opts.computeHash(manifestContent);
        files.push({ filename: "manifest.json", content: manifestContent });
        manifestEntries.push({
          filename: "manifest.json",
          content_type: "application/json",
          size: manifestContent.length,
          sha256: manifestSha256,
          storage_path: "manifest.json",
        });

        const manifestUpdated: PackageManifest = {
          ...manifest,
          files: manifestEntries,
          total_size: totalSize + manifestContent.length,
          file_count: files.length,
        };

        const zipBuffer = opts.buildZip(files);
        const checksum = opts.computeHash(zipBuffer);
        const storagePath = `verifier-packages/${input.vessel_id}/${input.reporting_year}/${draft.id}.zip`;
        const storedPath = await opts.storeFile(storagePath, zipBuffer, "application/zip");

        const updated = await opts.pkgRepo.update(draft.id, {
          status: "GENERATED",
          manifest: manifestUpdated as unknown as Record<string, unknown>,
          storage_path: storedPath,
          file_size: zipBuffer.length,
          checksum,
        });

        return { pkg: updated, manifest: manifestUpdated, storagePath: storedPath, checksum };
      } catch (e) {
        await opts.pkgRepo.update(draft.id, { status: "FAILED" });
        throw e;
      }
    },

    async getDownloadUrl(packageId: string): Promise<string> {
      const pkg = await this.getPackage(packageId);
      if (!pkg.storage_path) {
        throw new PackageGenerationError("Package has no storage path", pkg.vessel_id ?? "", pkg.reporting_year);
      }
      return opts.generateSignedUrl(pkg.storage_path);
    },
  };
}
