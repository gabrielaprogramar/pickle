import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { createVerifierPackageRepository } from "@/lib/supabase/repositories/verifier_packages";
import { apiSuccess, mapErrorResponse } from "@/app/api/_lib/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const repo = createVerifierPackageRepository({ client: getSupabaseClient() });
    const pkg = await repo.findById(id);

    if (!pkg) {
      return new Response(JSON.stringify({ error: "Verifier package not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return apiSuccess({ package: pkg });
  } catch (err) {
    return mapErrorResponse(err);
  }
}
