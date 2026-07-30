import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { createComplianceReportRepository } from "@/lib/supabase/repositories/compliance_reports";
import { createVerifierPackageRepository } from "@/lib/supabase/repositories/verifier_packages";
import { createVesselRepository } from "@/lib/supabase/repositories/vessels";
import { createDocumentRepository } from "@/lib/supabase/repositories/documents";
import { createVerifierPackageBuilder } from "@/lib/verifier-package";
import { apiCreated, apiError, mapErrorResponse, parseJsonBody } from "@/app/api/_lib/http";
import { createHash } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody<{
      vessel_id: string;
      reporting_year: number;
      include_ais_data?: boolean;
      include_bdn_documents?: boolean;
      include_validation_reports?: boolean;
      include_discrepancy_notes?: boolean;
      generated_by?: string;
    }>(request);

    if (!body) {
      return apiError("VALIDATION_ERROR", "Request body is required", 400);
    }

    if (!body.vessel_id) {
      return apiError("VALIDATION_ERROR", "vessel_id is required", 400);
    }

    if (!body.reporting_year) {
      return apiError("VALIDATION_ERROR", "reporting_year is required", 400);
    }

    const client = getSupabaseClient();
    const pkgRepo = createVerifierPackageRepository({ client });
    const reportRepo = createComplianceReportRepository({ client });
    const vesselRepo = createVesselRepository({ client });
    const docRepo = createDocumentRepository({ client });

    const builder = createVerifierPackageBuilder({
      pkgRepo,
      reportRepo,
      getVessel: async (id) => {
        const v = await vesselRepo.findById(id);
        return v ? { name: v.name, imo: v.imo } : null;
      },
      getDocumentsByVessel: async (id, types) => {
        const docs = await docRepo.listByVesselId(id);
        if (types && types.length > 0) {
          return docs.filter((d) => types.includes(d.document_type));
        }
        return docs;
      },
      storeFile: async (_path, _content, _contentType) => {
        return _path;
      },
      generateSignedUrl: async (storagePath) => {
        return `/api/storage/signed?path=${encodeURIComponent(storagePath)}`;
      },
      computeHash: (content) => {
        return createHash("sha256").update(content).digest("hex");
      },
      buildZip: (files) => {
        const text = files.map((f) => `${f.filename}:${f.content.length}`).join("\n");
        return Buffer.from(text, "utf-8");
      },
    });

    const result = await builder.buildPackage({
      vessel_id: body.vessel_id,
      reporting_year: body.reporting_year,
      report_ids: [],
      include_ais_data: body.include_ais_data ?? true,
      include_bdn_documents: body.include_bdn_documents ?? true,
      include_validation_reports: body.include_validation_reports ?? true,
      include_discrepancy_notes: body.include_discrepancy_notes ?? true,
    }, body.generated_by);

    return apiCreated({
      package: result.pkg,
      manifest: result.manifest,
      checksum: result.checksum,
      download_url: await builder.getDownloadUrl(result.pkg.id),
    });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
