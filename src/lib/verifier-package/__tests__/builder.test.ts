import { describe, it, expect, run } from "@/lib/marinetraffic/__tests__/_testRunner";
import { createVerifierPackageBuilder, PackageNotFoundError, PackageValidationError, PackageGenerationError } from "../builder";
import type { PackageBuildInput } from "../types";
import type { VerifierPackageStatus, VerifierPackageRow, ReportRow } from "@/lib/supabase";

describe("VerifierPackageBuilder", () => {
  function createMockOptions(): any {
    const pkgStore = new Map<string, Record<string, unknown>>();
    const reportStore = new Map<string, Record<string, unknown>>();

    return {
      pkgRepo: {
        findById: async (id: string) => {
          const p = pkgStore.get(id);
          return p
            ? {
                id: p.id as string,
                vessel_id: (p.vessel_id as string) ?? null,
                reporting_year: p.reporting_year as number,
                status: p.status as VerifierPackageStatus,
                title: p.title as string,
                manifest: (p.manifest as Record<string, unknown>) ?? {},
                storage_path: (p.storage_path as string) ?? null,
                file_size: (p.file_size as number) ?? null,
                checksum: (p.checksum as string) ?? null,
                package_version: (p.package_version as string) ?? "1.0.0",
                validation_result: (p.validation_result as Record<string, unknown>) ?? null,
                generated_at: (p.generated_at as string) ?? null,
                generated_by: (p.generated_by as string) ?? null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : null;
        },
        insert: async (input: Record<string, unknown>) => {
          const id = `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const row: VerifierPackageRow = {
            id,
            vessel_id: (input.vessel_id as string) ?? null,
            reporting_year: input.reporting_year as number,
            status: (input.status ?? "DRAFT") as VerifierPackageStatus,
            title: input.title as string,
            manifest: (input.manifest ?? {}) as Record<string, unknown>,
            storage_path: (input.storage_path as string) ?? null,
            file_size: (input.file_size as number) ?? null,
            checksum: (input.checksum as string) ?? null,
            package_version: (input.package_version as string) ?? "1.0.0",
            validation_result: (input.validation_result as Record<string, unknown>) ?? null,
            generated_at: (input.generated_at as string) ?? null,
            generated_by: (input.generated_by as string) ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          pkgStore.set(id, row);
          return row;
        },
        update: async (id: string, changes: Record<string, unknown>) => {
          const existing = pkgStore.get(id);
          if (!existing) throw new Error("Not found");
          const updated: VerifierPackageRow = { ...(existing as VerifierPackageRow), ...(changes as Partial<VerifierPackageRow>), updated_at: new Date().toISOString() };
          pkgStore.set(id, updated);
          return updated;
        },
        list: async () => [],
      },
      reportRepo: {
        findById: async () => null,
        findByVesselAndYear: async (vesselId: string, year: number) => {
          return Array.from(reportStore.values()).filter(
            (r: any) => r.vessel_id === vesselId && r.reporting_year === year,
          );
        },
        listByType: async () => [],
        listByVessel: async () => [],
        insert: async () => ({}) as any,
        update: async () => ({}) as any,
        list: async () => [],
        delete: async () => {},
      },
      getVessel: async (id: string) => {
        if (id === "v1") return { name: "Test Vessel", imo: "1234567" };
        return null;
      },
      getDocumentsByVessel: async (_vesselId: string, types?: ReadonlyArray<string>) => {
        if (types?.includes("bdn")) {
          return [
            { id: "doc1", document_type: "bdn", title: "BDN 1", filename: "bdn1.pdf", storage_path: "/bdns/bdn1.pdf", status: "extracted", mime_type: "application/pdf", file_size: 1000, vessel_id: "v1", source_channel: "MANUAL", metadata: null, created_at: "2025-01-01", updated_at: "2025-01-01" },
            { id: "doc2", document_type: "bdn", title: "BDN 2", filename: "bdn2.pdf", storage_path: "/bdns/bdn2.pdf", status: "extracted", mime_type: "application/pdf", file_size: 2000, vessel_id: "v1", source_channel: "EMAIL", metadata: null, created_at: "2025-01-15", updated_at: "2025-01-15" },
          ];
        }
        return [];
      },
      storeFile: async (path: string) => path,
      generateSignedUrl: async (path: string) => `/signed/${encodeURIComponent(path)}`,
      computeHash: (content: Buffer) => {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
          const byte = content[i];
          if (byte === undefined) continue;
          hash = ((hash << 5) - hash) + byte;
          hash = hash & hash;
        }
        return hash.toString(16).padStart(64, "0");
      },
      buildZip: (files: ReadonlyArray<{ filename: string; content: Buffer }>) => {
        return Buffer.from(files.map((f) => `${f.filename}:${f.content.length}`).join("\n"), "utf-8");
      },
    };
  }

  const buildInput: PackageBuildInput = {
    vessel_id: "v1",
    reporting_year: 2025,
    report_ids: [],
    include_ais_data: true,
    include_bdn_documents: true,
    include_validation_reports: true,
    include_discrepancy_notes: true,
  };

  describe("getPackage / listPackages", () => {
    it("returns a package by ID", async () => {
      const opts = createMockOptions();
      const builder = createVerifierPackageBuilder(opts);

      const created = await opts.pkgRepo.insert({
        vessel_id: "v1",
        reporting_year: 2025,
        title: "Test",
        status: "DRAFT",
      });

      const result = await builder.getPackage(created.id);
      expect(result.id).toBe(created.id);
    });

    it("throws PackageNotFoundError for missing package", async () => {
      const opts = createMockOptions();
      const builder = createVerifierPackageBuilder(opts);
      await expect(async () => builder.getPackage("nonexistent")).toThrow(PackageNotFoundError);
    });
  });

  describe("validateBeforeBuild", () => {
    it("returns valid=false when annual report is missing", async () => {
      const opts = createMockOptions();
      const builder = createVerifierPackageBuilder(opts);

      const result = await builder.validateBeforeBuild(buildInput);
      expect(result.valid).toBe(false);
      expect(result.missing_required.includes("annual_report.json")).toBe(true);
      expect(result.issues.some((i) => i.category === "missing_report")).toBe(true);
    });

    it("returns valid=true when all required components are present", async () => {
      const opts = createMockOptions();
      opts.reportRepo.findByVesselAndYear = async () => [
        { id: "r1", report_type: "thetis_mrv", status: "GENERATED", vessel_id: "v1", reporting_year: 2025, title: "MRV Report" } as any,
      ];
      const builder = createVerifierPackageBuilder(opts);

      const result = await builder.validateBeforeBuild(buildInput);
      expect(result.valid).toBe(true);
    });

    it("reports issues when BDNs are included but none found", async () => {
      const opts = createMockOptions();
      opts.reportRepo.findByVesselAndYear = async () => [
        { id: "r1", report_type: "thetis_mrv", status: "GENERATED" } as any,
      ];
      opts.getDocumentsByVessel = async () => [];

      const builder = createVerifierPackageBuilder(opts);
      const result = await builder.validateBeforeBuild(buildInput);

      expect(result.missing_required.includes("source_bdn_documents")).toBe(true);
      expect(result.issues.some((i) => i.category === "missing_bdns")).toBe(true);
    });
  });

  describe("buildPackage", () => {
    it("builds a package successfully when all required data exists", async () => {
      const opts = createMockOptions();
      opts.reportRepo.findByVesselAndYear = async () => [
        { id: "r1", report_type: "thetis_mrv", status: "GENERATED", vessel_id: "v1", reporting_year: 2025, title: "Annual MRV 2025", content: { vessel_name: "Test", total_co2: 15000 } } as any,
        { id: "r2", report_type: "fueleu", status: "GENERATED", vessel_id: "v1", reporting_year: 2025, title: "FuelEU 2025", content: { compliance_balance: 5 } } as any,
      ];
      opts.getDocumentsByVessel = async () => [
        { id: "doc1", document_type: "bdn", title: "BDN 1", filename: "bdn1.pdf", storage_path: "/bdns/bdn1.pdf", status: "extracted", mime_type: "application/pdf", file_size: 1000, vessel_id: "v1", source_channel: "MANUAL", metadata: null, created_at: "2025-01-01", updated_at: "2025-01-01" },
      ];

      const builder = createVerifierPackageBuilder(opts);
      const result = await builder.buildPackage(buildInput, "test-user");

      expect(result.pkg.status).toBe("GENERATED");
      expect(result.pkg.generated_by).toBe("test-user");
      expect(result.pkg.checksum).toBeTruthy();
      expect(result.manifest.file_count).toBeGreaterThan(3);
      expect(result.manifest.files.some((f) => f.filename === "manifest.json")).toBe(true);
    });

    it("throws PackageValidationError when required components are missing", async () => {
      const opts = createMockOptions();
      const builder = createVerifierPackageBuilder(opts);

      await expect(async () => builder.buildPackage(buildInput)).toThrow(PackageValidationError);
    });

    it("marks package as FAILED when build process errors", async () => {
      const opts = createMockOptions();
      opts.reportRepo.findByVesselAndYear = async () => [
        { id: "r1", report_type: "thetis_mrv", status: "GENERATED", vessel_id: "v1", reporting_year: 2025, title: "MRV", content: { data: "test" } } as any,
      ];
      opts.getVessel = async () => {
        throw new Error("Vessel fetch failed");
      };

      const builder = createVerifierPackageBuilder(opts);
      await expect(async () => builder.buildPackage(buildInput)).toThrow();
    });
  });

  describe("getDownloadUrl", () => {
    it("returns a signed URL for a generated package", async () => {
      const opts = createMockOptions();
      const builder = createVerifierPackageBuilder(opts);

      opts.reportRepo.findByVesselAndYear = async () => [
        { id: "r1", report_type: "thetis_mrv", status: "GENERATED", content: {} } as any,
      ];

      const result = await builder.buildPackage(buildInput);
      const url = await builder.getDownloadUrl(result.pkg.id);
      expect(url).toContainString("/signed/");
    });

    it("throws when package has no storage path", async () => {
      const opts = createMockOptions();
      const builder = createVerifierPackageBuilder(opts);

      const inserted = await opts.pkgRepo.insert({
        vessel_id: "v1",
        reporting_year: 2025,
        title: "No storage",
        status: "DRAFT",
      });

      await expect(async () => builder.getDownloadUrl(inserted.id)).toThrow(PackageGenerationError);
    });
  });
});

run();
