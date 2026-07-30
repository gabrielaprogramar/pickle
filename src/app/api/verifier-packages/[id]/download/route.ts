import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { createVerifierPackageRepository } from "@/lib/supabase/repositories/verifier_packages";
import { apiError, mapErrorResponse } from "@/app/api/_lib/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const repo = createVerifierPackageRepository({ client: getSupabaseClient() });
    const pkg = await repo.findById(id);

    if (!pkg) {
      return apiError("PACKAGE_NOT_FOUND", "Verifier package not found", 404);
    }

    if (!pkg.storage_path) {
      return apiError("PACKAGE_NOT_FOUND", "Package file not available", 404);
    }

    const manifest = pkg.manifest as Record<string, unknown> | null;
    const fileCount = manifest?.file_count ?? 0;

    const response = JSON.stringify({
      id: pkg.id,
      title: pkg.title,
      status: pkg.status,
      checksum: pkg.checksum,
      file_size: pkg.file_size,
      file_count: fileCount,
      storage_path: pkg.storage_path,
      generated_at: pkg.generated_at,
    });

    return new Response(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="verifier-package-${pkg.id}.json"`,
      },
    });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
